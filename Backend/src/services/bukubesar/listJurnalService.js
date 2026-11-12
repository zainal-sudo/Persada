const db = require("../../config/database");

/**
 * List Jurnal — sesuai loaddata Delphi
 * Dari view alljurnal
 */
const getListJurnal = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       MONTH(Tanggal) AS Bulan,
       YEAR(Tanggal) AS Tahun,
       DATE_FORMAT(Tanggal, '%Y-%m-%d') AS Tanggal,
       Nomor,
       Referensi,
       Account,
       AccountName,
       Keterangan,
       IFNULL(Debet, 0) AS Debet,
       IFNULL(Kredit, 0) AS Kredit,
       IFNULL(Kelompok, '') AS Kelompok,
       IFNULL(CostCenter, '') AS CostCenter,
       IFNULL(Customer, '') AS Customer,
       IFNULL(nopol, '') AS nopol,
       IFNULL(ekspedisi, '') AS ekspedisi
     FROM alljurnal
     WHERE Tanggal BETWEEN ? AND ?
     ORDER BY Nomor`,
    [startDate, endDate]
  );
  return rows;
};

module.exports = { getListJurnal };