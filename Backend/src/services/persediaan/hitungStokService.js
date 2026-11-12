const db = require("../../config/database");

/**
 * Browse Hitung Stok — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.hit_nomor AS Nomor,
       DATE_FORMAT(h.hit_tanggal, '%Y-%m-%d') AS Tanggal,
       g.gdg_nama AS Gudang,
       IFNULL(h.hit_lokasi, '') AS Lokasi
     FROM thitungstok h
     INNER JOIN tgudang g ON g.gdg_kode = h.hit_gdg_kode
     WHERE h.hit_tanggal BETWEEN ? AND ?
     GROUP BY h.hit_nomor
     ORDER BY h.hit_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Hitung Stok — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.hitd_hit_nomor AS Nomor,
       d.hitd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.hitd_qty AS Jumlah,
       d.hitd_satuan AS Satuan,
       DATE_FORMAT(d.hitd_expired, '%Y-%m-%d') AS Expired
     FROM thitungstok_dtl d
     INNER JOIN thitungstok h ON h.hit_nomor = d.hitd_hit_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.hitd_brg_kode
     WHERE d.hitd_hit_nomor = ?
     ORDER BY d.hitd_nourut`,
    [nomor]
  );
  return rows;
};

/**
 * Delete Hitung Stok — paritas cxButton4 Delphi (hapus dtl lalu hdr).
 */
const deleteData = async (nomor) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM thitungstok_dtl WHERE hitd_hit_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM thitungstok WHERE hit_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getBrowse, getBrowseDetail, deleteData };