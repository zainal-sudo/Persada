// services/utility/settingEstimasiSalesmanService.js
// Migrasi dari Delphi ufrmEstimasiSales.pas (Setting Estimasi Salesman).
// Menu Delphi: Utility -> "Setting Estimasi Salesman" (SettingEstimasiSalesman1Click,
// MAIN.pas line 1433 -> ShowForm(TfrmEstimasiSales), judul form 'Estimasi Salesman').
//
// Form transaksi dengan grid per-customer untuk 1 salesman + 1 periode:
//   - loaddata   : isi grid dari testimasisales_hdr/dtl bila sudah ada (cekada),
//                  bila belum dari daftar customer di tso_hdr salesman tsuka.
//                  Setelah itu 3 kalkulasi menimpa kolom turunan:
//                    avgsales  (rata-rata penjualan 3 bulan sebelumnya, view penjualan2)
//                    realisasi (penjualan bulan ini - retur, view penjualan)
//                    targetinkaso/realisasiinkaso (piutang & pembayaran, view penjualan)
//   - simpandata : delete header+detail (esh_lock=0) lalu insert ulang
//                  (getmaxid = MAX(esh_id)+1), TANPA transaksi di Delphi.
// Kolom yang di-EDIT user di grid: targetsales, estimasisales, estimasiinkaso.
// Kolom turunan (readonly di grid): avgsales, realisasisales, ratiosales,
// targetinkaso, realisasiinkaso, ratioinkaso.
// VIEW `penjualan`/`penjualan2` membutuhkan @tg1/@tg2 pada sesi koneksi yang
// sama — pola runOnPenjualanConn dari estimasiSalesService (laporan).
const db = require("../../config/database");

// ── Validasi periode (sama dengan modul proses lain) ─────────────────
const valPeriod = (bulan, tahun) => {
  const m = Number(bulan);
  const t = Number(tahun);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Bulan tidak valid.");
  if (!Number.isInteger(t) || t < 2000 || t > 2100) throw new Error("Tahun tidak valid.");
  return { m, t };
};

const fmtD = (d) => d.toISOString().slice(0, 10);

// Jalankan SQL pada SATU koneksi dengan @tg1/@tg2 ter-set (view penjualan*).
// Delphi: set @tg1 = awal bulan terpilih, @tg2 = akhir bulan terpilih.
const runOnPenjualanConn = async (sql, params, { m, t }) => {
  const awal = fmtD(new Date(t, m - 1, 1));
  const akhir = fmtD(new Date(t, m, 0));
  const conn = await db.getConnection();
  try {
    await conn.query(`SET @tg1='${awal}', @tg2='${akhir}'`);
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    conn.release();
  }
};

// ── Lookup customer (Delphi: clCustomerPropertiesButtonClick -> frmbantuan) ──
// Delphi join golongan utk kolom bantuan; web cukup kode+nama utk picker.
const getCustomers = async () => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama
       FROM tcustomer
      ORDER BY cus_kode`
  );
  return rows;
};

// ── Lookup salesman (Delphi: edtKodeClickBtn -> frmbantuan) ──────────
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
       FROM tsalesman
      ORDER BY sls_kode`
  );
  return rows;
};

// ── gettarget (Delphi: gettarget) — display edtTarget ────────────────
const getTargetSalesman = async (salesman, { m, t }) => {
  const [rows] = await db.query(
    `SELECT st_targetsales FROM tsalesmantarget
      WHERE st_sls_kode = ? AND st_periode = ? AND st_tahun = ?`,
    [salesman, m, t]
  );
  return Number(rows[0]?.st_targetsales) || 0;
};

