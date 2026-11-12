// services/pembelian/returBeliService.js
const db = require("../../config/database");

/**
 * Browse Retur Beli — paritas Delphi ufrmBrowseReturBeli.btnRefreshClick
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.ret_nomor AS Nomor,
       DATE_FORMAT(h.ret_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.ret_memo, '') AS Memo,
       IFNULL(s.sup_nama, '') AS Supplier,
       IFNULL(h.ret_amount, 0) AS Total,
       IFNULL(h.ret_taxamount, 0) AS Ppn,
       h.ret_inv_nomor AS Invoice
     FROM tret_hdr h
     INNER JOIN tinv_hdr i ON i.inv_nomor = h.ret_inv_nomor
     INNER JOIN tsupplier s ON s.sup_kode = i.inv_sup_kode
     WHERE h.ret_tanggal BETWEEN ? AND ?
     GROUP BY h.ret_nomor, h.ret_tanggal, h.ret_memo, s.sup_nama
     ORDER BY h.ret_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Retur Beli — paritas Delphi SQLDetail
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.retd_ret_nomor AS Nomor,
       d.retd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.retd_brg_satuan AS Satuan,
       d.retd_qty AS Jumlah,
       d.retd_harga AS Harga,
       d.retd_discpr AS Disc,
       ROUND(d.retd_harga * d.retd_qty * (100 - IFNULL(d.retd_discpr, 0)) / 100, 2) AS Nilai,
       IFNULL(d.retd_idbatch, '') AS IDBatch
     FROM tret_dtl d
     INNER JOIN tret_hdr h ON h.ret_nomor = d.retd_ret_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.retd_brg_kode
     WHERE d.retd_ret_nomor = ?
     ORDER BY d.retd_nourut ASC`,
    [nomor]
  );
  return rows;
};

/**
 * Hapus Retur Beli — urutan: DELETE tret_dtl → DELETE tret_hdr.
 */
const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT ret_nomor FROM tret_hdr WHERE ret_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data Retur Beli tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tret_dtl WHERE retd_ret_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tret_hdr WHERE ret_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data print (slip Retur Beli — paritas doslipRet Delphi) ──────────
const getPrintData = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       h.ret_nomor AS nomor,
       DATE_FORMAT(h.ret_tanggal, '%d/%m/%Y') AS tanggal,
       h.ret_inv_nomor AS atasInvoice,
       h.ret_amount AS atotal,
       h.ret_taxamount AS appn,
       h.ret_disc_faktur AS discFaktur,
       h.ret_disc_fakturpr AS discFakturPr,
       s.sup_nama AS supNama,
       s.sup_alamat AS supAlamat,
       terbilang(h.ret_amount) AS terbilang,
       d.retd_brg_kode AS kode,
       b.brg_nama AS nama,
       d.retd_brg_satuan AS satuan,
       d.retd_qty AS qty,
       d.retd_discpr AS discpr,
       d.retd_harga AS harga,
       ROUND(d.retd_harga * d.retd_qty * (100 - IFNULL(d.retd_discpr, 0)) / 100, 2) AS total,
       IFNULL(d.retd_nourut, 1000) AS nourut
     FROM tret_hdr h
     INNER JOIN tinv_hdr i ON i.inv_nomor = h.ret_inv_nomor
     INNER JOIN tsupplier s ON s.sup_kode = h.ret_sup_kode
     LEFT JOIN tret_dtl d ON d.retd_ret_nomor = h.ret_nomor
     LEFT JOIN tbarang b ON b.brg_kode = d.retd_brg_kode
     WHERE h.ret_nomor = ?
     ORDER BY nourut`,
    [nomor]
  );

  if (rows.length === 0) throw new Error("Data Retur Beli tidak ditemukan.");

  const h = rows[0];
  const anilai = Number(h.atotal || 0) - Number(h.appn || 0);
  const adiscfaktur = ((Number(h.discFakturPr || 0) * anilai) / 100) + Number(h.discFaktur || 0);

  // Data perusahaan
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama AS nama, perush_alamat AS alamat, perush_kota AS kota, perush_notelp AS notelp
     FROM tperusahaan LIMIT 1`
  );

  // Baris slip
  const [[slip]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = 'RET' LIMIT 1`
  );

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    atasInvoice: h.atasInvoice,
    supNama: h.supNama,
    supAlamat: h.supAlamat,
    baris: Number(slip?.baris || 20),
    terbilang: h.terbilang || "",
    discFakturPr: Number(h.discFakturPr || 0),
    discFaktur: Number(h.discFaktur || 0),
    adiscfaktur,
    anilai,
    appn: Number(h.appn || 0),
    atotal: Number(h.atotal || 0),
    perusahaan: perusahaan || { nama: "", alamat: "", kota: "", notelp: "" },
    detail: rows.filter(r => r.kode).map((r, i) => ({
      no: i + 1,
      kode: r.kode,
      nama: r.nama || "",
      satuan: r.satuan || "",
      qty: Number(r.qty || 0),
      discpr: Number(r.discpr || 0),
      harga: Number(r.harga || 0),
      total: Number(r.total || 0),
    })),
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };
