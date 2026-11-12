// services/penjualan/fakturPajakService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.fp_nomor AS Nomor,
       DATE_FORMAT(h.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.fp_memo, '') AS Memo,
       IFNULL(s.sls_nama, '') AS Salesman,
       IFNULL(c.cus_nama, '') AS Customer,
       IFNULL(h.fp_amount, 0) AS Total,
       IFNULL(h.fp_taxamount, 0) AS Ppn,
       ROUND(((h.fp_disc_fakturpr * (((h.fp_amount - h.fp_taxamount) + h.fp_disc_faktur) / (100 - h.fp_disc_fakturpr) * 100)) / 100) + h.fp_disc_faktur, 2) AS Disc_Faktur,
       IFNULL(h.fp_fakturpajak, '') AS FakturPajak,
       DATE_FORMAT(h.fp_tanggalpajak, '%Y-%m-%d') AS TglPajak,
       IFNULL(h.Ismanual, '') AS Ismanual,
       DATE_FORMAT(h.date_create, '%Y-%m-%d %H:%i:%s') AS date_create
       FROM tfakturpajak_hdr h
       INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
       LEFT JOIN tso_hdr sh ON sh.so_nomor = h.fp_so_nomor
       LEFT JOIN tsalesman s ON s.sls_kode = sh.so_sls_kode
     WHERE h.date_create BETWEEN ? AND ?
     GROUP BY h.fp_nomor, h.fp_tanggal, h.fp_memo, c.cus_nama
     ORDER BY h.fp_fakturpajak`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.fpd_fp_nomor AS Nomor,
       d.fpd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.fpd_brg_satuan AS Satuan,
       d.fpd_qty AS Jumlah,
       d.fpd_harga AS Harga,
       d.fpd_discpr AS Disc,
       ROUND(d.fpd_harga * d.fpd_qty * (100 - IFNULL(d.fpd_discpr, 0)) / 100, 2) AS Nilai
     FROM tfakturpajak_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE d.fpd_fp_nomor = ?
       AND d.fpd_qty > 0
     ORDER BY d.fpd_nourut ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT fp_nomor FROM tfakturpajak_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tfakturpajak_dtl WHERE fpd_fp_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tfakturpajak_hdr WHERE fp_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getBrowse, getBrowseDetail, deleteData };