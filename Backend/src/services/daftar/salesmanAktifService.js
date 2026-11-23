// services/daftar/salesmanAktifService.js
const db = require("../../config/database");

/**
 * Browse Master Salesman (tsalesmanaktif).
 * Salesman menunjuk 1 Formasi; Formasi yang menampung area/rayon dan target.
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       h.sla_kode AS Kode,
       h.sla_nama AS Nama,
       IF(h.sla_isaktif = 1, 'Ya', 'Tidak') AS Aktif,
       DATE_FORMAT(h.sla_tgl_masuk, '%Y-%m-%d') AS TglMasuk,
       IFNULL(f.tf_nama, '') AS Formasi
     FROM tsalesmanaktif h
     LEFT JOIN tformasi f ON f.tf_id = h.sla_formasi_id
     ORDER BY h.sla_kode`
  );
  return rows;
};

/**
 * Hapus Salesman — guard: yang sudah dipakai di SO tidak boleh dihapus.
 */
const deleteData = async (kode) => {
  const [[sls]] = await db.query(
    `SELECT sla_kode FROM tsalesmanaktif WHERE sla_kode = ?`,
    [kode]
  );
  if (!sls) throw new Error("Data Salesman tidak ditemukan.");

  const [[ref]] = await db.query(
    `SELECT COUNT(*) AS n FROM tso_hdr WHERE so_sla_kode = ?`,
    [kode]
  );
  if (Number(ref.n) > 0)
    throw new Error(
      `Salesman sudah dipakai di ${Number(ref.n)} Sales Order. Tidak bisa dihapus.`
    );

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(
      `DELETE FROM tsalesmanaktif_dtl WHERE slad_sla_kode = ?`,
      [kode]
    );
    await conn.query(`DELETE FROM tsalesmanaktif WHERE sla_kode = ?`, [kode]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getBrowse, deleteData };
