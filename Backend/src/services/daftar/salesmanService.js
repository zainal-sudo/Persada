const db = require("../../config/database");

/**
 * Browse Salesman — sesuai SQLMaster Delphi:
 * SELECT sls_kode Kode, sls_nama Nama, sls_alamat Alamat,
 *        sls_kota Kota, sls_Telp Telp, sls_tglmasuk TglMasuk
 * FROM tsalesman
 * WHERE sls_cabang = 'P01'
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       sls_kode AS Kode,
       sls_nama AS Nama,
       IFNULL(sls_alamat, '') AS Alamat,
       IFNULL(sls_kota, '') AS Kota,
       IFNULL(sls_telp, '') AS Telp,
       DATE_FORMAT(sls_tglmasuk, '%Y-%m-%d') AS TglMasuk
     FROM tsalesman
     ORDER BY sls_kode`
  );

  return rows;
};

module.exports = { getBrowse };