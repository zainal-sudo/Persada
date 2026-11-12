const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-MUS.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(mus_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tmus_hdr
     WHERE mus_nomor LIKE ?`,
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

// ── Search SKU ───────────────────────────────────────────────────────
const searchSKU = async (gudang, search = "") => {
  const [rows] = await db.query(
    `SELECT
       b.brg_kode AS sku,
       DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
       b.brg_nama AS namaBarang,
       IFNULL(m.mst_idbatch, '') AS idbatch,
       IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS stok
     FROM tbarang b
     LEFT JOIN tmasterstok m
       ON m.mst_brg_kode = b.brg_kode
      AND m.mst_gdg_kode = ?
     WHERE b.brg_nama LIKE ? OR b.brg_kode LIKE ?
     GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_idbatch
     ORDER BY b.brg_kode
     LIMIT 100`,
    [gudang, `%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get Detail SKU ───────────────────────────────────────────────────
const getDetailSKU = async (gudang, sku, expired) => {
  if (expired) {
    const [[row]] = await db.query(
      `SELECT
         b.brg_kode AS sku,
         b.brg_nama AS namaBarang,
         b.brg_satuan AS satuan,
         IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS stok,
         IFNULL(m.mst_hargabeli, 0) AS hargabeli,
         IFNULL(m.mst_idbatch, '') AS idbatch
       FROM tbarang b
       INNER JOIN tmasterstok m
         ON m.mst_brg_kode = b.brg_kode
        AND m.mst_gdg_kode = ?
       WHERE b.brg_kode = ?
         AND m.mst_expired_date = ?
       GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_hargabeli, m.mst_idbatch
       LIMIT 1`,
      [gudang, sku, expired]
    );
    if (row) return row;
  }

  const [[fallback]] = await db.query(
    `SELECT
       brg_kode AS sku,
       brg_nama AS namaBarang,
       brg_satuan AS satuan,
       0 AS stok,
       IFNULL(brg_hrgbeli, 0) AS hargabeli,
       '' AS idbatch
     FROM tbarang
     WHERE brg_kode = ?
     LIMIT 1`,
    [sku]
  );
  if (!fallback) throw new Error("SKU tidak ditemukan.");
  return fallback;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       mus_nomor AS nomor,
       DATE_FORMAT(mus_tanggal, '%Y-%m-%d') AS tanggal,
       mus_gdg_kode AS gudang,
       IFNULL(mus_notes, '') AS keterangan
     FROM tmus_hdr
     WHERE mus_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Pemusnahan tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       d.musd_brg_kode AS sku,
       b.brg_nama AS namaBarang,
       d.musd_brg_satuan AS satuan,
       d.musd_idbatch AS idBatch,
       DATE_FORMAT(d.musd_tgl_expired, '%Y-%m-%d') AS expired,
       d.musd_qty AS qty,
       d.musd_harga AS harga
     FROM tmus_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.musd_brg_kode
     WHERE d.musd_mus_nomor = ?
     ORDER BY d.musd_nourut`,
    [nomor]
  );

  return {
    ...header,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      sku: d.sku,
      namaBarang: d.namaBarang,
      idBatch: d.idBatch || "",
      satuan: d.satuan,
      expired: d.expired || "",
      qty: Number(d.qty),
      harga: Number(d.harga),
      nilai: Number(d.qty) * Number(d.harga),
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, gudang, keterangan, detail } = payload;

  const total = detail.reduce((sum, d) => sum + Number(d.nilai), 0);

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tmus_hdr SET
           mus_tanggal = ?, mus_notes = ?, mus_gdg_kode = ?,
           mus_total = ?, date_modified = NOW(), user_modified = ?
         WHERE mus_nomor = ?`,
        [tanggal, keterangan, gudang, total, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tmus_hdr
           (mus_nomor, mus_tanggal, mus_notes, mus_gdg_kode, mus_total,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, keterangan, gudang, total, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tmus_dtl WHERE musd_mus_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    let nourut = 1;
    for (const d of detail) {
      if (d.sku && d.sku !== "0") {
        await conn.query(
          `INSERT INTO tmus_dtl
             (musd_mus_nomor, musd_brg_kode, musd_brg_satuan, musd_tgl_expired,
              musd_qty, musd_harga, musd_idbatch, musd_nourut)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.sku, d.satuan, d.expired || null,
            d.qty, d.harga, d.idBatch || "", nourut,
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
  searchSKU,
  getDetailSKU,
  getDetailForm,
  saveData,
};