// services/daftar/salesmanAktifFormService.js
const db = require("../../config/database");

// ── Lookup Formasi ────────────────────────────────────────────────────
const getFormasiOptions = async (search = "") => {
  const [rows] = await db.query(
    `SELECT tf_id AS id, tf_nama AS nama
       FROM tformasi
      WHERE (? = '' OR tf_nama LIKE ?)
      ORDER BY tf_nama`,
    [search, `%${search}%`]
  );
  return rows;
};

// ── Load Form Edit ────────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[h]] = await db.query(
    `SELECT
       a.sla_kode AS kode,
       a.sla_nama AS nama,
       IFNULL(a.sla_isaktif, 0) AS isaktif,
       DATE_FORMAT(a.sla_tgl_masuk, '%Y-%m-%d') AS tglMasuk,
       IFNULL(a.sla_formasi_id, 0) AS formasiId,
       IFNULL(f.tf_nama, '') AS formasiNama
     FROM tsalesmanaktif a
     LEFT JOIN tformasi f ON f.tf_id = a.sla_formasi_id
     WHERE a.sla_kode = ?`,
    [kode]
  );
  if (!h) throw new Error("Salesman tidak ditemukan.");
  return h;
};

// ── Save Data ─────────────────────────────────────────────────────────
// Salesman menunjuk 1 formasi. Tidak ada lagi setting multi area/rayon
// di master salesman (area menempel ke formasi).
const saveData = async (payload, user) => {
  const { isEdit, kode, nama, isaktif, tglMasuk, formasiId } = payload;

  if (!kode || !String(kode).trim())
    throw new Error("Kode salesman wajib diisi.");
  if (!nama || !String(nama).trim())
    throw new Error("Nama salesman wajib diisi.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    if (isEdit) {
      const [[exist]] = await conn.query(
        `SELECT sla_kode FROM tsalesmanaktif WHERE sla_kode = ?`,
        [kode]
      );
      if (!exist) throw new Error("Salesman tidak ditemukan.");
      await conn.query(
        `UPDATE tsalesmanaktif SET
           sla_nama = ?, sla_isaktif = ?, sla_tgl_masuk = ?,
           sla_formasi_id = ?
         WHERE sla_kode = ?`,
        [
          nama,
          Number(isaktif) ? 1 : 0,
          tglMasuk || null,
          formasiId || null,
          kode,
        ]
      );
    } else {
      const [[dup]] = await conn.query(
        `SELECT sla_kode FROM tsalesmanaktif WHERE sla_kode = ?`,
        [kode]
      );
      if (dup)
        throw new Error(`Kode salesman "${kode}" sudah dipakai.`);
      await conn.query(
        `INSERT INTO tsalesmanaktif
           (sla_kode, sla_nama, sla_isaktif, sla_tgl_masuk, sla_sls_kode,
            sla_formasi_id)
         VALUES (?, ?, ?, ?, '', ?)`,
        [kode, nama, Number(isaktif) ? 1 : 0, tglMasuk || null, formasiId || null]
      );
    }

    await conn.commit();
    return { kode };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getFormasiOptions, getDetailForm, saveData };