// ── cekada / cekdata (Delphi) ────────────────────────────────────────
// cekada   : header sudah ada (tanpa syarat lock) -> mode edit
// cekdata  : header dengan esh_lock=1 -> tidak boleh edit
const cekada = async (salesman, { m, t }) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS jml FROM testimasisales_hdr
      WHERE esh_sls_kode = ? AND esh_tahun = ? AND esh_periode = ?`,
    [salesman, t, m]
  );
  return (Number(rows[0]?.jml) || 0) > 0;
};

const ceklock = async (salesman, { m, t }) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS jml FROM testimasisales_hdr
      WHERE esh_sls_kode = ? AND esh_tahun = ? AND esh_periode = ? AND esh_lock = 1`,
    [salesman, t, m]
  );
  return (Number(rows[0]?.jml) || 0) > 0;
};

// ── loaddata (Delphi: loaddata) ──────────────────────────────────────
// Return rows grid + flagEdit + lock + targetSalesman.
const load = async (query) => {
  const { m, t } = valPeriod(query.bulan, query.tahun);
  const salesman = String(query.salesman || "").trim();
  if (!salesman) throw new Error("Salesman belum di pilih.");

  const targetSalesman = await getTargetSalesman(salesman, { m, t });
  const sudahAda = await cekada(salesman, { m, t });
  const lock = sudahAda ? await ceklock(salesman, { m, t }) : false;

  // 1) Isi grid: data tersimpan bila header ada, bila belum customer dari SO.
  let rows;
  if (sudahAda) {
    rows = (await db.query(
      `SELECT cus_kode, cus_nama,
              esd_targetsales     AS targetsales,
              esd_estimasisales   AS estimasisales,
              esd_avgsales        AS avgsales,
              esd_realisasisales  AS realisasisales,
              esd_targetinkaso    AS targetinkaso,
              esd_estimasiinkaso  AS estimasiinkaso,
              esd_realisasiinkaso AS realisasiinkaso
         FROM testimasisales_hdr
         INNER JOIN testimasisales_dtl ON esd_esh_id = esh_id
         INNER JOIN tcustomer ON cus_kode = esd_cus_kode
        WHERE esh_sls_kode = ? AND esh_periode = ? AND esh_tahun = ?
        ORDER BY cus_kode`,
      [salesman, m, t]
    ))[0];
  } else {
    rows = (await db.query(
      `SELECT DISTINCT cus_kode, cus_nama
         FROM tso_hdr
         INNER JOIN tcustomer ON cus_kode = so_cus_kode
        WHERE so_sls_kode = ?`,
      [salesman]
    ))[0];
  }

  const list = (rows || []).map((r) => ({
    kode: r.cus_kode || "",
    nama: r.cus_nama || "",
    targetsales: Number(r.targetsales) || 0,
    estimasisales: Number(r.estimasisales) || 0,
    avgsales: Number(r.avgsales) || 0,
    realisasisales: Number(r.realisasisales) || 0,
    targetinkaso: Number(r.targetinkaso) || 0,
    estimasiinkaso: Number(r.estimasiinkaso) || 0,
    realisasiinkaso: Number(r.realisasiinkaso) || 0,
  }));
  const byKode = new Map(list.map((r) => [r.kode, r]));

  // 2) avgsales: rata-rata penjualan 3 bulan sebelumnya (view penjualan2).
  // Delphi: bulan < 4 -> ambil Okt/Nov/Des tahun sebelumnya; selain itu
  // bulan-3 di tahun yang sama. Range: [awal bulan-3, awal bulan terpilih).
  let abulan, atahun;
  if (m < 4) {
    abulan = m === 3 ? 12 : m === 2 ? 11 : 10;
    atahun = t - 1;
  } else {
    abulan = m - 3;
    atahun = t;
  }
  const awal = new Date(t, m - 1, 1);
  const awal3 = new Date(atahun, abulan - 1, 1);

  const avgRows = await runOnPenjualanConn(
    `SELECT customer, (SUM(total - biaya_promosi - kontrak - retur)) / 3 AS avgsales
       FROM penjualan2
      WHERE tanggal < ? AND tanggal >= ? AND salesman = ?
      GROUP BY customer`,
    [fmtD(awal), fmtD(awal3), salesman],
    { m, t }
  );
  for (const r of avgRows) {
    const row = byKode.get(r.customer);
    if (row) row.avgsales = Number(r.avgsales) || 0;
  }

  // 3) realisasi sales: penjualan bulan terpilih - retur bulan terpilih
  //    (view penjualan; verbatim Delphi — tanpa filter salesman di SQL,
  //    dibatasi ke grid via lookup customer, semantik CDS.Locate).
  const realRows = await runOnPenjualanConn(
    `SELECT salesman, customer, riil - IFNULL(retur, 0) AS realisasisales FROM (
       SELECT b.sls_kode AS salesman, customer,
         SUM(IF(year(tanggal) > 2021, dpp, total) - biaya_promosi - kontrak) AS riil,
         (SELECT SUM(IFNULL(IF(year(retj_tanggal) > 2021,
                retj_amount - retj_taxamount, retj_amount), 0))
            FROM tretj_hdr
            INNER JOIN tfp_hdr ON retj_fp_nomor = fp_nomor
            LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
           WHERE so_cus_kode = a.customer
             AND MONTH(retj_tanggal) = ? AND YEAR(retj_tanggal) = ?
           GROUP BY so_cus_kode) AS retur
         FROM penjualan a
         INNER JOIN tsalesman b ON sls_kode = salesman
        WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
        GROUP BY customer
     ) final`,
    [m, t, m, t],
    { m, t }
  );
  for (const r of realRows) {
    const row = byKode.get(r.customer);
    if (!row) continue;
    row.realisasisales = Number(r.realisasisales) || 0;
  }

  // 4) piutang & inkaso (view penjualan; verbatim Delphi — SQL lengkap
  //    difilter salesman, hasil dibatasi ke grid via lookup customer).
  const akhir = fmtD(new Date(t, m, 0));
  const inkRows = await runOnPenjualanConn(
    `SELECT cus_kode customer, IF(piutang < 0, 0, piutang) piutang, IFNULL(inkaso, 0) inkaso
       FROM (
         SELECT customer,
           SUM(IF(
             (SELECT COUNT(*) FROM tjatuhtempofp WHERE jt_fp_nomor = nomor) > 0,
             (SELECT SUM(jt_nilai) FROM tjatuhtempofp
               WHERE jt_fp_nomor = nomor AND jt_tanggaljt <= ?),
             total
           ))
           - IFNULL((
               SELECT SUM(bayar_cash + bayar_transfer + giro + potongan + ppn + pph
                 - IFNULL((
                     SELECT SUM(bycd_bayar) FROM tbayarcus_dtl
                     INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor
                     WHERE bycd_byc_nomor = xx.nomor AND fp_jthtempo > ?
                   ), 0))
               FROM pembayaran xx
              WHERE customer = a.customer
                AND salesman = ?
                AND tanggal < ?
             ), 0)
           - IFNULL((
               SELECT SUM(retur) FROM retur
               INNER JOIN tfp_hdr ON fp_nomor = retj_fp_nomor AND fp_jthtempo <= ?
              WHERE customer = a.customer
                AND salesman = ?
                AND tanggal < ?
             ), 0) AS piutang,
           (
             SELECT SUM(bycd_bayar)
               FROM tbayarcus_dtl
               INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
               INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor
              WHERE fp_cus_kode = a.customer
                AND fp_tanggal < ? AND fp_jthtempo > ? AND MONTH(byc_tanggal) = ?
           ) AS tunai2,
           (
             SELECT SUM(IFNULL(bayar_cash, 0) + IFNULL(bayar_transfer, 0)
                      + IFNULL(giro, 0) + IFNULL(potongan, 0)
                      + IFNULL(pph, 0) + IFNULL(ppn, 0))
               FROM pembayaran
              WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
                AND customer = a.customer AND salesman = a.salesman
           ) AS inkaso
         FROM penjualan a
         INNER JOIN tfp_hdr ON fp_nomor = nomor
        WHERE tanggal < ? AND fp_jthtempo <= ?
          AND a.salesman = ?
        GROUP BY customer
       ) a
       INNER JOIN tcustomer ON customer = cus_kode
      WHERE IFNULL(inkaso, 0) > 1 OR IFNULL(piutang, 0) > 1`,
    [akhir, akhir, salesman, fmtD(awal), akhir, salesman, fmtD(awal),
     fmtD(awal), akhir, m, m, t, fmtD(awal), akhir, salesman],
    { m, t }
  );
  for (const r of inkRows) {
    const row = byKode.get(r.customer);
    if (!row) continue;
    row.realisasiinkaso = Number(r.inkaso) || 0;
    row.targetinkaso = Number(r.piutang) || 0;
  }

  return {
    bulan: m,
    tahun: t,
    salesman,
    targetSalesman,
    flagEdit: sudahAda,
    lock,
    rows: list,
  };
};

