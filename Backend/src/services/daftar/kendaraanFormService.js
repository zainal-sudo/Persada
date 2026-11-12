const db = require("../../config/database");

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nopol) => {
  const [[row]] = await db.query(
    `SELECT
       kend_nopol AS nopol,
       IFNULL(kend_merk, '') AS merk,
       IFNULL(kend_tipe, '') AS tipe,
       IFNULL(kend_bagian, '') AS bagian,
       IFNULL(kend_pic, '') AS pic,
       IFNULL(kend_cabang, '') AS cabang
     FROM tkendaraan
     WHERE kend_nopol = ?`,
    [nopol]
  );

  if (!row) throw new Error("Kendaraan tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, nopol, merk, tipe, bagian, pic, cabang } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tkendaraan SET
         kend_nopol = ?, kend_merk = ?, kend_tipe = ?,
         kend_bagian = ?, kend_pic = ?, kend_cabang = ?
       WHERE kend_nopol = ?`,
      [nopol, merk, tipe, bagian, pic, cabang, nopol]
    );
  } else {
    await db.query(
      `INSERT INTO tkendaraan
         (kend_nopol, kend_merk, kend_tipe, kend_bagian, kend_pic, kend_cabang)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nopol, merk, tipe, bagian, pic, cabang]
    );
  }

  return { nopol };
};

module.exports = {
  getDetailForm,
  saveData,
};