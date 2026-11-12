// services/setting/perusahaanService.js
// Migrasi dari Delphi ufrmPerusahaan.pas (loaddata + simpandata)
// Identitas perusahaan — tabel tperusahaan (single row).
const db = require("../../config/database");

const FIELDS = [
  "perush_nama",
  "perush_alamat",
  "perush_kota",
  "perush_notelp",
  "perush_nofax",
  "perush_npwp",
  "perush_nama_npwp",
  "perush_alnpwp",
  "perush_ktnpwp",
  "perush_rekening",
];

const get = async () => {
  const cols = FIELDS.join(", ");
  const [rows] = await db.query(`SELECT ${cols} FROM tperusahaan LIMIT 1`);
  return rows[0] || null;
};

const update = async (data) => {
  const [[row]] = await db.query(`SELECT 1 FROM tperusahaan LIMIT 1`);

  if (!row) {
    // Tabel kosong → insert baris pertama (Delphi asli hanya update; aman jika kosong)
    const cols = FIELDS.join(", ");
    const marks = FIELDS.map(() => "?").join(", ");
    await db.query(
      `INSERT INTO tperusahaan (${cols}) VALUES (${marks})`,
      FIELDS.map((f) => data[f] || "")
    );
    return;
  }

  const set = FIELDS.map((f) => `${f} = ?`).join(", ");
  await db.query(`UPDATE tperusahaan SET ${set}`, FIELDS.map((f) => data[f] || ""));
};

module.exports = { get, update };
