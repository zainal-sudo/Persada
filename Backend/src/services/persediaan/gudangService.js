const db = require("../../config/database");

/**
 * Browse Gudang — sesuai SQLMaster Delphi:
 * SELECT gdg_kode Kode, gdg_nama Nama, gdg_penanggungjawab Penanggungjawab,
 *        gdg_keterangan Keterangan
 * FROM tgudang
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       gdg_kode AS Kode,
       IFNULL(gdg_nama, '') AS Nama,
       IFNULL(gdg_penanggungjawab, '') AS Penanggungjawab,
       IFNULL(gdg_keterangan, '') AS Keterangan
     FROM tgudang
     ORDER BY gdg_kode`
  );
  return rows;
};

module.exports = { getBrowse };