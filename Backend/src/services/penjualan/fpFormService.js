// services/penjualan/fpFormService.js
const db = require("../../config/database");

// ── Generate Nomor FP ────────────────────────────────────────────────
// Format: PREFIX.FP.yymm.NNNN (PREFIX = div_prefix divisi SO), contoh:
// AMP.FP.2611.0001. Sequence terpisah pajak/non-pajak, terpisah dari
// nomor format lama (01-FP.yymm.xxxx).
const getMaxNomor = async (tanggal, isTax, divKode) => {
  if (!divKode) throw new Error("Divisi wajib dipilih untuk membuat nomor FP.");
  const [[div]] = await db.query(
    `SELECT div_prefix FROM tdivisi WHERE div_kode = ?`,
    [divKode]
  );
  if (!div || !div.div_prefix) throw new Error("Prefix divisi tidak ditemukan.");

  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${div.div_prefix}.FP.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(fp_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tfp_hdr WHERE fp_nomor LIKE ? AND fp_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(fp_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tfp_hdr WHERE fp_nomor LIKE ? AND fp_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  }
};

// ── Search SO ────────────────────────────────────────────────────────
// FP lookup: SO harus closed (semua kiriman selesai), sudah ada pengirimannya,
// dan belum di-invoice.
//
// so_iskirim=1 WAJIB karena so_isclosed tidak menjamin ada pengiriman:
// toggleClose (soService.js) cuma membalik flag tanpa cek DO, jadi SO tanpa
// DO bisa saja berstatus closed. Tanpa filter ini, SO semacam itu muncul di
// pilihan faktur lalu menghasilkan form kosong.
//
// Flag so_iskirim diisi oleh stored procedure sp_sync_so, yang dipanggil dari
// syncSO() setiap DO disimpan (doFormService.js:494) dan setiap DO dihapus
// (doService.js:149).
const searchSO = async (search = "") => {
  const [rows] = await db.query(
    `SELECT so_nomor AS nomor, DATE_FORMAT(so_tanggal, '%Y-%m-%d') AS tanggal,
            c.cus_nama AS customer
     FROM tso_hdr so
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_isproforma = 0
       AND so.so_isclosed = 1 AND so.so_iskirim = 1 AND so.so_isinvoice = 0
       AND (so.so_nomor LIKE ? OR c.cus_nama LIKE ?)
     ORDER BY so.so_tanggal DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load SO ──────────────────────────────────────────────────────────
// 1 SO = 1 invoice. Qty faktur = akumulasi SEMUA DO milik SO, ditampilkan
// per baris detail DO (paritas Delphi loaddataDO): granularity sama dengan
// DO, yaitu per (barang + expired + idBatch + gudang) — barang yang
// dikirim dalam beberapa batch muncul sebagai baris terpisah.
// Qty baris = SUM(dod_qty) - SUM(dod_qty_invoice) baris batch tersebut.
const loadSO = async (nomorSO) => {
  const [[h]] = await db.query(
    `SELECT so.so_nomor,
       DATE_FORMAT(so.so_tanggal, '%Y-%m-%d') AS so_tanggal,
       so.so_isecer, so.so_cus_kode, so.so_istax, so.so_sls_kode,
       so.so_div_kode, so.so_disc_faktur, so.so_disc_fakturpr,
       c.cus_nama, c.cus_alamat, c.cus_telp, c.cus_top,
       s.sls_nama
     FROM tso_hdr so
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     WHERE so.so_nomor = ? LIMIT 1`,
    [nomorSO]
  );
  if (!h) throw new Error("SO tidak ditemukan.");

  // Baris detail diambil dari tdo_dtl (semua DO milik SO), di-group per
  // barang + expired + idBatch + gudang. Qty = terkirim - sudah di-invoice.
  // Harga/disc tetap dari tso_dtl (harga di-set di SO, bukan di DO).
  const [rows] = await db.query(
    `SELECT x.brgKode, x.brgNama, x.satuan, x.qty, x.harga, x.discPr, x.hrgMin,
            x.expired, x.idBatch, x.gudang
     FROM (
       SELECT d.sod_brg_kode AS brgKode,
              b.brg_nama AS brgNama,
              d.sod_brg_satuan AS satuan,
              (IFNULL(SUM(dd.dod_qty), 0) - IFNULL(SUM(dd.dod_qty_invoice), 0)) AS qty,
              d.sod_harga AS harga,
              d.sod_discpr AS discPr,
              b.brg_harga_min AS hrgMin,
              DATE_FORMAT(dd.dod_tgl_expired, '%Y-%m-%d') AS expired,
              dd.dod_idbatch AS idBatch,
              dd.dod_gdg_kode AS gudang,
              MIN(dd.dod_nourut) AS nourut
       FROM tdo_dtl dd
       INNER JOIN tdo_hdr hh ON hh.do_nomor = dd.dod_do_nomor
       INNER JOIN tso_dtl d ON d.sod_so_nomor = hh.do_so_nomor
         AND d.sod_brg_kode = dd.dod_brg_kode
       INNER JOIN tbarang b ON b.brg_kode = dd.dod_brg_kode
       WHERE hh.do_so_nomor = ?
       GROUP BY d.sod_brg_kode, b.brg_nama, d.sod_brg_satuan, d.sod_harga,
                d.sod_discpr, b.brg_harga_min, expired, idBatch, gudang
     ) x
     WHERE x.qty > 0
     ORDER BY x.nourut ASC`,
    [nomorSO]
  );

  const detailWithExtras = [];
  for (const d of rows) {
    const qty = Number(d.qty) || 0;
    const harga = Number(d.harga) || 0;
    const discPr = Number(d.discPr) || 0;
    const total = qty * harga * (100 - discPr) / 100;

    // Biaya promosi/fee/CN dihapus dari transaksi FP — selalu 0.
    detailWithExtras.push({
      brgKode: d.brgKode,
      brgNama: d.brgNama,
      satuan: d.satuan,
      idBatch: d.idBatch || "",
      qty,
      expired: d.expired || "",
      gudang: d.gudang || "",
      harga,
      discPr,
      total,
      cn: 0,
      nilaiCN: 0,
      kurang: qty,
      hrgMin: Number(d.hrgMin) || 0,
      promosiRp: 0,
      promosiPr: 0,
      feeRp: 0,
      feePr: 0,
    });
  }

  return {
    nomorSO: h.so_nomor,
    isTax: h.so_istax,
    isEcer: h.so_isecer,
    divKode: h.so_div_kode || "",
    cusKode: h.so_cus_kode,
    cusNama: h.cus_nama,
    alamat: h.cus_alamat,
    telp: h.cus_telp,
    salesman: h.sls_nama || "",
    top: h.cus_top || 0,
    discFakturPr: h.so_disc_fakturpr || 0,
    discFaktur: h.so_disc_faktur || 0,
    detail: detailWithExtras,
  };
};

// ── Get Disc CN ──────────────────────────────────────────────────────
const getDiscCN = async (brgKode, cusKode, tanggal) => {
  const [[row]] = await db.query(
    `SELECT fpd_cn 
     FROM tfp_hdr 
     INNER JOIN tfp_dtl ON fpd_fp_nomor = fp_nomor
     INNER JOIN tpiutangcn ON cn_cus_kode = fp_cus_kode
     WHERE fp_cus_kode = ? 
       AND fpd_brg_kode = ? 
       AND fpd_cn > 0
       AND cn_startdate <= ? 
       AND cn_enddate >= ?
     ORDER BY fp_tanggal DESC LIMIT 1`,
    [cusKode, brgKode, tanggal, tanggal]
  );
  return Number(row?.fpd_cn || 0);
};

// ── Get Top ──────────────────────────────────────────────────────────
const getTop = async (cusKode) => {
  const [[row]] = await db.query(
    `SELECT cus_top FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [cusKode]
  );
  return Number(row?.cus_top || 0);
};

// ── Get Nilai Retur ──────────────────────────────────────────────────
const getNilaiRetur = async (nomor) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(SUM(retj_amount), 0) AS total
     FROM tretj_hdr WHERE retj_fp_nomor = ?`,
    [nomor]
  );
  return Number(row?.total || 0);
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT fp_nomor AS nomor, 
            DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
            fp_do_nomor AS nomorDO,
            COALESCE(fp_so_nomor, '') AS nomorSO,
            DATE_FORMAT(fp_jthtempo, '%Y-%m-%d') AS jthTempo,
            fp_memo AS memo, fp_cus_kode AS cusKode,
            fp_istax AS isTax, fp_isecer AS isEcer,
            fp_iscatalog AS isCatalog, fp_tipecash AS tipecash,
            fp_isDTP AS isDTP, fp_disc_fakturpr AS discFakturPr,
            fp_disc_faktur AS discFaktur, fp_biayapr AS biayaPr,
            fp_biayarp AS biayaRp, fp_freight AS freight,
            fp_amount AS amount, fp_taxamount AS taxAmount,
            fp_dp AS dp, fp_cn AS cn
     FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("FP tidak ditemukan.");

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat, cus_telp, cus_top FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  const [[salesman]] = await db.query(
    `SELECT s.sls_nama FROM tso_hdr so
     LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     WHERE so.so_nomor = ? LIMIT 1`,
    [h.nomorSO]
  );

  const [details] = await db.query(
    `SELECT d.fpd_brg_kode AS brgKode, b.brg_nama AS brgNama,
            d.fpd_brg_satuan AS satuan, d.fpd_idbatch AS idBatch,
            d.fpd_qty AS qty, d.fpd_harga AS harga,
            d.fpd_discpr AS discPr,
            ROUND(d.fpd_harga * d.fpd_qty * (100 - IFNULL(d.fpd_discpr,0)) / 100, 2) AS total,
            DATE_FORMAT(d.fpd_expired, '%Y-%m-%d') AS expired,
            d.fpd_cn AS cn, d.fpd_gdg_kode AS gudang,
            d.fpd_hrg_min AS hrgMin,
            d.fpd_bp_rp AS promosiRp, d.fpd_bp_pr AS promosiPr,
            d.fpd_bp_rp2 AS feeRp, d.fpd_bp_pr2 AS feePr
     FROM tfp_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE d.fpd_fp_nomor = ?
     ORDER BY d.fpd_nourut ASC`,
    [nomor]
  );

  // Hitung kurang & nilaiCN & net
  const detailFinal = [];
  for (const d of details) {
    const [[soDtl]] = await db.query(
      `SELECT (sod_qty - IFNULL(sod_qty_invoice, 0)) AS kurang
       FROM tso_dtl 
       WHERE sod_so_nomor = ? AND sod_brg_kode = ?
       LIMIT 1`,
      [h.nomorSO, d.brgKode]
    );

    const kurang = Number(soDtl?.kurang || 0) + Number(d.qty || 0);
    const nilaiCN = Number(d.cn || 0) * Number(d.total || 0) / 100;
    const hargaNet = Number(d.harga || 0) * (100 - Number(d.discPr || 0)) / 100;
    // Net per unit (paritas Delphi) — cn/biaya promosi/fee terhadap harga net
    // unit, bukan total baris.
    const net = hargaNet - (Number(d.cn || 0) * hargaNet) / 100
      - Number(d.promosiRp || 0) - (Number(d.promosiPr || 0) * hargaNet) / 100
      - Number(d.feeRp || 0) - (Number(d.feePr || 0) * hargaNet) / 100;

    detailFinal.push({
      ...d,
      kurang,
      nilaiCN,
      net,
      otorisasi: 0,
    });
  }

  const retur = await getNilaiRetur(nomor);

  return {
    ...h,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    telp: customer?.cus_telp || "",
    top: Number(customer?.cus_top || 0),
    salesman: salesman?.sls_nama || "",
    totalSetelahRetur: Number(h.amount) - retur,
    detail: detailFinal,
  };
};

// ── Cek periode sudah ditutup (paritas Delphi cekTutupPeriode) ────────
const cekTutupPeriode = async (tanggal) => {
  const d = new Date(tanggal);
  const bulan = d.getMonth() + 1;
  const tahun = d.getFullYear();
  const [[row]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [bulan, tahun]
  );
  return !!row;
};

// ── Cek tanggal (paritas Delphi cekTanggal: maks +1 / -2 hari dari server) ──
const cekTanggal = async (tanggal) => {
  const tgl = new Date(tanggal);
  const now = new Date();
  const tglD = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate());
  const nowD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((tglD - nowD) / 86400000);
  return diffDays <= 1 && diffDays >= -2;
};

// ── Update status DO setelah FP disimpan (paritas Delphi sp_update_do_hdr) ──
const syncDoHdr = async (nomorDO) => {
  if (!nomorDO) return;
  try {
    const [[proc]] = await db.query(
      `SELECT ROUTINE_NAME FROM information_schema.ROUTINES
       WHERE ROUTINE_NAME = 'sp_update_do_hdr'
         AND ROUTINE_SCHEMA = DATABASE() LIMIT 1`
    );
    if (!proc) return;
    await db.query(`CALL sp_update_do_hdr(?)`, [nomorDO]);
  } catch (e) {
    console.warn("⚠️ Gagal sp_update_do_hdr:", e.message);
  }
};

// ── Hitung HPP freeze barang (Opsi 2) ────────────────────────────────
// Cost saat barang keluar = SUM(mst_stok_out × mst_hargabeli) atas SEMUA
// DO milik SO (1 SO = banyak pengiriman), per (brg + expired).
//
// Idealnya nilai per baris tfp_dtl = konterpart brg + expired-nya sendiri.
// Dipanggil DI LUAR loop baris detail (sekali per FP) karena hasilnya Map;
// kalau dihitung per brg lalu disalin ke tiap baris detail yang brg-nya sama
// (beda expired), HPP dobel. Dipakai dalam transaksi saveData (conn).
const hitungHppMap = async (conn, nomorSO) => {
  const [rows] = await conn.query(
    `SELECT m.mst_brg_kode AS brg,
            DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
            COALESCE(SUM(m.mst_stok_out * m.mst_hargabeli), 0) AS hpp
     FROM tmasterstok m
     INNER JOIN tdo_hdr do ON do.do_nomor = m.mst_noreferensi
     WHERE do.do_so_nomor = ?
     GROUP BY m.mst_brg_kode, DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d')`,
    [nomorSO]
  );
  const map = new Map();
  for (const r of rows) map.set(`${r.brg}|${r.expired}`, Number(r.hpp));
  return map;
};

