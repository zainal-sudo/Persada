// services/penjualan/serahTerimaFakturSalesmanService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.sth2_nomor AS Nomor,
       DATE_FORMAT(h.sth2_tanggal, '%Y-%m-%d') AS Tanggal,
       h.sth2_sls_kode AS SlsKode,
       IFNULL(h.sth2_memo, '') AS Note
     FROM tserahterimafaktur_hdr2 h
     WHERE h.sth2_tanggal BETWEEN ? AND ?
     ORDER BY h.sth2_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.std2_sth2_nomor AS Nomor,
       d.std2_fp_nomor AS Faktur,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(fp.fp_amount, 0) AS Nilai,
       IFNULL(c.cus_nama, '') AS Customer
     FROM tserahterimafaktur_dtl2 d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.std2_fp_nomor
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     WHERE d.std2_sth2_nomor = ?
     ORDER BY d.std2_sth2_nomor ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT sth2_nomor FROM tserahterimafaktur_hdr2 WHERE sth2_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tserahterimafaktur_dtl2 WHERE std2_sth2_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tserahterimafaktur_hdr2 WHERE sth2_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getBrowse, getBrowseDetail, deleteData };