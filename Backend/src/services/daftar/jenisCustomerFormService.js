const db = require("../../config/database");

// ── Generate Kode Otomatis ───────────────────────────────────────────
// Delphi: select max(jc_kode) from tjeniscustomer
const getMaxKode = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(jc_kode), 0) AS max_val FROM tjeniscustomer`
  );
  const nextNum = Number(row.max_val) + 1;
  return String(nextNum);
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT jc_kode AS kode, jc_nama AS nama
     FROM tjeniscustomer
     WHERE jc_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Jenis customer tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, kode, nama } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tjeniscustomer SET jc_nama = ? WHERE jc_kode = ?`,
      [nama, kode]
    );
  } else {
    const maxKode = await getMaxKode();
    await db.query(
      `INSERT INTO tjeniscustomer (jc_kode, jc_nama) VALUES (?, ?)`,
      [maxKode, nama]
    );
  }

  return { kode: isEdit ? kode : undefined };
};

module.exports = {
  getMaxKode,
  getDetailForm,
  saveData,
};