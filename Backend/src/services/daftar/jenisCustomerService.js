const db = require("../../config/database");

/**
 * Browse Jenis Customer — sesuai SQLMaster Delphi:
 * SELECT jc_kode Kode, jc_nama Nama FROM tjeniscustomer
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       jc_kode AS Kode,
       jc_nama AS Nama
     FROM tjeniscustomer
     ORDER BY jc_kode`
  );
  return rows;
};

module.exports = { getBrowse };