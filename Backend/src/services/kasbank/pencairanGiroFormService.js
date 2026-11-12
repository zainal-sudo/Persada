const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-CG.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(cg_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tpencairangiro
     WHERE cg_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// ── Search Giro ──────────────────────────────────────────────────────
const searchGiro = async (search = "") => {
  const [rows] = await db.query(
    `SELECT
       b.byc_nogiro AS nogiro,
       b.byc_giro AS nilai,
       DATE_FORMAT(b.byc_tanggal, '%Y-%m-%d') AS tanggal,
       b.byc_cus_kode AS kode,
       c.cus_nama AS nama
     FROM tbayarcus_hdr b
     INNER JOIN tcustomer c ON c.cus_kode = b.byc_cus_kode
     WHERE b.byc_nogiro <> ''
       AND b.byc_giro > 0
       AND b.byc_rek_giro = '13.001'
       AND b.byc_nogiro NOT IN (SELECT cg_gironumber FROM tpencairangiro)
       AND (b.byc_nogiro LIKE ? OR c.cus_nama LIKE ?)
     ORDER BY b.byc_tanggal DESC
     LIMIT 100`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get Rekening ─────────────────────────────────────────────────────
const getRekening = async () => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     ORDER BY rek_kode`
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[row]] = await db.query(
    `SELECT
       cg_nomor AS nomor,
       DATE_FORMAT(cg_tanggal, '%Y-%m-%d') AS tanggal,
       cg_gironumber AS nogiro,
       DATE_FORMAT(cg_tanggalcair, '%Y-%m-%d') AS tanggalCair,
       cg_nilai AS nilai,
       cg_rek_bank AS rekBank
     FROM tpencairangiro
     WHERE cg_nomor = ?`,
    [nomor]
  );

  if (!row) throw new Error("Pencairan giro tidak ditemukan.");
  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, nomor, tanggal, nogiro, tanggalCair, nilai, rekBank } = payload;

  if (isEdit) {
    await db.query(
      `UPDATE tpencairangiro SET
         cg_gironumber = ?, cg_tanggal = ?, cg_tanggalcair = ?,
         cg_nilai = ?, cg_rek_bank = ?
       WHERE cg_nomor = ?`,
      [nogiro, tanggal, tanggalCair, nilai, rekBank, nomor]
    );
  } else {
    await db.query(
      `INSERT INTO tpencairangiro
         (cg_nomor, cg_gironumber, cg_tanggal, cg_tanggalcair, cg_nilai, cg_rek_bank)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nomor, nogiro, tanggal, tanggalCair, nilai, rekBank]
    );
  }

  return { nomor };
};

module.exports = {
  getMaxNomor,
  searchGiro,
  getRekening,
  getDetailForm,
  saveData,
};