// Key baris detail untuk hitungHppMap. expired kosong (= barang tanpa tanggal
// kedaluwarsa) dipetakan ke 1899-12-30, konvensi tmasterstok.
const hppKey = (brgKode, expired) => {
  const exp = (expired || "").slice(0, 10) || "1899-12-30";
  return `${brgKode}|${exp}`;
};

// ── DO terakhir milik SO ─────────────────────────────────────────────
// 1 SO = 1 invoice; fp_do_nomor diisi dengan PENGIRIMAN terakhir (DO)
// milik SO — konsisten dgn getMarginData (do_tanggal DESC, do_nomor DESC).
const getLastDoSO = async (conn, nomorSO) => {
  if (!nomorSO) return "";
  const [[r]] = await conn.query(
    `SELECT do_nomor FROM tdo_hdr
      WHERE do_so_nomor = ?
      ORDER BY do_tanggal DESC, do_nomor DESC LIMIT 1`,
    [nomorSO]
  );
  return r?.do_nomor || "";
};

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, nomorSO, tanggal, jthTempo, memo, cusKode,
    isTax, isEcer, isCatalog, tipecash, isDTP,
    discFakturPr, discFaktur, biayaPr, biayaRp, freight,
    amount, taxAmount, dp, cn, detail,
  } = payload;

  // Paritas Delphi cxButton1Click: blok bila periode sudah ditutup
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }
  // Paritas Delphi: cekTanggal hanya untuk transaksi baru
  if (!isEdit && !(await cekTanggal(tanggal))) {
    throw new Error("Tanggal tidak boleh terlalu jauh dari tanggal hari ini.");
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // fp_do_nomor diisi DO terakhir milik SO (1 SO = 1 invoice)
    const nomorDO = await getLastDoSO(conn, nomorSO);
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tfp_hdr SET
           fp_cus_kode = ?, fp_so_nomor = ?, fp_do_nomor = ?, fp_memo = ?,
           fp_isecer = ?, fp_disc_faktur = ?, fp_disc_fakturpr = ?,
           fp_biayapr = ?, fp_biayarp = ?, fp_freight = ?,
           fp_amount = ?, fp_taxamount = ?, fp_istax = ?,
           fp_iscatalog = ?, fp_jthtempo = ?, fp_dp = ?, fp_cn = ?,
           fp_tipecash = ?, fp_isDTP = ?,
           date_modified = NOW(), user_modified = ?
         WHERE fp_nomor = ?`,
        [
          cusKode, nomorSO, nomorDO, memo, isEcer, discFaktur, discFakturPr,
          biayaPr, biayaRp, freight, amount, taxAmount, isTax,
          isCatalog, jthTempo, dp, cn, tipecash, isDTP,
          user.kode, nomor,
        ]
      );
    } else {
      // Divisi diwarisi dari SO (prefix nomor FP)
      const [[soRow]] = await conn.query(
        `SELECT so_div_kode FROM tso_hdr WHERE so_nomor = ?`,
        [nomorSO]
      );
      const divKode = soRow?.so_div_kode || "";
      actualNomor = await getMaxNomor(tanggal, isTax, divKode);
      await conn.query(
        `INSERT INTO tfp_hdr
           (fp_nomor, fp_so_nomor, fp_do_nomor, fp_tanggal, fp_jthtempo, fp_memo, fp_cus_kode,
            fp_disc_faktur, fp_disc_fakturpr, fp_biayapr, fp_biayarp, fp_amount,
            fp_taxamount, fp_freight, fp_istax, fp_iscatalog, fp_dp, fp_cn,
            fp_tipecash, fp_isDTP, fp_isecer, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, nomorSO, nomorDO, tanggal, jthTempo, memo, cusKode,
          discFaktur, discFakturPr, biayaPr, biayaRp, amount,
          taxAmount, freight, isTax, isCatalog, dp, cn,
          tipecash, isDTP, isEcer, user.kode,
        ]
      );
    }

    // Di luar header: update qty SO sudah di-invoice, selaras dengan detail yang disimpan
    // (kurangi qty lama FP ini dulu bila edit, lalu tambah qty baru).
    if (nomorSO) {
      const before = isEdit
        ? await conn.query(
            `SELECT fpd_brg_kode AS brgKode, fpd_qty AS qty FROM tfp_dtl WHERE fpd_fp_nomor = ?`,
            [nomor]
          )
        : [[], []];
      for (const od of before[0] || []) {
        await conn.query(
          `UPDATE tso_dtl SET sod_qty_invoice = GREATEST(0, sod_qty_invoice - ?)
           WHERE sod_so_nomor = ? AND sod_brg_kode = ?`,
          [Number(od.qty) || 0, nomorSO, od.brgKode]
        );
      }
    }

    await conn.query(`DELETE FROM tfp_dtl WHERE fpd_fp_nomor = ?`, [actualNomor]);

    // HPP freeze sekali per FP (Map per brg+expired), agar baris detail dengan
    // SKU sama tapi expired beda tidak dobel menghitung HPP.
    const hppMap = nomorSO ? await hitungHppMap(conn, nomorSO) : new Map();

    let nourut = 1;
    for (const d of detail) {
      // Paritas Delphi simpandata: kolom biaya/fee (fpd_bp_*) tidak disimpan, default DB = 0
      const hpp = nomorSO && Number(d.qty) > 0 ? hppMap.get(hppKey(d.brgKode, d.expired)) || 0 : 0;
      await conn.query(
        `INSERT INTO tfp_dtl
           (fpd_fp_nomor, fpd_brg_kode, fpd_idbatch, fpd_brg_satuan, fpd_qty,
            fpd_discpr, fpd_harga, fpd_nourut, fpd_expired, fpd_cn,
            fpd_gdg_kode, fpd_hrg_min, fpd_hpp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, d.brgKode, d.idBatch, d.satuan, d.qty,
          d.discPr, d.harga, nourut, d.expired, d.cn,
          d.gudang, d.hrgMin, hpp,
        ]
      );
      nourut++;
    }

    // Catat qty baru ke tso_dtl.sod_qty_invoice + tandai SO sudah di-invoice
    if (nomorSO) {
      await conn.query(
        `UPDATE tso_hdr SET so_isinvoice = 1 WHERE so_nomor = ?`,
        [nomorSO]
      );
      for (const d of detail) {
        if (!d.brgKode || !Number(d.qty)) continue;
        await conn.query(
          `UPDATE tso_dtl SET sod_qty_invoice = sod_qty_invoice + ?
           WHERE sod_so_nomor = ? AND sod_brg_kode = ?`,
          [Number(d.qty), nomorSO, d.brgKode]
        );
      }
    }

    // Catat otorisasi yang terpakai pada dokumen final (link audit) —
    // tabel totorisasi GLOBAL di database pusat (DB_NAME)
    const otorisasiKode = (detail || [])
      .map((d) => d.otorisasiKode)
      .filter((k) => k);
    if (otorisasiKode.length) {
      await db.systemPool.query(
        `UPDATE totorisasi SET ref_nomor = ?
         WHERE kode IN (?)`,
        [actualNomor, otorisasiKode]
      );
    }

    await conn.commit();

    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const getRiwayatHarga = async (brgKode, cusKode, excludeNomor = "") => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT brg_nama AS Nama, fpd_harga AS Harga, fpd_discpr AS Disc,
              DATE_FORMAT(fpd_expired, '%Y-%m-%d') AS Expired, DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS Tanggal, fpd_qty AS Qty
       FROM tfp_dtl
       INNER JOIN tbarang ON brg_kode = fpd_brg_kode
       INNER JOIN tfp_hdr ON fpd_fp_nomor = fp_nomor
       WHERE fp_nomor <> ?
         AND brg_kode = ?
         AND fp_cus_kode = ?
       ORDER BY fp_tanggal DESC
       LIMIT 50`,
      [excludeNomor, brgKode, cusKode]
    );
    return rows;
  } finally {
    conn.release();
  }
};

