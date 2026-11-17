const db = require("../../config/database");

const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       div_kode,
       IFNULL(div_nama, '') AS div_nama,
       IFNULL(div_prefix, '') AS div_prefix
     FROM tdivisi
     ORDER BY div_kode`
  );
  return rows;
};

module.exports = { getBrowse };
