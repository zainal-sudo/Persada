const db = require("../../config/database");

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (id) => {
  const [[row]] = await db.query(
    `SELECT
       ekspedisi_id AS id,
       IFNULL(ekspedisi_nama, '') AS nama
     FROM tekspedisi
     WHERE ekspedisi_id = ?`,
    [id]
  );

  if (!row) throw new Error("Ekspedisi tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, id, nama } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tekspedisi SET ekspedisi_nama = ? WHERE ekspedisi_id = ?`,
      [nama, id]
    );
  } else {
    const [result] = await db.query(
      `INSERT INTO tekspedisi (ekspedisi_nama) VALUES (?)`,
      [nama]
    );
    return { id: result.insertId };
  }

  return { id };
};

module.exports = {
  getDetailForm,
  saveData,
};