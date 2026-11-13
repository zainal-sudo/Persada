const db = require("../../config/database");

// Browse Supplier — SELECT Sup_kode Kode, Sup_nama Nama, ...
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       Sup_kode AS Kode,
       Sup_nama AS Nama,
       IFNULL(Sup_alamat, '') AS Alamat,
       IFNULL(Sup_kota, '') AS Kota,
       IFNULL(Sup_telp, '') AS Telp
     FROM tsupplier
     ORDER BY Sup_kode`
  );

  return rows;
};

module.exports = { getBrowse };
