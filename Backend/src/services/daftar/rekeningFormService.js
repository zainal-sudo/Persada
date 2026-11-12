const db = require("../../config/database");

// ── Get Kelompok ─────────────────────────────────────────────────────
const getKelompok = async () => {
  const [rows] = await db.query(
    `SELECT kol_id AS kode, kol_nama AS nama
     FROM tkelompok
     ORDER BY kol_nama`
  );
  return rows;
};

// ── Cek Kode ─────────────────────────────────────────────────────────
const cekKode = async (kode) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c FROM trekening WHERE rek_kode = ?`,
    [kode]
  );
  return row.c > 0;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       rek_kode AS kode,
       rek_nama AS nama,
       rek_kol_id AS kolId,
       rek_isaktif AS isAktif
     FROM trekening
     WHERE rek_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Rekening tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, kode, nama, kolId, isAktif } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE trekening SET
         rek_nama = ?, rek_isaktif = ?, rek_kol_id = ?
       WHERE rek_kode = ?`,
      [nama, isAktif ? 1 : 0, kolId, kode]
    );
  } else {
    await db.query(
      `INSERT INTO trekening (rek_kode, rek_nama, rek_kol_id, rek_isaktif)
       VALUES (?, ?, ?, ?)`,
      [kode, nama, kolId, isAktif ? 1 : 0]
    );
  }

  return { kode };
};

module.exports = {
  getKelompok,
  cekKode,
  getDetailForm,
  saveData,
};