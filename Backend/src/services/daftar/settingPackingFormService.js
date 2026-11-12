const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
// Delphi: select max(right(pck_nomor,2)) from tpacking_hdr
const getMaxNomor = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(pck_nomor, 2) AS UNSIGNED)), 0) AS max_val
     FROM tpacking_hdr`
  );
  const nextNum = 10 + Number(row.max_val) + 1;
  return String(nextNum).padStart(2, "0");
};

// ── Lookup Barang ────────────────────────────────────────────────────
const getBarang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT brg_kode AS kode, brg_nama AS nama, brg_satuan AS satuan
     FROM tbarang
     WHERE brg_nama LIKE ? OR brg_kode LIKE ?
     ORDER BY brg_nama
     LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT pck_nomor AS nomor, pck_brg_kode AS kode, pck_nama AS nama
     FROM tpacking_hdr
     WHERE pck_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Setting packing tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT d.pckd_brg_kode AS kode, b.brg_nama AS nama, d.pckd_qty AS qty
     FROM tpacking_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.pckd_brg_kode
     WHERE d.pckd_pck_nomor = ?
     ORDER BY d.pckd_brg_kode`,
    [nomor]
  );

  return {
    ...header,
    detail: detail.map((d, i) => ({
      no: i + 1,
      kode: d.kode,
      nama: d.nama,
      qty: Number(d.qty),
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, nomor, kode, nama, detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tpacking_hdr SET
           pck_nama = ?, pck_brg_kode = ?
         WHERE pck_nomor = ?`,
        [nama, kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor();
      await conn.query(
        `INSERT INTO tpacking_hdr (pck_nomor, pck_brg_kode, pck_nama)
         VALUES (?, ?, ?)`,
        [actualNomor, kode, nama]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tpacking_dtl WHERE pckd_pck_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    for (const d of detail) {
      if (d.kode && Number(d.qty) > 0) {
        await conn.query(
          `INSERT INTO tpacking_dtl (pckd_pck_nomor, pckd_brg_kode, pckd_qty)
           VALUES (?, ?, ?)`,
          [actualNomor, d.kode, Number(d.qty)]
        );
      }
    }

    await conn.commit();
    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMaxNomor,
  getBarang,
  getDetailForm,
  saveData,
};