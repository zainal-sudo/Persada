// services/persediaan/titipService.js
// Titip Barang Konsinyasi — barang masuk ke gudang konsinyasi.
// Nomor: TB.yymm.NNNN (single sequence, tanpa divisi/cabang prefix).
const db = require("../../config/database");

// ── Generate Nomor Titip ─────────────────────────────────────────────
const getMaxNomor = async (tanggal) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `TB.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(titip_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM ttitip_hdr WHERE titip_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  const shortNum = String(nextNum).slice(-4);
  return `${prefix}${shortNum.padStart(4, "0")}`;
};

// ── Lookup Gudang (hanya gudang konsinyasi) ──────────────────────────
const getGudang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama,
            IFNULL(gdg_iskonsinyasi, 0) AS isKonsinyasi
     FROM tgudang
     WHERE IFNULL(gdg_iskonsinyasi, 0) = 1
       AND (gdg_nama LIKE ? OR gdg_kode LIKE ?)
     ORDER BY gdg_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Barang (hanya barang konsinyasi) ──────────────────────────
const searchBarang = async (search = "") => {
  const q = `%${search}%`;
  const [rows] = await db.query(
    `SELECT b.brg_kode AS sku,
            b.brg_nama AS namaBarang,
            b.brg_satuan AS satuan,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi
     FROM tbarang b
     WHERE IFNULL(b.brg_iskonsinyasi, 0) = 1
       AND (b.brg_nama LIKE ? OR CAST(b.brg_kode AS CHAR) LIKE ?)
     ORDER BY b.brg_nama LIMIT 50`,
    [q, q]
  );
  return rows;
};

// ── Cek periode sudah ditutup (paritas DO) ───────────────────────────
const cekTutupPeriode = async (tanggal) => {
  const d = new Date(tanggal);
  const bulan = d.getMonth() + 1;
  const tahun = d.getFullYear();
  const [[row]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [bulan, tahun]
  );
  return !!row;
};

// ── Browse Titip ─────────────────────────────────────────────────────
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT h.titip_nomor AS Nomor,
            DATE_FORMAT(h.titip_tanggal, '%Y-%m-%d') AS Tanggal,
            h.titip_gdg_kode AS Gudang,
            IFNULL(g.gdg_nama, '') AS Nama_Gudang,
            IFNULL(h.user_create, '') AS User
     FROM ttitip_hdr h
     LEFT JOIN tgudang g ON g.gdg_kode = h.titip_gdg_kode
     WHERE h.titip_tanggal BETWEEN ? AND ?
     ORDER BY h.titip_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

// ── Browse Detail Titip ──────────────────────────────────────────────
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT d.titd_titip_nomor AS Nomor,
            d.titd_brg_kode AS Kode,
            b.brg_nama AS Nama,
            d.titd_brg_satuan AS Satuan,
            d.titd_qty AS Jumlah,
            DATE_FORMAT(d.titd_tgl_expired, '%Y-%m-%d') AS Expired,
            IFNULL(d.titd_idbatch, '') AS Batch
     FROM ttitip_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.titd_brg_kode
     WHERE d.titd_titip_nomor = ?
     ORDER BY d.titd_nourut ASC`,
    [nomor]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT h.titip_nomor AS nomor,
            DATE_FORMAT(h.titip_tanggal, '%Y-%m-%d') AS tanggal,
            h.titip_gdg_kode AS gdgKode,
            h.titip_memo AS memo,
            IFNULL(h.user_create, '') AS userCreate
     FROM ttitip_hdr h WHERE h.titip_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("Titip tidak ditemukan.");

  const [[gudang]] = await db.query(
    `SELECT gdg_nama FROM tgudang WHERE gdg_kode = ? LIMIT 1`,
    [h.gdgKode]
  );

  const [detailRows] = await db.query(
    `SELECT d.titd_brg_kode AS brgKode,
            b.brg_nama AS brgNama,
            d.titd_brg_satuan AS satuan,
            d.titd_qty AS qty,
            DATE_FORMAT(d.titd_tgl_expired, '%Y-%m-%d') AS expired,
            IFNULL(d.titd_idbatch, '') AS idBatch,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi
     FROM ttitip_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.titd_brg_kode
     WHERE d.titd_titip_nomor = ?
     ORDER BY d.titd_nourut ASC`,
    [nomor]
  );

  const detail = detailRows.map((d, i) => ({
    no: i + 1,
    brgKode: d.brgKode,
    brgNama: d.brgNama || "",
    qty: Number(d.qty) || 0,
    satuan: d.satuan || "",
    expired: d.expired || "",
    idBatch: d.idBatch || "",
    isExpired: Number(d.isExpired) || 0,
    isKonsinyasi: Number(d.isKonsinyasi) || 0,
  }));

  return {
    ...h,
    gdgNama: gudang?.gdg_nama || "",
    detail,
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, gdgKode, memo, detail } = payload;

  if (!tanggal) throw new Error("Tanggal wajib diisi.");
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }
  if (!gdgKode) throw new Error("Gudang konsinyasi wajib dipilih.");

  // Gudang harus gudang konsinyasi
  const [[g]] = await db.query(
    `SELECT IFNULL(gdg_iskonsinyasi, 0) AS isk FROM tgudang WHERE gdg_kode = ?`,
    [gdgKode]
  );
  if (!g || Number(g.isk) !== 1) {
    throw new Error("Gudang harus gudang konsinyasi.");
  }

  // Validasi detail: barang wajib konsinyasi
  const rows = (detail || []).filter((d) => Number(d.qty) > 0 && d.brgKode);
  if (!rows.length) throw new Error("Detail barang wajib diisi.");
  const brgKodes = [...new Set(rows.map((d) => d.brgKode))];
  const [brgRows] = await db.query(
    `SELECT brg_kode, IFNULL(brg_iskonsinyasi, 0) AS isk,
            IFNULL(brg_isexpired, 0) AS ise
     FROM tbarang WHERE brg_kode IN (?)`,
    [brgKodes]
  );
  const brgMap = new Map(
    brgRows.map((r) => [r.brg_kode, { isk: Number(r.isk), ise: Number(r.ise) }])
  );
  for (const d of rows) {
    const b = brgMap.get(d.brgKode);
    if (!b) throw new Error(`Barang ${d.brgKode} tidak ditemukan.`);
    if (b.isk !== 1) {
      throw new Error(`Barang ${d.brgKode} bukan barang konsinyasi.`);
    }
    if (b.ise === 1 && !d.expired) {
      throw new Error(`Expired baris barang ${d.brgKode} wajib diisi.`);
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let actualNomor = nomor;

    if (isEdit) {
      const [[hdr]] = await conn.query(
        `SELECT titip_nomor FROM ttitip_hdr WHERE titip_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!hdr) throw new Error("Titip tidak ditemukan.");

      // Nomor mengandung yymm — edit tidak boleh pindah bulan/tahun
      const d = new Date(tanggal);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yymm = `${yy}${mm}`;
      if (nomor.slice(3, 7) !== yymm) {
        throw new Error("Perubahan tanggal tidak bisa beda bulan dan tahun");
      }

      await conn.query(
        `UPDATE ttitip_hdr SET
           titip_tanggal = ?, titip_gdg_kode = ?, titip_memo = ?,
           date_modified = NOW(), user_modified = ?
         WHERE titip_nomor = ?`,
        [tanggal, gdgKode, memo || null, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal);
      await conn.query(
        `INSERT INTO ttitip_hdr
           (titip_nomor, titip_tanggal, titip_gdg_kode, titip_memo,
            date_create, user_create)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, gdgKode, memo || null, user.kode]
      );
    }

    // Hapus detail lama → trigger menghapus entri stok by noreferensi.
    // Insert baru → trigger menambahkan stok masuk di gudang konsinyasi.
    await conn.query(
      `DELETE FROM ttitip_dtl WHERE titd_titip_nomor = ?`,
      [actualNomor]
    );

    let nourut = 1;
    for (const d of rows) {
      await conn.query(
        `INSERT INTO ttitip_dtl
           (titd_titip_nomor, titd_brg_kode, titd_brg_satuan, titd_qty,
            titd_tgl_expired, titd_idbatch, titd_nourut)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor,
          d.brgKode,
          d.satuan || "",
          Number(d.qty),
          d.expired || "0000-00-00",
          d.idBatch || "",
          nourut,
        ]
      );
      nourut++;
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

// ── Delete Titip ─────────────────────────────────────────────────────
const deleteData = async (nomor) => {
  const [[hdr]] = await db.query(
    `SELECT titip_nomor FROM ttitip_hdr WHERE titip_nomor = ?`,
    [nomor]
  );
  if (!hdr) throw new Error("Data titip tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    // Trigger per baris menghapus entri stok + mengurangi brg_stok
    await conn.query(`DELETE FROM ttitip_dtl WHERE titd_titip_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM ttitip_hdr WHERE titip_nomor = ?`, [nomor]);
    await conn.commit();
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
  searchBarang,
  getBrowse,
  getBrowseDetail,
  getDetailForm,
  saveData,
  deleteData,
};
