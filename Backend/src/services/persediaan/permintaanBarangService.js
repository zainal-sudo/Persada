const db = require("../../config/database");

/**
 * Browse Permintaan Barang — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       pb_nomor AS Nomor,
       DATE_FORMAT(pb_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(pb_memo, '') AS Memo,
       IF(pb_isclosed = 0, 'Belum', 'Sudah') AS Closed,
       IFNULL(user_create, '') AS User,
       DATE_FORMAT(date_create, '%Y-%m-%d %H:%i:%s') AS date_create
     FROM tpermintaanbarang_hdr
     WHERE pb_tanggal BETWEEN ? AND ?
     GROUP BY pb_nomor, pb_tanggal, pb_memo
     ORDER BY pb_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Permintaan Barang — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       a.pbd_pb_nomor AS Nomor,
       a.pbd_brg_kode AS SKU,
       c.brg_nama AS NamaBarang,
       a.pbd_satuan AS Satuan,
       a.pbd_qty AS QTY,
       a.pbd_qtyterima AS QtyTerima,
       a.pbd_stoknow AS StokNow,
       a.pbd_avgsale AS AvgSale
     FROM tpermintaanbarang_dtl a
     INNER JOIN tpermintaanbarang_hdr b ON b.pb_nomor = a.pbd_pb_nomor
     INNER JOIN tbarang c ON c.brg_kode = a.pbd_brg_kode
     WHERE a.pbd_pb_nomor = ?
     ORDER BY a.pbd_brg_kode`,
    [nomor]
  );
  return rows;
};

/**
 * Delete Permintaan Barang — paritas cxButton4 Delphi (hapus dtl lalu hdr).
 */
const deleteData = async (nomor) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tpermintaanbarang_dtl WHERE pbd_pb_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tpermintaanbarang_hdr WHERE pb_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/**
 * Toggle Closed — paritas btn1 Delphi (flip pb_isclosed 0/1).
 */
const toggleClosed = async (nomor) => {
  const [[hdr]] = await db.query(
    `SELECT pb_isclosed FROM tpermintaanbarang_hdr WHERE pb_nomor = ?`,
    [nomor]
  );
  if (!hdr) throw new Error("Permintaan barang tidak ditemukan.");
  const next = Number(hdr.pb_isclosed) === 1 ? 0 : 1;
  await db.query(
    `UPDATE tpermintaanbarang_hdr SET pb_isclosed = ? WHERE pb_nomor = ?`,
    [next, nomor]
  );
  return { closed: next };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, toggleClosed };