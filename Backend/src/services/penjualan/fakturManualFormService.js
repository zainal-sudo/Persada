// services/penjualan/fakturManualFormService.js
const db = require("../../config/database");

// ── Search SO ────────────────────────────────────────────────────────
// Faktur Manual: SO yang SUDAH closed DAN sudah di-invoice (so_isinvoice=1) —
// nomor faktur diambil dari FP utama yang sudah ada.
const searchSO = async (search = "") => {
  const [rows] = await db.query(
    `SELECT so_nomor AS nomor, DATE_FORMAT(so_tanggal, '%Y-%m-%d') AS tanggal,
            c.cus_nama AS customer
     FROM tso_hdr so
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_isclosed = 1 AND so.so_isinvoice = 1
       AND (so.so_nomor LIKE ? OR c.cus_nama LIKE ?)
     ORDER BY so.so_tanggal DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load SO ──────────────────────────────────────────────────────────
const loadSO = async (nomorSO) => {
  const [[h]] = await db.query(
    `SELECT so.so_nomor, so.so_cus_kode, so.so_istax,
       so.so_disc_faktur, so.so_disc_fakturpr,
       c.cus_nama, c.cus_alamat, c.cus_telp, c.cus_top
     FROM tso_hdr so
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_nomor = ? LIMIT 1`,
    [nomorSO]
  );
  if (!h) throw new Error("SO tidak ditemukan.");

  // Nomor faktur = FP utama yang sudah ada untuk SO ini
  const [[existingFP]] = await db.query(
    `SELECT fp_nomor FROM tfp_hdr WHERE fp_so_nomor = ? LIMIT 1`,
    [nomorSO]
  );
  const nomorFP = existingFP?.fp_nomor || "";

  // Sama seperti fpFormService.loadSO: dibungkus + difilter qty > 0.
  // Tanpa filter, barang yang ada di SO tapi belum pernah dikirim tetap dapat
  // baris dengan qty 0, karena sumbernya tso_dtl sementara qty-nya dihitung
  // subquery dari tdo_dtl yang memakai COALESCE(...,0).
  const [detailRows] = await db.query(
    `SELECT x.brgKode, x.brgNama, x.satuan, x.qty, x.harga, x.discPr
     FROM (
       SELECT b.brg_kode AS brgKode,
              b.brg_nama AS brgNama,
              d.sod_brg_satuan AS satuan,
              (COALESCE((
                  SELECT SUM(dd.dod_qty) FROM tdo_dtl dd
                  INNER JOIN tdo_hdr hh ON hh.do_nomor = dd.dod_do_nomor
                  WHERE hh.do_so_nomor = d.sod_so_nomor AND dd.dod_brg_kode = d.sod_brg_kode
              ), 0) - IFNULL(d.sod_qty_invoice, 0)) AS qty,
              d.sod_harga AS harga,
              d.sod_discpr AS discPr,
              d.sod_nourut AS nourut
       FROM tso_dtl d
       INNER JOIN tbarang b ON b.brg_kode = d.sod_brg_kode
       WHERE d.sod_so_nomor = ?
     ) x
     WHERE x.qty > 0
     ORDER BY x.nourut ASC`,
    [nomorSO]
  );

  const detail = detailRows.map((d) => {
    const qty = Number(d.qty) || 0;
    const harga = Number(d.harga) || 0;
    const discPr = Number(d.discPr) || 0;
    const total = qty * harga * (100 - discPr) / 100;

    return {
      brgKode: d.brgKode,
      brgNama: d.brgNama,
      qty,
      satuan: d.satuan,
      idBatch: "",
      harga,
      discPr,
      total,
      expired: "",
      kurang: qty,
      cn: 0,
      nilaiCN: 0,
      gudang: "",
    };
  });

  return {
    nomorSO: h.so_nomor,
    nomorFP,
    isTax: h.so_istax,
    cusKode: h.so_cus_kode,
    cusNama: h.cus_nama,
    alamat: h.cus_alamat,
    telp: h.cus_telp,
    top: h.cus_top || 0,
    discFakturPr: h.so_disc_fakturpr || 0,
    discFaktur: h.so_disc_faktur || 0,
    detail,
  };
};

// ── Search Barang ────────────────────────────────────────────────────
const searchBarang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT brg_kode AS kode, brg_nama AS nama, brg_satuan AS satuan
     FROM tbarang
     WHERE brg_nama LIKE ? OR brg_kode LIKE ?
     ORDER BY brg_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get Top ──────────────────────────────────────────────────────────
const getTop = async (cusKode) => {
  const [[row]] = await db.query(
    `SELECT cus_top FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [cusKode]
  );
  return Number(row?.cus_top || 0);
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT fp_nomor AS nomor, DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
            fp_do_nomor AS nomorDO, COALESCE(fp_so_nomor, '') AS nomorSO,
            DATE_FORMAT(fp_jthtempo, '%Y-%m-%d') AS jthTempo,
            fp_cus_kode AS cusKode, fp_memo AS memo,
            fp_istax AS isTax, fp_disc_fakturpr AS discFakturPr,
            fp_disc_faktur AS discFaktur, fp_freight AS freight,
            fp_amount AS amount, fp_taxamount AS taxAmount,
            fp_dp AS dp, fp_cn AS cn
     FROM tfp_hdr_bayangan WHERE fp_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("Data tidak ditemukan.");

  // Cek apakah faktur sudah dibayar (paritas cekbayar Delphi)
  const [[bayarRow]] = await db.query(
    `SELECT fp_isbayar FROM tfp_hdr WHERE fp_nomor = ? LIMIT 1`, [nomor]);
  const locked = Number(bayarRow?.fp_isbayar || 0) === 1;

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat, cus_telp FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  const [details] = await db.query(
    `SELECT fpd_brg_kode AS brgKode, fpd_brg_nama AS brgNama,
            fpd_brg_satuan AS satuan, fpd_idbatch AS idBatch,
            fpd_qty AS qty, fpd_harga AS harga,
            fpd_discpr AS discPr,
            ROUND(fpd_harga * fpd_qty * (100 - IFNULL(fpd_discpr,0)) / 100, 2) AS total,
            DATE_FORMAT(fpd_expired, '%Y-%m-%d') AS expired,
            fpd_cn AS cn, fpd_gdg_kode AS gudang
     FROM tfp_dtl_bayangan
     WHERE fpd_fp_nomor = ?
     ORDER BY fpd_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    telp: customer?.cus_telp || "",
    locked,
    detail: details.map((d) => ({
      ...d,
      kurang: Number(d.qty),
      nilaiCN: Number(d.cn || 0) * Number(d.total || 0) / 100,
    })),
  };
};

// ── DO terakhir milik SO (sama seperti FP form) ──────────────────────
// 1 SO = 1 invoice; fp_do_nomor diisi dengan pengiriman (DO) terakhir milik SO.
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
    isEdit, nomor, tanggal, nomorSO, jthTempo, cusKode, memo,
    isTax, discFakturPr, discFaktur, freight, amount, taxAmount,
    dp, cn, detail,
  } = payload;

  // ── Validasi (paritas cekdata Delphi) ──────────────────────────────
  // 1. cekTutupPeriode
  const dTgl = new Date(tanggal);
  const [[periode]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [dTgl.getMonth() + 1, dTgl.getFullYear()]
  );
  if (periode) throw new Error("Periode ini sudah di tutup.");

  // 2. Customer wajib
  if (!cusKode) throw new Error("Customer belum di pilih.");

  // 3. SKU wajib per baris qty>0
  for (const d of detail || []) {
    if (Number(d.qty) > 0 && !Number(d.brgKode)) {
      throw new Error("SKU Baris belum dipilih");
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Faktur bayangan: fp_do_nomor diisi DO terakhir milik SO (1 SO = 1 invoice)
    const nomorDO = await getLastDoSO(conn, nomorSO);

    if (isEdit) {
      await conn.query(
        `UPDATE tfp_hdr_bayangan SET
           fp_cus_kode = ?, fp_so_nomor = ?, fp_do_nomor = ?, fp_memo = ?,
           fp_disc_faktur = ?, fp_disc_fakturpr = ?,
           fp_freight = ?, fp_amount = ?, fp_taxamount = ?,
           fp_istax = ?, fp_jthtempo = ?, fp_dp = ?, fp_cn = ?,
           date_modified = NOW(), user_modified = ?
         WHERE fp_nomor = ?`,
        [cusKode, nomorSO, nomorDO, memo, discFaktur, discFakturPr,
         freight, amount, taxAmount, isTax, jthTempo, dp, cn,
         user.kode, nomor]
      );
    } else {
      await conn.query(
        `INSERT INTO tfp_hdr_bayangan
           (fp_nomor, fp_so_nomor, fp_do_nomor, fp_tanggal, fp_jthtempo, fp_memo, fp_cus_kode,
            fp_disc_faktur, fp_disc_fakturpr, fp_amount, fp_taxamount,
            fp_freight, fp_istax, fp_dp, fp_cn, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [nomor, nomorSO, nomorDO, tanggal, jthTempo, memo, cusKode,
         discFaktur, discFakturPr, amount, taxAmount,
         freight, isTax, dp, cn, user.kode]
      );
    }

    await conn.query(`DELETE FROM tfp_dtl_bayangan WHERE fpd_fp_nomor = ?`, [nomor]);

    let nourut = 1;
    for (const d of detail) {
      await conn.query(
        `INSERT INTO tfp_dtl_bayangan
           (fpd_fp_nomor, fpd_brg_kode, fpd_brg_nama, fpd_brg_satuan,
            fpd_idbatch, fpd_qty, fpd_discpr, fpd_harga, fpd_nourut,
            fpd_expired, fpd_cn, fpd_gdg_kode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nomor, d.brgKode, d.brgNama, d.satuan, d.idBatch,
         d.qty, d.discPr, d.harga, nourut, d.expired, d.cn, d.gudang]
      );
      nourut++;
    }

    await conn.commit();
    return { nomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── DP auto dari SO (paritas chkDPClick Delphi) ──────────────────
const getDP = async (nomorSO, nomorFP) => {
  const [[soRow]] = await db.query(
    `SELECT so_nomor, so_dp FROM tso_hdr
     WHERE so_nomor = ? LIMIT 1`, [nomorSO]);
  if (!soRow) return 0;

  // Total dp dari FP bayangan lain utk SO sama
  const [[dpRow]] = await db.query(
    `SELECT IFNULL(SUM(h.fp_dp), 0) AS totalDp
     FROM tfp_hdr_bayangan h
     WHERE h.fp_so_nomor = ? AND h.fp_nomor <> ?`,
    [soRow.so_nomor, nomorFP || ""]);

  return Number(soRow.so_dp || 0) - Number(dpRow?.totalDp || 0);
};

// ── CN faktur-level dari tpiutangcn (paritas chkCNClick Delphi) ─────
const getCN = async (cusKode, tanggal) => {
  const [[row]] = await db.query(
    `SELECT cn_potong_invoice FROM tpiutangcn
     WHERE cn_cus_kode = ? AND cn_startdate <= ? AND cn_enddate >= ?
     LIMIT 1`,
    [cusKode, tanggal, tanggal]);
  return Number(row?.cn_potong_invoice || 0);
};

// ── Lookup harga faktur lain (paritas clHargaPropertiesButtonClick) ──
const getHargaHistori = async (brgKode, cusKode, nomorFP) => {
  const [rows] = await db.query(
    `SELECT b.brg_nama AS Nama, d.fpd_harga AS Harga, d.fpd_discpr AS Disc,
            DATE_FORMAT(d.fpd_expired, '%Y-%m-%d') AS Expired,
            DATE_FORMAT(h.fp_tanggal, '%Y-%m-%d') AS Tanggal, d.fpd_qty AS Qty
     FROM tfp_dtl_bayangan d
     INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     INNER JOIN tfp_hdr_bayangan h ON h.fp_nomor = d.fpd_fp_nomor
     WHERE d.fpd_fp_nomor <> ?
       AND d.fpd_brg_kode = ?
       AND h.fp_cus_kode = ?
     ORDER BY h.fp_tanggal DESC LIMIT 20`,
    [nomorFP || "", brgKode, cusKode]);
  return rows;
};

module.exports = {
  searchSO,
  loadSO,
  searchBarang,
  getTop,
  getDetailForm,
  saveData,
  getDP,
  getCN,
  getHargaHistori,
};