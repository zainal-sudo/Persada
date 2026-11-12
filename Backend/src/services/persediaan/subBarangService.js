const db = require("../../config/database");

/**
 * Browse Sub Barang — sesuai SQLMaster Delphi:
 * SELECT ktg_kode Kode, ktg_nama Nama
 * FROM tkategori
 * WHERE ktg_tingkat = ?
 */
const getBrowse = async (tingkat) => {
  const [rows] = await db.query(
    `SELECT
       ktg_kode AS Kode,
       ktg_nama AS Nama
     FROM tkategori
     WHERE ktg_tingkat = ?
     ORDER BY ktg_kode`,
    [tingkat]
  );
  return rows;
};

/**
 * Hapus kategori. Delphi hanya `delete from tkategori` tanpa cek —
 * web +guard: tolak bila masih punya sub kategori (anak) atau dipakai barang.
 */
const deleteData = async (kode) => {
  const [[cat]] = await db.query(
    `SELECT ktg_kode FROM tkategori WHERE ktg_kode = ?`,
    [kode]
  );
  if (!cat) throw new Error("Data tidak ditemukan.");

  const [[child]] = await db.query(
    `SELECT 1 AS x FROM tkategori WHERE ktg_kode LIKE ? LIMIT 1`,
    [`${kode}.%`]
  );
  if (child) throw new Error("Tidak dapat dihapus: masih memiliki sub kategori.");

  const [[used]] = await db.query(
    `SELECT 1 AS x FROM tbarang WHERE brg_ktg_kode = ? LIMIT 1`,
    [kode]
  );
  if (used) throw new Error("Tidak dapat dihapus: masih dipakai oleh barang.");

  await db.query(`DELETE FROM tkategori WHERE ktg_kode = ?`, [kode]);
  return { success: true };
};

module.exports = { getBrowse, deleteData };