// ── Get DP ───────────────────────────────────────────────────────────
// Paritas Delphi chkDPClick: sisa DP = so_dp - sum(fp_dp) FPs lain pada SO
// yang sama (FP sendiri dikecualikan via excludeNomor).
const getDP = async (nomorSO, excludeNomor = "") => {
  const [[so]] = await db.query(
    `SELECT so_nomor, so_dp
     FROM tso_hdr
     WHERE so_nomor = ? LIMIT 1`,
    [nomorSO]
  );

  if (!so) return 0;

  const [[sumDP]] = await db.query(
    `SELECT IFNULL(SUM(fp_dp), 0) AS total
     FROM tfp_hdr fp
     WHERE fp_so_nomor = ? AND fp.fp_nomor <> ?`,
    [so.so_nomor, excludeNomor]
  );

  return Number(so.so_dp || 0) - Number(sumDP?.total || 0);
};

// ── Get CN faktur (paritas Delphi chkCNClick) ────────────────────────
// Persen potong invoice dari tpiutangcn untuk customer & tanggal transaksi.
const getCNFaktur = async (cusKode, tanggal) => {
  const [[row]] = await db.query(
    `SELECT cn_potong_invoice FROM tpiutangcn
     WHERE cn_cus_kode = ? AND cn_startdate <= ? AND cn_enddate >= ?
     LIMIT 1`,
    [cusKode, tanggal, tanggal]
  );
  return Number(row?.cn_potong_invoice || 0);
};

