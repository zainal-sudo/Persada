const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
// Delphi: max(right(korh_nomor,4)) where korh_nomor like '{cabang}-KOR.{yymm}.%'
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-KOR.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(korh_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tkor_hdr
     WHERE korh_nomor LIKE ?`,
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
// Delphi bantuansku:
// SELECT brg_kode Sku, mst_expired_date Expired, brg_nama NamaBarang,
//        mst_idbatch IdBatch, SUM(mst_stok_in - mst_stok_out) stok
// FROM tbarang LEFT JOIN tmasterstok ON mst_brg_kode = brg_kode AND mst_gdg_kode = ?
// GROUP BY brg_kode, brg_nama, brg_satuan, mst_expired_date
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
// Delphi: cek stok per expired, kalau tidak ada fallback ke tbarang
const getDetailSKU = async (gudang, sku, expired) => {
  // Cek stok per expired
  if (expired) {
    const [[row]] = await db.query(
      `SELECT
         b.brg_kode AS sku,
         DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
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

  // Fallback ke tbarang
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

// ── Load Data All ────────────────────────────────────────────────────
// Delphi Button1Click:
// SELECT brg_kode Kode, brg_nama Nama, brg_satuan Satuan,
//        mst_expired_date Expired, gdg_nama Gudang,
//        SUM(mst_stok_in - mst_stok_out) Stok,
//        IFNULL((SELECT mst_hargabeli FROM tmasterstok
//                WHERE mst_noreferensi LIKE '%MTCI%' AND mst_brg_kode = brg_kode
//                ORDER BY mst_tanggal DESC LIMIT 1), 0) HRGBELI
// FROM tbarang
// INNER JOIN tmasterstok ON mst_brg_kode = brg_kode
// INNER JOIN tgudang ON gdg_kode = mst_gdg_kode
// WHERE mst_gdg_kode = ? AND mst_tanggal <= ?
// GROUP BY mst_gdg_kode, brg_kode, mst_expired_date, gdg_nama
// HAVING Stok <> 0
const loadDataAll = async (gudang, tanggal) => {
  const [rows] = await db.query(
    `SELECT
       b.brg_kode AS sku,
       b.brg_nama AS namaBarang,
       b.brg_satuan AS satuan,
       DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
       IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS system,
       IFNULL(
         (SELECT mst_hargabeli FROM tmasterstok
          WHERE mst_noreferensi LIKE '%MTCI%' AND mst_brg_kode = b.brg_kode
          ORDER BY mst_tanggal DESC LIMIT 1), 0) AS harga
     FROM tbarang b
     INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode
     INNER JOIN tgudang g ON g.gdg_kode = m.mst_gdg_kode
     WHERE m.mst_gdg_kode = ?
       AND m.mst_tanggal <= ?
     GROUP BY m.mst_gdg_kode, b.brg_kode, m.mst_expired_date, g.gdg_nama
     HAVING system <> 0
     ORDER BY b.brg_kode`,
    [gudang, tanggal]
  );

  return rows.map((r) => ({
    sku: r.sku,
    namaBarang: r.namaBarang,
    idBatch: "",
    satuan: r.satuan,
    expired: r.expired || "",
    fisik: 0,
    system: Number(r.system),
    qty: Number(r.system) * -1,
    harga: Number(r.harga),
    nilai: Number(r.harga) * Number(r.system) * -1,
    price: Number(r.harga) * 2,
    nilaiPrice: Number(r.harga) * 2 * Number(r.system) * -1,
  }));
};

// ── From Hitung Stok ─────────────────────────────────────────────────
// Delphi Button3Click:
// SELECT *, harga*jml Nilai FROM (
//   SELECT hitd_brg_kode, brg_nama, hitd_satuan, SUM(hitd_qty) jml, hitd_expired,
//     (SELECT mst_hargabeli FROM tmasterstok WHERE mst_noreferensi LIKE '%MTCI%'
//      AND MST_BRG_KODE = hitd_brg_kode ORDER BY mst_tanggal DESC LIMIT 1) harga
//   FROM thitungstok_dtl INNER JOIN tbarang ON brg_kode = hitd_brg_kode
//   INNER JOIN thitungstok ON hitd_hit_nomor = hit_nomor
//   WHERE hit_gdg_kode = ? AND hit_tanggal >= ?
//   GROUP BY hitd_brg_kode, brg_nama, hitd_expired) final
const fromHitungStok = async (gudang, tanggal) => {
  const [rows] = await db.query(
    `SELECT final.*, final.harga * final.jml AS Nilai
     FROM (
       SELECT
         d.hitd_brg_kode AS sku,
         b.brg_nama AS namaBarang,
         d.hitd_satuan AS satuan,
         SUM(d.hitd_qty) AS jml,
         DATE_FORMAT(d.hitd_expired, '%Y-%m-%d') AS expired,
         (SELECT mst_hargabeli FROM tmasterstok
          WHERE mst_noreferensi LIKE '%MTCI%' AND MST_BRG_KODE = d.hitd_brg_kode
          ORDER BY mst_tanggal DESC LIMIT 1) AS harga
       FROM thitungstok_dtl d
       INNER JOIN tbarang b ON b.brg_kode = d.hitd_brg_kode
       INNER JOIN thitungstok h ON d.hitd_hit_nomor = h.hit_nomor
       WHERE h.hit_gdg_kode = ?
         AND h.hit_tanggal >= ?
       GROUP BY d.hitd_brg_kode, b.brg_nama, d.hitd_expired
     ) final`,
    [gudang, tanggal]
  );

  return rows.map((r) => {
    const harga = Number(r.harga) || 0;
    const jml = Number(r.jml) || 0;
    const nilai = Number(r.Nilai) || 0;
    return {
      sku: r.sku,
      namaBarang: r.namaBarang,
      idBatch: "",
      satuan: r.satuan,
      expired: r.expired || "",
      fisik: jml,
      system: 0,
      qty: jml,
      harga: harga,
      nilai: nilai,
      price: harga * 2,
      nilaiPrice: nilai * 2,
    };
  });
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       korh_nomor AS nomor,
       DATE_FORMAT(korh_tanggal, '%Y-%m-%d') AS tanggal,
       korh_gdg_kode AS gudang,
       IFNULL(korh_notes, '') AS keterangan
     FROM tkor_hdr
     WHERE korh_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Koreksi stok tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       d.kord_brg_kode AS sku,
       b.brg_nama AS namaBarang,
       d.kord_satuan AS satuan,
       d.kord_idbatch AS idBatch,
       DATE_FORMAT(d.kord_expired, '%Y-%m-%d') AS expired,
       d.kord_stok AS fisik,
       d.kord_qty AS qty,
       d.kord_harga AS harga,
       d.kord_nilai AS nilai
     FROM tkor_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.kord_brg_kode
     WHERE d.kord_korh_nomor = ?
     ORDER BY d.kord_nourut`,
    [nomor]
  );

  const detail = detailRows.map((d, i) => {
    const fisik = Number(d.fisik);
    const qty = Number(d.qty);
    const system = fisik - qty;
    const harga = Number(d.harga);
    const nilai = Number(d.nilai);
    return {
      no: i + 1,
      sku: d.sku,
      namaBarang: d.namaBarang,
      idBatch: d.idBatch || "",
      satuan: d.satuan,
      expired: d.expired || "",
      fisik: fisik,
      system: system,
      qty: qty,
      harga: harga,
      nilai: nilai,
      price: harga * 2,
      nilaiPrice: nilai * 2,
    };
  });

  return { ...header, detail };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, gudang, keterangan, detail } = payload;

  // Hitung total nilai
  const total = detail.reduce((sum, d) => sum + Number(d.nilai), 0);

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tkor_hdr SET
           korh_tanggal = ?, korh_notes = ?, korh_gdg_kode = ?,
           korh_total = ?, date_modified = NOW(), user_modified = ?
         WHERE korh_nomor = ?`,
        [tanggal, keterangan, gudang, total, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tkor_hdr
           (korh_nomor, korh_tanggal, korh_notes, korh_gdg_kode, korh_total,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, keterangan, gudang, total, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tkor_dtl WHERE kord_korh_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    let nourut = 1;
    for (const d of detail) {
      if (d.sku && d.sku !== "0") {
        await conn.query(
          `INSERT INTO tkor_dtl
             (kord_korh_nomor, kord_brg_kode, kord_satuan, kord_idbatch,
              kord_expired, kord_qty, kord_harga, kord_nilai, kord_stok, kord_nourut)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.sku, d.satuan, d.idBatch,
            d.expired || null, d.qty, d.harga, d.nilai, d.fisik, nourut,
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
  loadDataAll,
  fromHitungStok,
  getDetailForm,
  saveData,
};