const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-PB.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(pb_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tpermintaanbarang_hdr
     WHERE pb_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// ── Search SKU ───────────────────────────────────────────────────────
const searchSKU = async (search = "", pbNomor = "") => {
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

// ── Get Detail SKU ───────────────────────────────────────────────────
const getDetailSKU = async (sku, pbNomor = "") => {
  const [[row]] = await db.query(
    `SELECT
       b.brg_kode AS sku,
       b.brg_nama AS namaBarang,
       b.brg_satuan AS satuan,
       IFNULL((SELECT SUM(pbd_qty - pbd_qtyterima)
         FROM tpermintaanbarang_hdr
         INNER JOIN tpermintaanbarang_dtl ON pb_nomor = pbd_pb_nomor
         WHERE pb_isclosed = 0 AND pbd_brg_kode = b.brg_kode), 0) AS qtyPending,
       IFNULL((SELECT SUM(mutcid_qty)
         FROM tmutcabin_dtl
         INNER JOIN tmutcabin_hdr ON mutci_nomor = mutcid_mutci_nomor
         WHERE mutcid_brg_kode = b.brg_kode
           AND mutci_tanggal >= CURDATE() - INTERVAL 7 DAY), 0) AS realisasiIn,
       IFNULL((SELECT SUM(mst_stok_in - mst_stok_out)
         FROM tmasterstok
         WHERE mst_brg_kode = b.brg_kode AND mst_gdg_kode = 'WH-01'), 0) AS stokNow,
       IFNULL((SELECT SUM(fpd_qty) / 3
         FROM tfp_dtl
         INNER JOIN tfp_hdr ON fp_nomor = fpd_fp_nomor
         WHERE fp_tanggal >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
           AND fp_tanggal <= CURDATE()
           AND fpd_brg_kode = b.brg_kode), 0) AS avgSale
     FROM tbarang b
     WHERE b.brg_kode = ?`,
    [sku]
  );

  if (!row) throw new Error("SKU tidak ditemukan.");

  const sisa = row.qtyPending - row.realisasiIn;
  return {
    ...row,
    sisa: sisa > 0 ? sisa : 0,
    keterangan: "",
  };
};

// ── Search PB (Minggu Lalu) ──────────────────────────────────────────
const searchPB = async (tanggal) => {
  const [rows] = await db.query(
    `SELECT pb_nomor AS nomor, DATE_FORMAT(pb_tanggal, '%Y-%m-%d') AS tanggal
     FROM tpermintaanbarang_hdr
     WHERE pb_tanggal >= DATE_SUB(?, INTERVAL 7 DAY)
     GROUP BY pb_nomor
     ORDER BY pb_nomor ASC`,
    [tanggal]
  );
  return rows;
};

// ── Load PB Detail ───────────────────────────────────────────────────
const loadPB = async (pbNomor) => {
  const [rows] = await db.query(
    `SELECT
       d.pbd_brg_kode AS sku,
       b.brg_nama AS namaBarang,
       d.pbd_satuan AS satuan,
       d.pbd_qty AS qty,
       IFNULL((SELECT SUM(mst_stok_in - mst_stok_out)
         FROM tmasterstok WHERE mst_brg_kode = d.pbd_brg_kode AND mst_gdg_kode = 'WH-01'), 0) AS stokNow,
       IFNULL(d.pbd_avgsale, 0) AS avgSale,
       IFNULL(d.pbd_keterangan, '') AS keterangan
     FROM tpermintaanbarang_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.pbd_brg_kode
     WHERE d.pbd_pb_nomor = ?
     ORDER BY d.pbd_nourut`,
    [pbNomor]
  );

  const result = [];
  for (const r of rows) {
    const detail = await getDetailSKU(r.sku);
    result.push({
      sku: r.sku,
      namaBarang: r.namaBarang,
      satuan: r.satuan,
      mingguLalu: detail.qtyPending,
      realisasiIn: detail.realisasiIn,
      sisa: detail.sisa,
      qty: detail.qtyPending,
      stokNow: detail.stokNow,
      avgSale: detail.avgSale,
      keterangan: r.keterangan,
    });
  }
  return result;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       pb_nomor AS nomor,
       DATE_FORMAT(pb_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(pb_memo, '') AS memo
     FROM tpermintaanbarang_hdr
     WHERE pb_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Permintaan barang tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       d.pbd_brg_kode AS sku,
       b.brg_nama AS namaBarang,
       d.pbd_satuan AS satuan,
       d.pbd_qty AS qty,
       IFNULL(d.pbd_stoknow, 0) AS stokNow,
       IFNULL(d.pbd_avgsale, 0) AS avgSale,
       IFNULL(d.pbd_keterangan, '') AS keterangan
     FROM tpermintaanbarang_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.pbd_brg_kode
     WHERE d.pbd_pb_nomor = ?
     ORDER BY d.pbd_nourut`,
    [nomor]
  );

  return {
    ...header,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      sku: d.sku,
      namaBarang: d.namaBarang,
      satuan: d.satuan,
      mingguLalu: 0,
      realisasiIn: 0,
      sisa: 0,
      qty: Number(d.qty),
      stokNow: Number(d.stokNow),
      avgSale: Number(d.avgSale),
      keterangan: d.keterangan,
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, memo, detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      // Paritas loaddataall Delphi: dokumen umur > 3 hari tidak dapat diedit.
      const [[hdr]] = await conn.query(
        `SELECT DATEDIFF(NOW(), pb_tanggal) AS umur FROM tpermintaanbarang_hdr WHERE pb_nomor = ?`,
        [nomor]
      );
      if (!hdr) throw new Error("Permintaan barang tidak ditemukan.");
      if (Number(hdr.umur) >= 3)
        throw new Error("Data lebih dari 3 hari tidak dapat diedit.");

      await conn.query(
        `UPDATE tpermintaanbarang_hdr SET
           pb_memo = ?, pb_tanggal = ?,
           date_modified = NOW(), user_modified = ?
         WHERE pb_nomor = ?`,
        [memo, tanggal, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tpermintaanbarang_hdr
           (pb_nomor, pb_tanggal, pb_memo, date_create, user_create)
         VALUES (?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, memo, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tpermintaanbarang_dtl WHERE pbd_pb_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru (hanya qty > 0)
    let nourut = 1;
    for (const d of detail) {
      if (Number(d.qty) > 0) {
        await conn.query(
          `INSERT INTO tpermintaanbarang_dtl
             (pbd_pb_nomor, pbd_brg_kode, pbd_satuan, pbd_qty, pbd_keterangan, pbd_nourut)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [actualNomor, d.sku, d.satuan, d.qty, d.keterangan || "", nourut]
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
  searchSKU,
  getDetailSKU,
  searchPB,
  loadPB,
  getDetailForm,
  saveData,
};