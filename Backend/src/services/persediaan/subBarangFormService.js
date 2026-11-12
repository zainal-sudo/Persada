const db = require("../../config/database");

// ── Generate Kode Otomatis ───────────────────────────────────────────
// Delphi getmaxkode:
// Tingkat 1: max(ktg_kode) + 1
// Tingkat 2: parent + "." + (max(substr(kode,3)) + 1)
// Tingkat >2: parent + "." + (max(substr(kode,tingkat+2)) + 1)
const getMaxKode = async (tingkat, parentKode = "") => {
  if (tingkat === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(ktg_kode AS UNSIGNED)), 0) AS max_val
       FROM tkategori WHERE ktg_tingkat = 1`
    );
    return String(Number(row.max_val) + 1);
  }

  // Tingkat > 1: perlu parentKode
  if (!parentKode) throw new Error("parentKode wajib untuk tingkat > 1.");

  if (tingkat === 2) {
    const [[row]] = await db.query(
      `SELECT SUBSTR(ktg_kode, 3, LENGTH(ktg_kode) - 2) AS jml
       FROM tkategori
       WHERE ktg_kode LIKE ? AND ktg_tingkat = ?
       ORDER BY LENGTH(ktg_kode) DESC, ktg_kode DESC
       LIMIT 1`,
      [`${parentKode}%`, tingkat]
    );
    if (!row || !row.jml) return `${parentKode}.1`;
    return `${parentKode}.${Number(row.jml) + 1}`;
  }

  // Tingkat > 2
  const [[row]] = await db.query(
    `SELECT SUBSTR(ktg_kode, ${tingkat + 2}, LENGTH(ktg_kode) - ${tingkat + 1}) AS jml
     FROM tkategori
     WHERE ktg_kode LIKE ? AND ktg_tingkat = ?
     ORDER BY LENGTH(ktg_kode) DESC, ktg_kode DESC
     LIMIT 1`,
    [`${parentKode}%`, tingkat]
  );
  if (!row || !row.jml) return `${parentKode}.1`;
  return `${parentKode}.${Number(row.jml) + 1}`;
};

// ── Get Parent (tingkat sebelumnya) ──────────────────────────────────
const getParent = async (tingkat) => {
  const [rows] = await db.query(
    `SELECT ktg_kode AS kode, ktg_nama AS nama
     FROM tkategori
     WHERE ktg_tingkat = ?
     ORDER BY ktg_kode`,
    [tingkat]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT ktg_kode AS kode, ktg_nama AS nama, ktg_tingkat AS tingkat
     FROM tkategori
     WHERE ktg_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Sub barang tidak ditemukan.");

  // Tentukan parentKode (buang segmen terakhir)
  let parentKode = "";
  const parts = String(row.kode).split(".");
  if (parts.length > 1) {
    parts.pop();
    parentKode = parts.join(".");
  }

  return { ...row, parentKode };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, kode, nama, tingkat } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tkategori SET ktg_nama = ? WHERE ktg_kode = ?`,
      [nama, kode]
    );
  } else {
    await db.query(
      `INSERT INTO tkategori (ktg_kode, ktg_nama, ktg_tingkat)
       VALUES (?, ?, ?)`,
      [kode, nama, tingkat]
    );
  }

  return { kode };
};

module.exports = {
  getMaxKode,
  getParent,
  getDetailForm,
  saveData,
};