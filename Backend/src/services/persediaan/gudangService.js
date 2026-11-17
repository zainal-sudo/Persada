const db = require("../../config/database");

const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       gdg_kode AS Kode,
       IFNULL(gdg_nama, '') AS Nama,
       IFNULL(gdg_penanggungjawab, '') AS Penanggungjawab,
       IFNULL(gdg_keterangan, '') AS Keterangan,
       IFNULL(gdg_iskonsinyasi, 0) AS IsKonsinyasi
     FROM tgudang
     ORDER BY gdg_kode`
  );
  return rows;
};

module.exports = { getBrowse };
