const db = require("../../config/database");

// ── Generate Kode Otomatis ───────────────────────────────────────────
// Delphi: select max(SUBSTR(gdg_kode,4,2)) from tgudang WHERE gdg_kode <> 'WH-99'
// Format: WH-01, WH-02, dst
const getMaxKode = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(SUBSTR(gdg_kode, 4, 2) AS UNSIGNED)), 0) AS max_val
     FROM tgudang
     WHERE gdg_kode <> 'WH-99'`
  );
  const nextNum = 100 + Number(row.max_val) + 1;
  return `WH-${String(nextNum).slice(-2)}`;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       gdg_kode AS kode,
       IFNULL(gdg_nama, '') AS nama,
       IFNULL(gdg_penanggungjawab, '') AS penanggungjawab,
       IFNULL(gdg_keterangan, '') AS keterangan
     FROM tgudang
     WHERE gdg_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Gudang tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, kode, nama, penanggungjawab, keterangan } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tgudang SET
         gdg_nama = ?, gdg_penanggungjawab = ?, gdg_keterangan = ?
       WHERE gdg_kode = ?`,
      [nama, penanggungjawab, keterangan, kode]
    );
  } else {
    const maxKode = await getMaxKode();
    await db.query(
      `INSERT INTO tgudang (gdg_kode, gdg_nama, gdg_penanggungjawab, gdg_keterangan)
       VALUES (?, ?, ?, ?)`,
      [maxKode, nama, penanggungjawab, keterangan]
    );
  }

  return { kode: isEdit ? kode : undefined };
};

module.exports = {
  getMaxKode,
  getDetailForm,
  saveData,
};