const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
// Format: MTG.{yymm}.{4digit}
const getMaxNomor = async (tanggal) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `MTG.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(mut_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tmutasi_hdr
     WHERE mut_nomor LIKE ?`,
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
       b.brg_satuan AS satuan,
       IFNULL(m.mst_idbatch, '') AS idBatch,
       IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS stok
     FROM tbarang b
     INNER JOIN tmasterstok m
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
  const [[row]] = await db.query(
    `SELECT
       b.brg_kode AS sku,
       b.brg_nama AS namaBarang,
       b.brg_satuan AS satuan,
       IFNULL(m.mst_idbatch, '') AS idBatch,
       IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS stok
     FROM tbarang b
     INNER JOIN tmasterstok m
       ON m.mst_brg_kode = b.brg_kode
      AND m.mst_gdg_kode = ?
     WHERE b.brg_kode = ?
       AND m.mst_expired_date = ?
     GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_idbatch`,
    [gudang, sku, expired]
  );
  if (!row) throw new Error("SKU tidak ditemukan.");
  return row;
};

// ── Get Stok ─────────────────────────────────────────────────────────
const getStok = async (gudang, sku, expired) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(SUM(mst_stok_in - mst_stok_out), 0) AS stok
     FROM tmasterstok
     WHERE mst_brg_kode = ?
       AND mst_gdg_kode = ?
       AND mst_expired_date = ?`,
    [sku, gudang, expired]
  );
  return Number(row?.stok) || 0;
};

// ── Load Data All ────────────────────────────────────────────────────
const loadDataAll = async (gudang) => {
  const [rows] = await db.query(
    `SELECT
       b.brg_kode AS sku,
       b.brg_nama AS namaBarang,
       b.brg_satuan AS satuan,
       DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
       IFNULL(m.mst_idbatch, '') AS idBatch,
       IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS qty
     FROM tbarang b
     INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode
     INNER JOIN tgudang g ON g.gdg_kode = m.mst_gdg_kode
     WHERE m.mst_gdg_kode = ?
     GROUP BY m.mst_gdg_kode, b.brg_kode, m.mst_expired_date, m.mst_idbatch, g.gdg_nama
     HAVING qty <> 0
     ORDER BY b.brg_kode`,
    [gudang]
  );

  return rows.map((r) => ({
    sku: r.sku,
    namaBarang: r.namaBarang,
    satuan: r.satuan,
    qty: Number(r.qty),
    expired: r.expired || "",
    idBatch: r.idBatch || "",
    keterangan: "",
    gudang: gudang,
  }));
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       mut_nomor AS nomor,
       DATE_FORMAT(mut_tanggal, '%Y-%m-%d') AS tanggal,
       mut_gdg_asal AS gudangAsal,
       mut_gdg_tujuan AS gudangTujuan,
       IFNULL(mut_keterangan, '') AS keterangan
     FROM tmutasi_hdr
     WHERE mut_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Mutasi gudang tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       d.mutd_brg_kode AS sku,
       b.brg_nama AS namaBarang,
       b.brg_satuan AS satuan,
       d.mutd_qty AS qty,
       DATE_FORMAT(d.mutd_expired, '%Y-%m-%d') AS expired,
       IFNULL(d.mutd_keterangan, '') AS keterangan,
       IFNULL(d.mutd_idbatch, '') AS idBatch,
       d.mutd_gdg_kode AS gudang
     FROM tmutasi_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.mutd_brg_kode
     WHERE d.mutd_mut_nomor = ?
     ORDER BY d.mutd_nourut`,
    [nomor]
  );

  return {
    ...header,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      ...d,
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, gudangAsal, gudangTujuan, keterangan, detail,
  } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      // Paritas Delphi browse: mutasi yang sudah Realisasi tidak dapat diedit
      // (guard server-side; trigger after_update non-idempotent → cegah dobel-post).
      const [[hdr]] = await conn.query(
        `SELECT mut_status_realisasi FROM tmutasi_hdr WHERE mut_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!hdr) throw new Error("Data mutasi gudang tidak ditemukan.");
      if (Number(hdr.mut_status_realisasi) === 1)
        throw new Error("Transaksi ini sudah Realisasi, tidak dapat diedit.");

      await conn.query(
        `UPDATE tmutasi_hdr SET
           mut_tanggal = ?, mut_keterangan = ?, mut_gdg_asal = ?,
           mut_gdg_tujuan = ?, date_modified = NOW(), user_modified = ?
         WHERE mut_nomor = ?`,
        [tanggal, keterangan, gudangAsal, gudangTujuan, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal);
      await conn.query(
        `INSERT INTO tmutasi_hdr
           (mut_nomor, mut_tanggal, mut_keterangan, mut_gdg_asal,
            mut_gdg_tujuan, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, keterangan, gudangAsal, gudangTujuan, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tmutasi_dtl WHERE mutd_mut_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    let nourut = 1;
    for (const d of detail) {
      if (Number(d.qty) > 0 && d.sku && d.sku !== "0") {
        await conn.query(
          `INSERT INTO tmutasi_dtl
             (mutd_mut_nomor, mutd_brg_kode, mutd_qty, mutd_keterangan,
              mutd_expired, mutd_nourut, mutd_gdg_kode, mutd_idbatch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.sku, d.qty, d.keterangan || "",
            d.expired || "0000-00-00", nourut, d.gudang, d.idBatch || "",
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
  getStok,
  loadDataAll,
  getDetailForm,
  saveData,
};