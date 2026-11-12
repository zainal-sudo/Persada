const db = require("../../config/database");

/**
 * Browse Kendaraan — sesuai SQLMaster Delphi:
 * SELECT kend_nopol, kend_merk, kend_tipe, kend_bagian, kend_pic, kend_cabang
 * FROM tkendaraan
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       kend_nopol,
       IFNULL(kend_merk, '') AS kend_merk,
       IFNULL(kend_tipe, '') AS kend_tipe,
       IFNULL(kend_bagian, '') AS kend_bagian,
       IFNULL(kend_pic, '') AS kend_pic,
       IFNULL(kend_cabang, '') AS kend_cabang
     FROM tkendaraan
     ORDER BY kend_nopol`
  );
  return rows;
};

module.exports = { getBrowse };