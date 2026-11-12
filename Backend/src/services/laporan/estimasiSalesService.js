// services/laporan/estimasiSalesService.js
// Migrasi dari Delphi ufrmBrowseEstimasiSales.pas (loaddata)
// 3 query Delphi: (1) master estimasi, (2) realisasi sales, (3) piutang/inkaso
// Digabung di JS persis seperti Delphi step-by-step update.
const db = require("../../config/database");

const getBrowse = async ({ bulan, tahun }) => {
  if (!bulan || !tahun) throw new Error("bulan dan tahun wajib.");

  const bulanInt = Number(bulan);
  const tahunInt = Number(tahun);

  // ── 1. Master estimasi (Delphi: testimasisales_hdr + _dtl) ──────
  const masterSql = `
    SELECT sls_kode, sls_nama AS salesman,
      (SELECT sls_nama FROM tsalescustomer
        INNER JOIN tsalesman ON sls_kode = sc_sls_kode
        WHERE sc_cus_kode = x.cus_kode) AS marketing,
      (SELECT SUM((100-fpd_discpr)*(fpd_harga*fpd_qty)/100
            *IF(fp_istax=1, IF(fp_tanggal<"2022/04/01",1.1,1.11),1))
            - SUM(fpd_cn*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100)
            - SUM(fpd_bp_pr*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100)
            + SUM(fpd_bp_rp*fpd_qty)
        FROM tfp_dtl
        INNER JOIN tfp_hdr ON fp_nomor = fpd_fp_nomor
        LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
        INNER JOIN tbarang ON brg_kode = fpd_brg_kode
        WHERE month(fp_tanggal) = ?
          AND year(fp_tanggal) = ?
          AND brg_isproductfocus = 1
          AND fp_cus_kode = x.cus_kode
          AND so_sls_kode = final.sls_kode
      ) AS pf,
      cus_kode,
      cus_nama,
      esd_targetsales    AS targetsales,
      esd_estimasisales  AS estimasisales,
      esd_realisasisales AS realisasisales,
      esd_avgsales       AS avgsales,
      0                  AS ratiosales,
      esd_targetinkaso    AS targetinkaso,
      esd_estimasiinkaso  AS estimasiinkaso,
      esd_realisasiinkaso AS realisasiinkaso,
      0                  AS ratioinkaso
    FROM testimasisales_hdr
    INNER JOIN testimasisales_dtl ON esd_esh_id = esh_id
    INNER JOIN tcustomer x ON cus_kode = esd_cus_kode
    INNER JOIN tsalesman final ON sls_kode = esh_sls_kode
    WHERE esh_periode = ?
      AND esh_tahun   = ?
  `;

  const [masterRows] = await db.query(masterSql, [bulanInt, tahunInt, bulanInt, tahunInt]);

  // Build lookup map: kode_salesman → row
  const map = new Map();
  const rows = masterRows.map((r, idx) => {
    const kodeSalesman = (r.sls_kode || "") + (r.cus_kode || "");
    const row = {
      no: idx + 1,
      kode_salesman: kodeSalesman,
      salesman: r.salesman || "",
      marketing: r.marketing || "",
      kode: r.cus_kode || "",
      nama: r.cus_nama || "",
      pf: Number(r.pf) || 0,
      targetsales: Number(r.targetsales) || 0,
      estimasisales: Number(r.estimasisales) || 0,
      avgsales: Number(r.avgsales) || 0,
      realisasisales: Number(r.realisasisales) || 0,
      ratiosales: 0,
      targetinkaso: Number(r.targetinkaso) || 0,
      estimasiinkaso: Number(r.estimasiinkaso) || 0,
      realisasiinkaso: Number(r.realisasiinkaso) || 0,
      ratioinkaso: 0,
    };
    map.set(kodeSalesman, row);
    return row;
  });

  if (rows.length === 0) return [];

  // VIEW penjualan butuh @tg1/@tg2 (fungsi tg1()/tg2()) di session var.
  // SET var + semua query yang menyentuh view harus di satu koneksi yang sama
  // (pool bisa memakai koneksi berbeda). Delphi: @tg1=awal bulan, @tg2=akhir bulan.
  const fmtD = (d) => d.toISOString().slice(0, 10);
  const awalBuln = new Date(tahunInt, bulanInt - 1, 1);
  const akhirBuln = new Date(tahunInt, bulanInt, 0);
  const connOpts = { tgl1: fmtD(awalBuln), tgl2: fmtD(akhirBuln) };
  const runOnPenjualanConn = async (sql, params) => {
    const conn = await db.getConnection();
    try {
      await conn.query(`SET @tg1='${connOpts.tgl1}', @tg2='${connOpts.tgl2}'`);
      return conn.query(sql, params);
    } finally {
      conn.release();
    }
  };

  // ── 2. Realisasi sales (Delphi: query kedua, update realisasisales + ratiosales) ──
  const realisasiSql = `
    SELECT salesman, customer,
      riil - IFNULL(retur, 0) AS realisasisales
    FROM (
      SELECT b.sls_kode AS salesman, customer,
        SUM(IF(year(tanggal)>2021, dpp, total) - biaya_promosi - kontrak) AS riil,
        (SELECT SUM(IFNULL(IF(year(retj_tanggal)>2021,
              retj_amount-retj_taxamount, retj_amount), 0))
         FROM tretj_hdr
         INNER JOIN tfp_hdr ON retj_fp_nomor = fp_nomor
         LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
         WHERE so_cus_kode = a.customer
           AND month(retj_tanggal) = ?
           AND year(retj_tanggal)  = ?
         GROUP BY so_cus_kode
        ) AS retur
      FROM penjualan a
      INNER JOIN tsalesman b ON sls_kode = salesman
      WHERE MONTH(tanggal) = ?
        AND YEAR(tanggal)  = ?
      GROUP BY customer
    ) final
  `;

  const [realRows] = await runOnPenjualanConn(realisasiSql, [bulanInt, tahunInt, bulanInt, tahunInt]);

  for (const r of realRows) {
    const key = (r.salesman || "") + (r.customer || "");
    const row = map.get(key);
    if (!row) continue;
    row.realisasisales = Number(r.realisasisales) || 0;
    if (row.targetsales > 0) {
      row.ratiosales = (row.realisasisales / row.targetsales) * 100;
    }
  }

  // ── 3. Piutang / Inkaso (Delphi: query ketiga, update inkaso) ──
  const akhirDate = new Date(tahunInt, bulanInt, 0); // last day of month
  const awalDate = new Date(tahunInt, bulanInt - 1, 1);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const inkasoSql = `
    SELECT salesman, cus_kode AS customer,
      IF(piutang < 0, 0, piutang) AS piutang,
      IFNULL(inkaso, 0) AS inkaso
    FROM (
      SELECT salesman, customer,
        SUM(
          IF(
            (SELECT COUNT(*) FROM tjatuhtempofp WHERE jt_fp_nomor = nomor) > 0,
            (SELECT SUM(jt_nilai) FROM tjatuhtempofp
             WHERE jt_fp_nomor = nomor AND jt_tanggaljt <= ?),
            total
          )
        )
        - IFNULL((
          SELECT SUM(bayar_cash + bayar_transfer + giro + potongan + ppn + pph
            - IFNULL((
                SELECT SUM(bycd_bayar) FROM tbayarcus_dtl
                INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor
                WHERE bycd_byc_nomor = xx.nomor AND fp_jthtempo > ?
              ), 0))
          FROM pembayaran xx
          WHERE customer = a.customer
            AND salesman  = a.salesman
            AND tanggal < ?
        ), 0)
        - IFNULL((
          SELECT SUM(retur) FROM retur
          WHERE customer = a.customer
            AND salesman = a.salesman
            AND tanggal < ?
        ), 0) AS piutang,

        (SELECT SUM(bycd_bayar)
         FROM tbayarcus_dtl
         INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
         INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor
         WHERE fp_cus_kode = a.customer
           AND fp_tanggal < ?
           AND fp_jthtempo > ?
           AND MONTH(byc_tanggal) = ?
        ) AS tunai2,

        (SELECT SUM(IFNULL(bayar_cash,0) + IFNULL(bayar_transfer,0)
                   + IFNULL(giro,0) + IFNULL(potongan,0)
                   + IFNULL(pph,0) + IFNULL(ppn,0))
         FROM pembayaran
         WHERE MONTH(tanggal) = ?
           AND YEAR(tanggal)  = ?
           AND customer = a.customer
           AND salesman = a.salesman
        ) AS inkaso

      FROM penjualan a
      INNER JOIN tfp_hdr ON fp_nomor = nomor
      WHERE tanggal < ?
        AND fp_jthtempo <= ?
      GROUP BY salesman, customer
    ) a
    INNER JOIN tcustomer ON customer = cus_kode
    WHERE IFNULL(inkaso, 0) > 1 OR IFNULL(piutang, 0) > 1
  `;

  const inkasoParams = [
    fmt(akhirDate),  // jt_tanggaljt <= akhir
    fmt(akhirDate),  // fp_jthtempo > akhir
    fmt(awalDate),   // tanggal < awal (pembayaran)
    fmt(awalDate),   // tanggal < awal (retur)
    fmt(awalDate),   // fp_tanggal < awal
    fmt(akhirDate),  // fp_jthtempo > akhir
    bulanInt,        // MONTH(byc_tanggal)
    bulanInt,        // MONTH(tanggal)
    tahunInt,        // YEAR(tanggal)
    fmt(awalDate),   // tanggal < awal (penjualan)
    fmt(akhirDate),  // fp_jthtempo <= akhir
  ];

  const [inkRows] = await runOnPenjualanConn(inkasoSql, inkasoParams);

  for (const r of inkRows) {
    const key = (r.salesman || "") + (r.customer || "");
    const row = map.get(key);
    if (!row) continue;
    row.realisasiinkaso = Number(r.inkaso) || 0;
    row.targetinkaso = Number(r.piutang) || 0;
    if (row.targetinkaso > 0) {
      row.ratioinkaso = (row.realisasiinkaso / row.targetinkaso) * 100;
    }
  }

  // Re-number
  rows.forEach((r, i) => { r.no = i + 1; });

  return rows;
};

module.exports = { getBrowse };