// ── simpandata (Delphi: simpandata) — transaksional ──────────────────
// Delete header+detail (esh_lock=0) lalu insert ulang; esh_id = MAX+1
// (getmaxid). Delphi eksekusi per-statement tanpa transaksi.
const save = async (payload, user) => {
  const { m, t } = valPeriod(payload.bulan, payload.tahun);
  const salesman = String(payload.salesman || "").trim();
  if (!salesman) throw new Error("Salesman belum di pilih.");

  // Delphi cekdata: header lock -> 'sudah di Lock, tidak bisa edit'
  if (await ceklock(salesman, { m, t })) {
    throw new Error("sudah di Lock, tidak bisa edit");
  }

  const rowsInput = Array.isArray(payload.rows) ? payload.rows : [];
  const rows = rowsInput
    .filter((r) => r && String(r.kode || "").trim() !== "")
    .map((r) => ({
      kode: String(r.kode).trim(),
      targetsales: Number(r.targetsales) || 0,
      estimasisales: Number(r.estimasisales) || 0,
      realisasisales: Number(r.realisasisales) || 0,
      targetinkaso: Number(r.targetinkaso) || 0,
      estimasiinkaso: Number(r.estimasiinkaso) || 0,
      realisasiinkaso: Number(r.realisasiinkaso) || 0,
      avgsales: Number(r.avgsales) || 0,
    }));

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    // Delete detail lewat join header (Delphi hanya delete header; detail
    // yatim tidak tersentuh — di web tetap diikuti, TAPI detail yatim dari
    // proses ini akan tertimpa insert baru dengan esh_id berbeda; karena
    // delete header memakai esh_lock=0 dan detail lama tetap ada, kita
    // ikuti Delphi persis: hanya delete header.)
    // Catatan: delete header saja meninggalkan detail yatim — perilaku
    // Delphi dipertahankan verbatim.
    await conn.query(
      `DELETE FROM testimasisales_hdr
        WHERE esh_periode = ? AND esh_tahun = ? AND esh_sls_kode = ? AND esh_lock = 0`,
      [m, t, salesman]
    );

    const [maxRow] = await conn.query(
      `SELECT IFNULL(MAX(esh_id), 0) + 1 AS fid FROM testimasisales_hdr`
    );
    const fid = Number(maxRow[0]?.fid) || 1;

    await conn.query(
      `INSERT INTO testimasisales_hdr (esh_id, esh_sls_kode, esh_periode, esh_tahun)
       VALUES (?, ?, ?, ?)`,
      [fid, salesman, m, t]
    );

    for (const r of rows) {
      await conn.query(
        `INSERT INTO testimasisales_dtl
           (esd_esh_id, esd_cus_kode, esd_targetsales, esd_estimasisales,
            esd_realisasisales, esd_targetinkaso, esd_estimasiinkaso,
            esd_realisasiinkaso, esd_avgsales)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fid, r.kode, r.targetsales, r.estimasisales, r.realisasisales,
         r.targetinkaso, r.estimasiinkaso, r.realisasiinkaso, r.avgsales]
      );
    }

    await conn.commit();
    return {
      bulan: m,
      tahun: t,
      salesman,
      eshId: fid,
      jmlBaris: rows.length,
      user: user?.kode || "",
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getSalesman, getCustomers, load, save };