// ── Data validasi margin/HET (paritas Delphi cekdata ufrmFP) ─────────
// lastcost = mst_hargabeli baris stok milik DO PENGIRIMAN TERAKHIR dari
//   SO sumber (barang dari SO → dicari lewat DO terakhir yang memuatnya).
// hET      = brg_harga_min (0 bila <= 0, seperti gethargamin)
// minMargin= tsetting 'MRG'; null bila barang terdaftar di tbarangkhusus
// isSample = customer sample (cus_nama like '%sample%')
// mtciLastcost = lastcost terakhir referensi MTCI/KOR (warning saja di Delphi)
const getMarginData = async (brgKode, expired, nomorSO, cusKode) => {
  const expiredCond = expired
    ? "mst_expired_date = ?"
    : "IFNULL(YEAR(mst_expired_date), 0) < 1900";

  const [[lc]] = await db.query(
    `SELECT m.mst_hargabeli
     FROM tmasterstok m
     INNER JOIN (
       SELECT do.do_nomor
       FROM tdo_hdr do
       INNER JOIN tdo_dtl d ON d.dod_do_nomor = do.do_nomor
       WHERE do.do_so_nomor = ? AND d.dod_brg_kode = ?
       ORDER BY do.do_tanggal DESC, do.do_nomor DESC
       LIMIT 1
     ) last_do ON m.mst_noreferensi = last_do.do_nomor
     WHERE m.mst_brg_kode = ? AND ${expiredCond}
     LIMIT 1`,
    expired
      ? [nomorSO, brgKode, brgKode, expired]
      : [nomorSO, brgKode, brgKode]
  );

  const [[brg]] = await db.query(
    `SELECT brg_harga_min FROM tbarang WHERE brg_kode = ? LIMIT 1`,
    [brgKode]
  );

  const [[khusus]] = await db.query(
    `SELECT 1 FROM tbarangkhusus WHERE brg_kode = ? LIMIT 1`,
    [brgKode]
  );

  let minMargin = 0;
  if (!khusus) {
    const [[mrg]] = await db.query(
      `SELECT SET_TGL FROM tsetting WHERE set_kode = 'MRG' LIMIT 1`
    );
    minMargin = Number(mrg?.SET_TGL || 0);
  }
  // Paritas getminimalmargin: barang khusus → threshold 0 (getminimalmargin
  // mengembalikan 0), artinya hanya blok bila margin negatif.

  const [[sample]] = await db.query(
    `SELECT COUNT(*) AS c FROM tcustomer
     WHERE cus_nama LIKE '%sample%' AND cus_kode = ?`,
    [cusKode || ""]
  );

  const [[mtci]] = await db.query(
    `SELECT IFNULL(MST_HARGABELI, 0) AS harga FROM tmasterstok
     WHERE mst_brg_kode = ? AND mst_hargabeli > 1
       AND (mst_noreferensi LIKE '%MTCI%' OR mst_noreferensi LIKE '%KOR%')
     ORDER BY mst_tanggal DESC LIMIT 1`,
    [brgKode]
  );

  return {
    lastcost: Number(lc?.mst_hargabeli || 0),
    hET: Number(brg?.brg_harga_min) > 0 ? Number(brg.brg_harga_min) : 0,
    minMargin,
    isSample: Number(sample?.c || 0) > 0,
    mtciLastcost: Number(mtci?.harga || 0),
  };
};

module.exports = {
  getMaxNomor,
  searchSO,
  loadSO,
  getDiscCN,
  getTop,
  getNilaiRetur,
  getDP,
  getDetailForm,
  saveData,
  getRiwayatHarga,
  getMarginData,
  getCNFaktur,
};