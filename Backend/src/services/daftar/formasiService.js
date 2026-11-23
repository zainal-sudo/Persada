// services/daftar/formasiService.js
const db = require("../../config/database");

/**
 * Browse Master Formasi.
 * Satu formasi menampung banyak Area/Rayon (tsalesman.sls_formasi_id)
 * dan punya target bulanan sendiri (tformasitarget).
 */
const getBrowse = async (search = "") => {
  const like = `%${search}%`;
  const [rows] = await db.query(
     `SELECT
       f.tf_id AS id,
       f.tf_nama AS Nama,
       IFNULL(f.tf_divisi, '') AS Divisi,
       IFNULL(f.tf_type, '') AS Type,
       IFNULL(NULLIF((
         SELECT GROUP_CONCAT(m.sla_nama ORDER BY m.sla_kode SEPARATOR ', ')
           FROM tsalesmanaktif m
          WHERE m.sla_formasi_id = f.tf_id
       ), ''), IFNULL(s.sla_nama, '')) AS Salesman,
       IFNULL(a.sla_nama, '') AS Atasan,
       COUNT(r.sls_kode) AS JumlahArea,
       IFNULL(GROUP_CONCAT(r.sls_nama ORDER BY r.sls_kode SEPARATOR ', '), '') AS Area
     FROM tformasi f
     LEFT JOIN tsalesmanaktif s ON s.sla_kode = f.tf_sla_kode
     LEFT JOIN tsalesmanaktif a ON a.sla_kode = f.tf_atasan_kode
     LEFT JOIN tsalesman r ON r.sls_formasi_id = f.tf_id
     WHERE (? = '' OR f.tf_nama LIKE ? OR f.tf_divisi LIKE ? OR f.tf_type LIKE ?)
     GROUP BY f.tf_id, f.tf_nama, f.tf_divisi, f.tf_type, s.sla_nama, a.sla_nama
     ORDER BY f.tf_id`,
    [search, like, like, like]
  );
  return rows;
};

/**
 * Hapus Formasi — guard: masih dipakai area atau salesman tidak boleh dihapus.
 */
const deleteData = async (id) => {
  const [[f]] = await db.query(
    `SELECT tf_id FROM tformasi WHERE tf_id = ?`,
    [id]
  );
  if (!f) throw new Error("Formasi tidak ditemukan.");

  const [[area]] = await db.query(
    `SELECT COUNT(*) AS n FROM tsalesman WHERE sls_formasi_id = ?`,
    [id]
  );
  if (Number(area.n) > 0)
    throw new Error(
      `Formasi masih dipakai ${Number(area.n)} area/rayon. Lepas dulu area tersebut.`
    );

  const [[sls]] = await db.query(
    `SELECT COUNT(*) AS n FROM tsalesmanaktif WHERE sla_formasi_id = ?`,
    [id]
  );
  if (Number(sls.n) > 0)
    throw new Error(
      `Formasi masih dipakai ${Number(sls.n)} salesman. Pindahkan dulu salesman tersebut.`
    );

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tformasitarget WHERE tft_tf_id = ?`, [id]);
    await conn.query(`DELETE FROM tformasi WHERE tf_id = ?`, [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getBrowse, deleteData };
