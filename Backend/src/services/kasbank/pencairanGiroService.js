const db = require("../../config/database");

/**
 * Browse Pencairan Giro — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       cg_nomor AS Nomor,
       DATE_FORMAT(cg_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(cg_gironumber, '') AS GiroNumber,
       DATE_FORMAT(cg_tanggalcair, '%Y-%m-%d') AS TglCair,
       IFNULL(cg_nilai, 0) AS Nilai,
       IFNULL(r.rek_nama, '') AS Bank
     FROM tpencairangiro g
     INNER JOIN trekening r ON r.rek_kode = g.cg_rek_bank
     WHERE g.cg_tanggal BETWEEN ? AND ?
     ORDER BY g.cg_nomor`,
    [startDate, endDate]
  );
  return rows;
};

module.exports = { getBrowse };