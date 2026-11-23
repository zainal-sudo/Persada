// services/daftar/formasiFormService.js
const db = require("../../config/database");

const getOptions = async (search = "") => {
  const [rows] = await db.query(
    `SELECT tf_id AS id, tf_nama AS nama
       FROM tformasi
      WHERE (? = '' OR tf_nama LIKE ?)
      ORDER BY tf_nama`,
    [search, `%${search}%`]
  );
  return rows;
};

const getSalesmanOptions = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sla_kode AS kode, sla_nama AS nama
       FROM tsalesmanaktif
      WHERE (? = '' OR sla_kode LIKE ? OR sla_nama LIKE ?)
      ORDER BY sla_nama`,
    [search, `%${search}%`, `%${search}%`]
  );
  return rows;
};

const getAreaOptions = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama,
            IFNULL(sls_formasi_id, 0) AS formasiId
       FROM tsalesman
      WHERE (? = '' OR sls_kode LIKE ? OR sls_nama LIKE ?)
      ORDER BY sls_nama`,
    [search, `%${search}%`, `%${search}%`]
  );
  return rows;
};

const getDetailForm = async (id) => {
  const [[row]] = await db.query(
    `SELECT
       f.tf_id AS id,
       f.tf_nama AS nama,
       IFNULL(f.tf_divisi, '') AS divisi,
       IFNULL(f.tf_type, '') AS type,
       IFNULL(f.tf_atasan_kode, '') AS atasanKode
     FROM tformasi f
     WHERE f.tf_id = ?`,
    [id]
  );
  if (!row) throw new Error("Formasi tidak ditemukan.");

  const [areas] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
       FROM tsalesman
      WHERE sls_formasi_id = ?
      ORDER BY sls_kode`,
    [id]
  );

  return { ...row, areas };
};

/**
 * Target bulanan formasi untuk 1 tahun.
 * tbulan (1..12) LEFT JOIN tformasitarget pada bulan yang sama.
 */
const getTargetBulanan = async (id, tahun) => {
  const [rows] = await db.query(
    `SELECT
       b.id AS periode,
       b.nama AS nama,
       IFNULL(t.tft_target, 0) AS target,
       IFNULL(t.tft_target_jenis, '') AS targetJenis,
       IFNULL(t.tft_additional_target_produk, '') AS additionalTargetProduk
     FROM tbulan b
     LEFT JOIN tformasitarget t
       ON t.tft_tf_id = ?
      AND YEAR(t.tft_bulan) = ?
      AND MONTH(t.tft_bulan) = b.id
     ORDER BY b.id`,
    [id, tahun]
  );
  return rows;
};

const toJsonText = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
};

const saveData = async (payload, user) => {
  const {
    isEdit,
    id,
    nama,
    divisi,
    type,
    atasanKode,
    tahun,
    target,
    areas,
  } = payload;

  if (!nama || !String(nama).trim())
    throw new Error("Nama formasi wajib diisi.");

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualId = id;

    if (isEdit) {
      const [[exist]] = await conn.query(
        `SELECT tf_id FROM tformasi WHERE tf_id = ?`,
        [id]
      );
      if (!exist) throw new Error("Formasi tidak ditemukan.");

      await conn.query(
        `UPDATE tformasi SET
           tf_nama = ?, tf_divisi = ?, tf_type = ?,
           tf_atasan_kode = ?,
           date_modified = NOW(), user_modified = ?
         WHERE tf_id = ?`,
        [
          String(nama).trim(),
          String(divisi || "").trim(),
          String(type || "").trim(),
          atasanKode || null,
          user.kode,
          id,
        ]
      );
    } else {
      const [ins] = await conn.query(
        `INSERT INTO tformasi
           (tf_nama, tf_divisi, tf_type, tf_atasan_kode,
            date_create, user_create)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [
          String(nama).trim(),
          String(divisi || "").trim(),
          String(type || "").trim(),
          atasanKode || null,
          user.kode,
        ]
      );
      actualId = ins.insertId;
    }

    // Assign area ke formasi ini (full replace) bila dikirim.
    if (Array.isArray(areas)) {
      const kodeList = areas
        .filter((a) => a && String(a).trim())
        .map((a) => String(a).trim());
      const uniq = [...new Set(kodeList)];

      await conn.query(
        `UPDATE tsalesman SET sls_formasi_id = NULL WHERE sls_formasi_id = ?`,
        [actualId]
      );
      for (const kode of uniq) {
        await conn.query(
          `UPDATE tsalesman SET sls_formasi_id = ? WHERE sls_kode = ?`,
          [actualId, kode]
        );
      }
    }

    // Target bulanan (full replace untuk tahun yang dikirim).
    if (tahun && Array.isArray(target)) {
      await conn.query(
        `DELETE FROM tformasitarget
          WHERE tft_tf_id = ? AND YEAR(tft_bulan) = ?`,
        [actualId, tahun]
      );

      for (const t of target) {
        const targetVal = Number(t.target) || 0;
        const jenisText = toJsonText(t.targetJenis);
        const addText = toJsonText(t.additionalTargetProduk);
        if (targetVal === 0 && !jenisText && !addText) continue;

        const bulan = `${tahun}-${String(t.periode).padStart(2, "0")}-01`;
        await conn.query(
          `INSERT INTO tformasitarget
             (tft_tf_id, tft_bulan, tft_target, tft_target_jenis,
              tft_additional_target_produk, tft_last_edited_at,
              date_create, user_create)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
           ON DUPLICATE KEY UPDATE
             tft_target = VALUES(tft_target),
             tft_target_jenis = VALUES(tft_target_jenis),
             tft_additional_target_produk = VALUES(tft_additional_target_produk),
             tft_last_edited_at = NOW(),
             date_modified = NOW(),
             user_modified = ?`,
          [actualId, bulan, targetVal, jenisText, addText, user.kode, user.kode]
        );
      }
    }

    await conn.commit();
    return { id: actualId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getOptions,
  getSalesmanOptions,
  getAreaOptions,
  getDetailForm,
  getTargetBulanan,
  saveData,
};
