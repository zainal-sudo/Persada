const db = require("../../config/database");

/**
 * Browse Ekspedisi — sesuai SQLMaster Delphi:
 * SELECT ekspedisi_id, ekspedisi_nama FROM tekspedisi
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       ekspedisi_id,
       IFNULL(ekspedisi_nama, '') AS ekspedisi_nama
     FROM tekspedisi
     ORDER BY ekspedisi_id`
  );
  return rows;
};

module.exports = { getBrowse };