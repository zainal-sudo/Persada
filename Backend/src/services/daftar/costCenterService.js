const db = require("../../config/database");

// Browse — murni dari tcostcenter (sesuai Delphi: cc_kode Kode, cc_nama Nama)
const getAll = async () => {
  const [rows] = await db.query(
    `SELECT cc_kode AS kode, cc_nama AS nama FROM tcostcenter ORDER BY cc_nama`,
  );
  return rows;
};

// Get single untuk form edit
const getById = async (kode) => {
  const [[row]] = await db.query(
    `SELECT cc_kode AS kode, cc_nama AS nama FROM tcostcenter WHERE cc_kode = ?`,
    [kode],
  );
  if (!row) throw new Error("Cost Center tidak ditemukan.");
  return row;
};

// Simpan (insert/update)
// Delphi: insert → kode dari edtKode.Text (user input manual)
const saveData = async (payload) => {
  const { isEdit, kode, nama } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tcostcenter SET cc_nama = ? WHERE cc_kode = ?`,
      [nama, kode],
    );
  } else {
    // Cek duplikat kode
    const [[cek]] = await db.query(
      `SELECT COUNT(*) AS c FROM tcostcenter WHERE cc_kode = ?`,
      [kode],
    );
    if (cek.c > 0) throw new Error(`Kode "${kode}" sudah ada.`);

    await db.query(
      `INSERT INTO tcostcenter (cc_kode, cc_nama) VALUES (?, ?)`,
      [kode, nama],
    );
  }

  return { kode };
};

// Hapus
const deleteData = async (kode) => {
  await db.query(`DELETE FROM tcostcenter WHERE cc_kode = ?`, [kode]);
  return { kode };
};

module.exports = { getAll, getById, saveData, deleteData };