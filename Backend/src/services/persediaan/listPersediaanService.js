const db = require("../../config/database");

/**
 * List Persediaan — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       brg_kode AS Kode,
       brg_nama AS Nama,
       brg_satuan AS Satuan,
       mst_idbatch AS IdBatch,
       DATE_FORMAT(mst_expired_date, '%Y-%m-%d') AS Expired,
       gdg_nama AS Gudang,
       SUM(mst_stok_in - mst_stok_out) AS Stok
     FROM tbarang
     INNER JOIN tmasterstok ON mst_brg_kode = brg_kode
     INNER JOIN tgudang ON gdg_kode = mst_gdg_kode
     WHERE mst_tanggal <= ?
     GROUP BY mst_gdg_kode, brg_kode, mst_idbatch, mst_expired_date, gdg_nama
     ORDER BY brg_kode`,
    [endDate]
  );
  return rows;
};

module.exports = { getBrowse };