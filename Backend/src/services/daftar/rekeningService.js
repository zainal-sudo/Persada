const db = require("../../config/database");

/**
 * Browse Rekening — sesuai SQLMaster Delphi
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       a.rek_kode AS Kode,
       a.rek_nama AS Nama,
       k.kol_nama AS Kelompok,
       IF(a.rek_isaktif = 1, 'Aktif', 'Non Aktif') AS Status,
       IFNULL(
         (SELECT SUM(jurd_debet - jurd_kredit)
          FROM tjurnalitem
          WHERE jurd_rek_kode = a.rek_kode), 0) AS Saldo_Akhir
     FROM trekening a
     INNER JOIN tkelompok k ON k.kol_id = a.rek_kol_id
     ORDER BY a.rek_kode`
  );
  return rows;
};

module.exports = { getBrowse };