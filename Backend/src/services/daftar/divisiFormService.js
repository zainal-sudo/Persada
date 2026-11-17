const db = require("../../config/database");

const getDetailForm = async (div_kode) => {
  const [[row]] = await db.query(
    `SELECT
       div_kode AS kode,
       IFNULL(div_nama, '') AS nama,
       IFNULL(div_prefix, '') AS prefix
     FROM tdivisi
     WHERE div_kode = ?`,
    [div_kode]
  );

  if (!row) throw new Error("Divisi tidak ditemukan.");
  return row;
};

const saveData = async (payload) => {
  const { isEdit, kode, nama, prefix } = payload;

  if (!kode || !String(kode).trim()) {
    throw new Error("Kode divisi harus diisi.");
  }
  if (!nama || !String(nama).trim()) {
    throw new Error("Nama divisi harus diisi.");
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    if (isEdit) {
      await conn.query(
        `UPDATE tdivisi SET div_nama = ?, div_prefix = ? WHERE div_kode = ?`,
        [nama, prefix || "", kode]
      );
    } else {
      // Cek apakah kode sudah ada
      const [[exist]] = await conn.query(
        `SELECT div_kode FROM tdivisi WHERE div_kode = ?`,
        [kode]
      );
      if (exist) {
        throw new Error(`Kode divisi '${kode}' sudah terdaftar.`);
      }

      await conn.query(
        `INSERT INTO tdivisi (div_kode, div_nama, div_prefix) VALUES (?, ?, ?)`,
        [kode, nama, prefix || ""]
      );
    }

    await conn.commit();
    conn.release();
    return { kode };
  } catch (e) {
    await conn.rollback();
    conn.release();
    throw e;
  }
};

module.exports = {
  getDetailForm,
  saveData,
};
