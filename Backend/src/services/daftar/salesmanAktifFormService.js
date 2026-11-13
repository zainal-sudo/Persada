// services/daftar/salesmanAktifFormService.js
const db = require("../../config/database");

// ── Lookup Area/Rayon (master tsalesman) ──────────────────────────────
const getRayon = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
     FROM tsalesman
     WHERE sls_kode LIKE ? OR sls_nama LIKE ?
     ORDER BY sls_kode`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load Form Edit ────────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[h]] = await db.query(
    `SELECT
       sla_kode AS kode,
       sla_nama AS nama,
       IFNULL(sla_isaktif, 0) AS isaktif,
       DATE_FORMAT(sla_tgl_masuk, '%Y-%m-%d') AS tglMasuk
     FROM tsalesmanaktif
     WHERE sla_kode = ?`,
    [kode]
  );
  if (!h) throw new Error("Salesman tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT
       d.slad_sls_kode AS slsKode,
       IFNULL(s.sls_nama, '') AS slsNama,
       d.slad_nourut AS nourut
     FROM tsalesmanaktif_dtl d
     LEFT JOIN tsalesman s ON s.sls_kode = d.slad_sls_kode
     WHERE d.slad_sla_kode = ?
     ORDER BY d.slad_nourut ASC`,
    [kode]
  );

  return { ...h, detail };
};

// ── Save Data ─────────────────────────────────────────────────────────
// Kode diinput manual (sla_kode = nama/inisial salesman), detail rayon
// disimpan full-replace (DELETE lalu INSERT ulang).
const saveData = async (payload, user) => {
  const { isEdit, kode, nama, isaktif, tglMasuk, detail } = payload;

  if (!kode || !String(kode).trim())
    throw new Error("Kode salesman wajib diisi.");
  if (!nama || !String(nama).trim())
    throw new Error("Nama salesman wajib diisi.");
  if (!Array.isArray(detail))
    throw new Error("Detail area/rayon tidak valid.");

  const rayonList = detail
    .filter((d) => d.slsKode && String(d.slsKode).trim())
    .map((d, i) => ({ slsKode: String(d.slsKode).trim(), nourut: i + 1 }));
  if (rayonList.length === 0)
    throw new Error("Minimal 1 area/rayon harus diisi.");
  const uniq = new Set(rayonList.map((r) => r.slsKode));
  if (uniq.size !== rayonList.length)
    throw new Error("Ada area/rayon yang duplikat.");

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
           sla_nama = ?, sla_isaktif = ?, sla_tgl_masuk = ?
         WHERE sla_kode = ?`,
        [nama, Number(isaktif) ? 1 : 0, tglMasuk || null, kode]
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
           (sla_kode, sla_nama, sla_isaktif, sla_tgl_masuk, sla_sls_kode)
         VALUES (?, ?, ?, ?, '')`,
        [kode, nama, Number(isaktif) ? 1 : 0, tglMasuk || null]
      );
    }

    // Validasi semua rayon ada di master Area/Rayon
    for (const r of rayonList) {
      const [[s]] = await conn.query(
        `SELECT sls_kode FROM tsalesman WHERE sls_kode = ?`,
        [r.slsKode]
      );
      if (!s)
        throw new Error(`Area/Rayon "${r.slsKode}" tidak ada di master.`);
    }

    await conn.query(
      `DELETE FROM tsalesmanaktif_dtl WHERE slad_sla_kode = ?`,
      [kode]
    );
    for (const r of rayonList) {
      await conn.query(
        `INSERT INTO tsalesmanaktif_dtl
           (slad_sla_kode, slad_sls_kode, slad_nourut)
         VALUES (?, ?, ?)`,
        [kode, r.slsKode, r.nourut]
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

module.exports = { getRayon, getDetailForm, saveData };
