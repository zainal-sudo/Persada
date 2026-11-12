const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
// Format: HT.{yymm}.{4digit}
const getMaxNomor = async (tanggal) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `HT.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(hit_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM thitungstok
     WHERE hit_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// ── Lookup Gudang ────────────────────────────────────────────────────
const getGudang = async () => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama FROM tgudang ORDER BY gdg_nama`
  );
  return rows;
};

// ── Lookup Barang ────────────────────────────────────────────────────
const getBarang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT brg_kode AS sku, brg_nama AS namaBarang, brg_satuan AS satuan
     FROM tbarang
     WHERE brg_nama LIKE ? OR brg_kode LIKE ?
     ORDER BY brg_nama
     LIMIT 100`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       hit_nomor AS nomor,
       DATE_FORMAT(hit_tanggal, '%Y-%m-%d') AS tanggal,
       hit_gdg_kode AS gudang,
       IFNULL(hit_lokasi, '') AS lokasi
     FROM thitungstok
     WHERE hit_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Hitung stok tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       d.hitd_brg_kode AS sku,
       d.hitd_satuan AS satuan,
       d.hitd_qty AS qty,
       DATE_FORMAT(d.hitd_expired, '%Y-%m-%d') AS expired
     FROM thitungstok_dtl d
     WHERE d.hitd_hit_nomor = ?
     ORDER BY d.hitd_nourut`,
    [nomor]
  );

  return {
    ...header,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      sku: d.sku,
      qty: Number(d.qty),
      satuan: d.satuan,
      expired: d.expired || "",
      namaBarang: "",
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, gudang, lokasi, detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE thitungstok SET
           hit_gdg_kode = ?, hit_lokasi = ?,
           date_modified = NOW(), user_modified = ?
         WHERE hit_nomor = ?`,
        [gudang, lokasi, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal);
      await conn.query(
        `INSERT INTO thitungstok
           (hit_nomor, hit_tanggal, hit_lokasi, hit_gdg_kode, date_create, user_create)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, lokasi, gudang, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM thitungstok_dtl WHERE hitd_hit_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    let nourut = 1;
    for (const d of detail) {
      if (d.sku && d.sku !== "0") {
        await conn.query(
          `INSERT INTO thitungstok_dtl
             (hitd_hit_nomor, hitd_brg_kode, hitd_satuan, hitd_qty, hitd_expired, hitd_nourut)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.sku, d.satuan, d.qty, d.expired || null, nourut,
          ]
        );
        nourut++;
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
  getGudang,
  getBarang,
  getDetailForm,
  saveData,
};