// services/penjualan/doFormService.js
const db = require("../../config/database");

// ── Generate Nomor DO ────────────────────────────────────────────────
// Format: PREFIX.DO.yymm.NNNN (PREFIX = div_prefix divisi SO), contoh:
// AMP.DO.2611.0001. Sequence terpisah pajak/non-pajak, terpisah dari
// nomor format lama (01-DO.yymm.xxxx).
const getMaxNomor = async (tanggal, isTax, divKode) => {
  if (!divKode) throw new Error("Divisi SO tidak ditemukan.");
  const [[div]] = await db.query(
    `SELECT div_prefix FROM tdivisi WHERE div_kode = ?`,
    [divKode]
  );
  if (!div || !div.div_prefix) throw new Error("Prefix divisi tidak ditemukan.");

  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${div.div_prefix}.DO.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(do_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tdo_hdr h
       INNER JOIN tso_hdr so ON so.so_nomor = h.do_so_nomor
       WHERE h.do_nomor LIKE ? AND so.so_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(do_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tdo_hdr h
       INNER JOIN tso_hdr so ON so.so_nomor = h.do_so_nomor
       WHERE h.do_nomor LIKE ? AND so.so_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  }
};

// ── Search SO ────────────────────────────────────────────────────────
const searchSO = async (search = "") => {
  const [rows] = await db.query(
    `SELECT so_nomor AS nomor, DATE_FORMAT(so_tanggal, '%Y-%m-%d') AS tanggal,
            c.cus_nama AS customer
     FROM tso_hdr so
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_isclosed = 0 AND so.so_isproforma = 0
       AND (so.so_nomor LIKE ? OR c.cus_nama LIKE ?)
     ORDER BY so.so_tanggal DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Sinkronisasi SO (paritas Delphi: CALL sp_sync_so) ────────────────
// Dipanggil setelah transaksi DO sukses; gagal tidak boleh menggagalkan simpan.
const syncSO = async (nomorSO) => {
  if (!nomorSO) return;
  try {
    const [[proc]] = await db.query(
      `SELECT ROUTINE_NAME FROM information_schema.ROUTINES
       WHERE ROUTINE_NAME = 'sp_sync_so'
         AND ROUTINE_SCHEMA = DATABASE() LIMIT 1`
    );
    if (!proc) return;
    await db.query(`CALL sp_sync_so(?)`, [nomorSO]);
  } catch (e) {
    console.warn("⚠️ Gagal sp_sync_so:", e.message);
  }
};

// ── Load SO Header ───────────────────────────────────────────────────
const loadSO = async (nomorSO) => {
  // Paritas Delphi: blok bila setor faktur bulan lalu belum selesai
  const setorErr = await cekSetorFaktur();
  if (setorErr) throw new Error(setorErr);

  const [[row]] = await db.query(
    `SELECT so.so_nomor, so.so_istax, so.so_isecer, so.so_div_kode,
            so.so_cus_kode, c.cus_nama, c.cus_alamat, c.cus_shipaddress
     FROM tso_hdr so
     LEFT JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_nomor = ?`,
    [nomorSO]
  );

  if (!row) throw new Error("Nomor SO tidak ditemukan.");

  return {
    nomorSO: row.so_nomor,
    isTax: row.so_istax,
    isEcer: row.so_isecer,
    divKode: row.so_div_kode || "",
    cusKode: row.so_cus_kode,
    cusNama: row.cus_nama || "",
    alamat: row.cus_alamat || "",
    shipAddress: row.cus_shipaddress || "",
  };
};

// ── Lookup Gudang ────────────────────────────────────────────────────
const getGudang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama,
            IFNULL(gdg_iskonsinyasi, 0) AS isKonsinyasi
     FROM tgudang
     WHERE gdg_nama LIKE ? OR gdg_kode LIKE ?
     ORDER BY gdg_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Driver ────────────────────────────────────────────────────
// Skema Delphi: hrd.tunit + hrd.tkaryawan (jabat 21/30). Bila schema HRD
// tidak tersedia di server ini, pakai fallback SALES/EKSPEDISI.
const getDriver = async () => {
  try {
    const [rows] = await db.query(
      `SELECT kar_namasingkat AS kode, UPPER(kar_nama) AS nama
       FROM hrd.tunit
       INNER JOIN hrd.tkaryawan ON kar_kd_unit = kd_unit
       WHERE LOWER(kode_cabang) = LOWER(?)
         AND (kar_kd_jabat = 21 OR kar_kd_jabat = 30)
         AND kar_status_aktif = 1
       UNION ALL
       SELECT 'SALES', 'SALES'
       UNION ALL
       SELECT 'EKSPEDISI', 'EKSPEDISI'`,
      [db.getCurrentDatabase()]
    );
    return rows;
  } catch {
    return [
      { kode: "SALES", nama: "SALES" },
      { kode: "EKSPEDISI", nama: "EKSPEDISI" },
    ];
  }
};

// ── Search Stok untuk Grid ───────────────────────────────────────────
const searchStok = async (nomorSO, gdgKode, nomorDO, search = "") => {
  const q = `%${search}%`;
  const [rows] = await db.query(
    `SELECT b.brg_kode AS sku,
            DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
            b.brg_nama AS namaBarang,
            m.mst_idbatch AS idBatch,
            SUM(m.mst_stok_in - m.mst_stok_out) AS stok,
            b.brg_satuan AS satuan,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi,
            (SELECT IFNULL(SUM(t.sod_qty - IFNULL(t.sod_qty_kirim, 0)), 0)
             FROM tso_dtl t
             WHERE t.sod_so_nomor = ? AND t.sod_brg_kode = b.brg_kode) AS kurang
      FROM tbarang b
      INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode 
        AND m.mst_gdg_kode = ?
      INNER JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode 
        AND d.sod_so_nomor = ?
      WHERE m.mst_noreferensi <> ?
        -- Item konsinyasi dicari lewat searchStokKons (stok di gudang konsinyasi)
        AND IFNULL(b.brg_iskonsinyasi, 0) = 0
        AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)
      GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_idbatch
      HAVING SUM(m.mst_stok_in - m.mst_stok_out) <> 0

      UNION

      -- Bagian 2 (paritas Delphi bantuansku): barang di SO yang TIDAK punya stok
      -- di gudang ini, tetap ditampilkan dengan stok 0 agar bisa dipilih.
      SELECT b.brg_kode AS sku,
             NULL AS expired,
             b.brg_nama AS namaBarang,
             '' AS idBatch,
             0 AS stok,
             b.brg_satuan AS satuan,
             IFNULL(b.brg_isexpired, 0) AS isExpired,
             IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi,
             (SELECT IFNULL(SUM(t2.sod_qty - IFNULL(t2.sod_qty_kirim, 0)), 0)
              FROM tso_dtl t2
              WHERE t2.sod_so_nomor = ? AND t2.sod_brg_kode = b.brg_kode) AS kurang
      FROM tbarang b
      INNER JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode 
        AND d.sod_so_nomor = ?
      WHERE b.brg_kode NOT IN (
        SELECT b2.brg_kode
        FROM tbarang b2
        INNER JOIN tmasterstok m2 ON m2.mst_brg_kode = b2.brg_kode 
          AND m2.mst_gdg_kode = ?
        INNER JOIN tso_dtl d2 ON d2.sod_brg_kode = b2.brg_kode 
          AND d2.sod_so_nomor = ?
        WHERE m2.mst_noreferensi <> ?
        GROUP BY b2.brg_kode, b2.brg_nama, b2.brg_satuan, m2.mst_expired_date, m2.mst_idbatch
        HAVING SUM(m2.mst_stok_in - m2.mst_stok_out) <> 0
      )
        AND IFNULL(b.brg_iskonsinyasi, 0) = 0
        AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)`,
    [nomorSO, gdgKode, nomorSO, nomorDO, q, q, nomorSO, nomorSO, gdgKode, nomorSO, nomorDO, q, q]
  );
  return rows;
};

// ── Search Stok Konsinyasi ───────────────────────────────────────────
// Stok barang konsinyasi di SEMUA gudang konsinyasi (hasil Titip Barang),
// lengkap dengan expired/idbatch + gudang konsinyasinya per baris.
const searchStokKons = async (nomorSO, nomorDO, search = "") => {
  const q = `%${search}%`;
  const [rows] = await db.query(
    `SELECT b.brg_kode AS sku,
            DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
            b.brg_nama AS namaBarang,
            m.mst_idbatch AS idBatch,
            SUM(m.mst_stok_in - m.mst_stok_out) AS stok,
            b.brg_satuan AS satuan,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            1 AS isKonsinyasi,
            m.mst_gdg_kode AS gdgKons,
            (SELECT IFNULL(SUM(t.sod_qty - IFNULL(t.sod_qty_kirim, 0)), 0)
             FROM tso_dtl t
             WHERE t.sod_so_nomor = ? AND t.sod_brg_kode = b.brg_kode) AS kurang
      FROM tbarang b
      INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode
        AND m.mst_gdg_kode IN (SELECT gdg_kode FROM tgudang WHERE IFNULL(gdg_iskonsinyasi, 0) = 1)
      INNER JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode
        AND d.sod_so_nomor = ?
      WHERE IFNULL(b.brg_iskonsinyasi, 0) = 1
        AND m.mst_noreferensi <> ?
        AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)
      GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_idbatch, m.mst_gdg_kode
      HAVING SUM(m.mst_stok_in - m.mst_stok_out) <> 0

      UNION

      -- Bagian 2: item konsinyasi di SO yang belum punya stok di gudang
      -- konsinyasi mana pun, tetap tampil dengan stok 0.
      SELECT b.brg_kode AS sku,
             NULL AS expired,
             b.brg_nama AS namaBarang,
             '' AS idBatch,
             0 AS stok,
             b.brg_satuan AS satuan,
             IFNULL(b.brg_isexpired, 0) AS isExpired,
             1 AS isKonsinyasi,
             '' AS gdgKons,
             (SELECT IFNULL(SUM(t2.sod_qty - IFNULL(t2.sod_qty_kirim, 0)), 0)
              FROM tso_dtl t2
              WHERE t2.sod_so_nomor = ? AND t2.sod_brg_kode = b.brg_kode) AS kurang
      FROM tbarang b
      INNER JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode
        AND d.sod_so_nomor = ?
      WHERE IFNULL(b.brg_iskonsinyasi, 0) = 1
        AND b.brg_kode NOT IN (
          SELECT b2.brg_kode
          FROM tbarang b2
          INNER JOIN tmasterstok m2 ON m2.mst_brg_kode = b2.brg_kode
            AND m2.mst_gdg_kode IN (SELECT gdg_kode FROM tgudang WHERE IFNULL(gdg_iskonsinyasi, 0) = 1)
          INNER JOIN tso_dtl d2 ON d2.sod_brg_kode = b2.brg_kode
            AND d2.sod_so_nomor = ?
          WHERE m2.mst_noreferensi <> ?
          GROUP BY b2.brg_kode, b2.brg_nama, b2.brg_satuan, m2.mst_expired_date, m2.mst_idbatch, m2.mst_gdg_kode
          HAVING SUM(m2.mst_stok_in - m2.mst_stok_out) <> 0
        )
        AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)`,
    [nomorSO, nomorSO, nomorDO, q, q, nomorSO, nomorSO, nomorDO, q, q]
  );
  return rows;
};

// ── Get Detail Stok ──────────────────────────────────────────────────
// Paritas Delphi bantuansku (ufrmDO.pas): di mode edit, baris BARU memakai
// sudah = 0 dan kurang = sisa SO penuh (sod_qty), karena DO ini sendiri
// belum dihitung sebagai pengiriman untuk baris baru.
const getDetailStok = async (sku, expired, nomorSO, gdgKode, isEdit = false, idBatch = null) => {
  // Baris bagian 2 konsinyasi belum punya stok & gudang → kembalikan info
  // barang + sisa SO saja (stok 0). Gudang konsinyasi diisi user di grid.
  if (!gdgKode) {
    const [[row0]] = await db.query(
      `SELECT b.brg_kode AS sku,
              NULL AS expired,
              b.brg_nama AS namaBarang,
              b.brg_satuan AS satuan,
              '' AS idBatch,
              0 AS stok,
              IFNULL(b.brg_isexpired, 0) AS isExpired,
              IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi,
              d.sod_qty_kirim AS sudah,
              d.sod_qty - d.sod_qty_kirim AS kurang
        FROM tbarang b
        LEFT JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode
          AND d.sod_so_nomor = ?
        WHERE b.brg_kode = ? LIMIT 1`,
      [nomorSO, sku]
    );
    if (!row0) return null;
    if (isEdit) {
      const [[dtl0]] = await db.query(
        `SELECT sod_qty FROM tso_dtl WHERE sod_so_nomor = ? AND sod_brg_kode = ? LIMIT 1`,
        [nomorSO, sku]
      );
      row0.sudah = 0;
      row0.kurang = Number(dtl0?.sod_qty || 0);
    }
    return row0;
  }
  const [[row]] = await db.query(
    `SELECT b.brg_kode AS sku,
            DATE_FORMAT(m.mst_expired_date, '%Y-%m-%d') AS expired,
            b.brg_nama AS namaBarang,
            b.brg_satuan AS satuan,
            m.mst_idbatch AS idBatch,
            SUM(m.mst_stok_in - m.mst_stok_out) AS stok,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi,
            d.sod_qty_kirim AS sudah,
            d.sod_qty - d.sod_qty_kirim AS kurang
      FROM tbarang b
     INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode
       AND m.mst_gdg_kode = ?
       AND m.mst_expired_date = ?
       ${idBatch !== null ? "AND mst_idbatch = ?" : ""}
     LEFT JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode
       AND d.sod_so_nomor = ?
     WHERE b.brg_kode = ?
     GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_idbatch`,
    idBatch !== null
      ? [gdgKode, expired, idBatch, nomorSO, sku]
      : [gdgKode, expired, nomorSO, sku]
  );
  if (!row) return null;

  if (isEdit) {
    // Delphi bantuansku: if FLAGEDIT then sudah := 0; kurang := aqtypo - sudah
    const [[dtl]] = await db.query(
      `SELECT sod_qty FROM tso_dtl WHERE sod_so_nomor = ? AND sod_brg_kode = ? LIMIT 1`,
      [nomorSO, sku]
    );
    row.sudah = 0;
    row.kurang = Number(dtl?.sod_qty || 0);
  }
  return row;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT h.do_nomor AS nomor, 
            DATE_FORMAT(h.do_tanggal, '%Y-%m-%d') AS tanggal,
            h.do_so_nomor AS nomorSO, 
            h.do_cus_kode AS cusKode, 
            h.do_shipaddress AS shipAddress, 
            h.do_memo AS memo,
            h.do_gdg_kode AS gdgKode, 
            h.do_isecer AS isEcer, 
            h.do_driver AS driver
     FROM tdo_hdr h WHERE h.do_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("DO tidak ditemukan.");

  // Ambil nama customer dari SO
  const [[so]] = await db.query(
    `SELECT so.so_cus_kode, c.cus_nama, c.cus_alamat, c.cus_shipaddress
     FROM tso_hdr so
     LEFT JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE so.so_nomor = ? LIMIT 1`,
    [h.nomorSO]
  );

  // Ambil nama gudang
  const [[gudang]] = await db.query(
    `SELECT gdg_nama FROM tgudang WHERE gdg_kode = ? LIMIT 1`,
    [h.gdgKode]
  );

  // Ambil detail + hitung sudah & kurang
  const [detailRows] = await db.query(
    `SELECT d.dod_brg_kode AS brgKode,
            b.brg_nama AS brgNama,
            d.dod_brg_satuan AS satuan,
            d.dod_qty AS qty,
            DATE_FORMAT(d.dod_tgl_expired, '%Y-%m-%d') AS expired,
            d.dod_status AS closed,
            d.dod_gdg_kode AS gudang,
            d.dod_gdg_kons AS gdgKons,
            d.dod_idbatch AS idBatch,
            IFNULL(b.brg_isexpired, 0) AS isExpired,
            IFNULL(b.brg_iskonsinyasi, 0) AS isKonsinyasi,
            (SELECT IFNULL(SUM(st.mst_stok_in - st.mst_stok_out), 0)
             FROM tmasterstok st
             WHERE st.mst_brg_kode = d.dod_brg_kode
               -- Stok barang konsinyasi dihitung di gudang konsinyasinya
               AND st.mst_gdg_kode = IF(IFNULL(b.brg_iskonsinyasi, 0) = 1,
                                        IFNULL(d.dod_gdg_kons, ''), d.dod_gdg_kode)
               AND st.mst_expired_date = d.dod_tgl_expired) AS stok
     FROM tdo_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.dod_brg_kode
     WHERE d.dod_do_nomor = ?
     ORDER BY d.dod_nourut ASC`,
    [nomor]
  );

  // Hitung sudah & kurang untuk tiap detail
  const detail = [];
  for (const d of detailRows) {
    // Ambil info SO detail
    const [[soDtl]] = await db.query(
      `SELECT sod_qty, sod_qty_kirim
       FROM tso_dtl 
       WHERE sod_so_nomor = ? AND sod_brg_kode = ?
       LIMIT 1`,
      [h.nomorSO, d.brgKode]
    );

    const qtyPO = Number(soDtl?.sod_qty || 0);
    const qtyKirim = Number(soDtl?.sod_qty_kirim || 0);

    // Paritas Delphi getqtydo: total qty pada DO INI untuk SKU ini
    const [[doIni]] = await db.query(
      `SELECT IFNULL(SUM(dod_qty), 0) AS total
       FROM tdo_dtl 
       WHERE dod_brg_kode = ? AND dod_do_nomor = ?
       LIMIT 1`,
      [d.brgKode, nomor]
    );

    const qtyDO = Number(doIni?.total || 0);

    // Paritas Delphi loaddataall:
    // Sudah  = qty_kirim - qty_do(DO ini)
    const sudah = qtyKirim - qtyDO;
    // Kurang = qty_po - qty_kirim + qty_do(DO ini)
    const kurang = qtyPO - qtyKirim + qtyDO;

    detail.push({
      no: d.brgKode ? detail.length + 1 : detail.length + 1,
      brgKode: d.brgKode,
      brgNama: d.brgNama || "",
      idBatch: d.idBatch || "",
      qty: Number(d.qty) || 0,
      satuan: d.satuan || "",
      sudah: sudah,
      kurang: kurang,
      expired: d.expired || "",
      closed: Number(d.closed) || 0,
      gudang: d.gudang || "",
      gdgKons: d.gdgKons || "",
      isKonsinyasi: Number(d.isKonsinyasi) || 0,
      isExpired: Number(d.isExpired) || 0,
      stok: Number(d.stok) || 0,
    });
  }

  return {
    ...h,
    cusNama: so?.cus_nama || "",
    alamat: so?.cus_alamat || "",
    shipAddress: h.shipAddress || so?.cus_shipaddress || "",
    gdgNama: gudang?.gdg_nama || "",
    detail,
  };
};

// ── Stok gudang per SKU-expired (paritas Delphi getstok) ──────────────
// Stok = sum(mst_stok_in - mst_stok_out) pada gudang & tanggal expired,
// exclude baris milik DO ini (mst_noreferensi <> nomor DO).
// Expired kosong = baris stok tanpa tanggal (NULL / tahun < 1900).
const getStok = async (sku, expired, gdgKode, nomorDO, idBatch = null) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(SUM(mst_stok_in - mst_stok_out), 0) AS stok
     FROM tmasterstok
     WHERE mst_brg_kode = ?
       AND ${expired ? "mst_expired_date = ?" : "IFNULL(YEAR(mst_expired_date), 0) < 1900"}
       AND mst_gdg_kode = ?
       AND ${idBatch !== null ? "mst_idbatch = ? AND" : ""} mst_noreferensi <> ?`,
    expired
      ? (idBatch !== null
          ? [sku, expired, gdgKode, idBatch, nomorDO || ""]
          : [sku, expired, gdgKode, nomorDO || ""])
      : (idBatch !== null
          ? [sku, gdgKode, idBatch, nomorDO || ""]
          : [sku, gdgKode, nomorDO || ""])
  );
  return row ? Number(row.stok) : 0;
};

// ── Cek periode sudah ditutup (paritas Delphi cekTutupPeriode) ────────
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

// ── Cek setor faktur (paritas Delphi ceksetorfaktur + getbatas) ───────
// True bila masih ada FP bulan lalu (atau tahun lalu) yang belum disetor
// dan tanggal hari ini sudah lewat batas setting 'DO'.
const cekSetorFaktur = async () => {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const [[fp]] = await db.query(
    `SELECT 1 FROM tfp_hdr
     WHERE fp_status_faktur IN ('GUDANG','SALESMAN','DRIVER')
       AND ( fp_tanggal < MAKEDATE(?, 1)
             OR (fp_tanggal < MAKEDATE(?, 1) AND YEAR(fp_tanggal) = ?) )
     LIMIT 1`,
    [tahun, tahun, tahun]
  );

  const [[batas]] = await db.query(
    `SELECT set_tgl FROM tsetting WHERE set_kode = 'DO' LIMIT 1`
  );

  const hariIni = now.getDate();
  const batasTgl = Number(batas?.set_tgl || 0);

  // Delphi: if ceksetorfaktur(...) and (day > getbatas('DO')) then block
  if (fp && batasTgl > 0 && hariIni > batasTgl) {
    return "SETOR FAKTUR PUTIH / BELUM LUNAS BULAN LALU MASIH BELUM DI SETORKAN";
  }
  return null;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, nomorSO, cusKode, shipAddress,
    memo, gdgKode, driver, isEcer, detail,
  } = payload;

  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    // Validasi konsinyasi: barang konsinyasi wajib mengisi gudang konsinyasi
    // di tiap detail, dan gudangnya harus benar-benar gudang konsinyasi.
    const brgKodes = [...new Set((detail || [])
      .filter((d) => Number(d.qty) > 0 && d.brgKode)
      .map((d) => d.brgKode))];
    if (brgKodes.length) {
      const [brgRows] = await conn.query(
        `SELECT brg_kode, IFNULL(brg_iskonsinyasi, 0) AS isk
         FROM tbarang WHERE brg_kode IN (?)`,
        [brgKodes]
      );
      const konsMap = new Map(brgRows.map((r) => [r.brg_kode, Number(r.isk)]));
      for (const d of detail) {
        if (Number(d.qty) <= 0 || !d.brgKode) continue;
        if (konsMap.get(d.brgKode) === 1 && !d.gdgKons) {
          throw new Error(
            `Barang ${d.brgKode} konsinyasi — gudang konsinyasi wajib diisi.`
          );
        }
        if (d.gdgKons) {
          const [[g]] = await conn.query(
            `SELECT IFNULL(gdg_iskonsinyasi, 0) AS isk
             FROM tgudang WHERE gdg_kode = ?`,
            [d.gdgKons]
          );
          if (!g || Number(g.isk) !== 1) {
            throw new Error(`Gudang ${d.gdgKons} bukan gudang konsinyasi.`);
          }
        }
      }
    }

    if (isEdit) {
      // Paritas Delphi ufrmBrowseDO.cekinvoice: DO yang sudah ada invoice
      // tidak boleh diedit.
      const [[dohdr]] = await conn.query(
        `SELECT do_isInvoice FROM tdo_hdr WHERE do_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!dohdr) throw new Error("DO tidak ditemukan.");
      if (Number(dohdr.do_isInvoice) === 1)
        throw new Error("Transaksi ini sudah ada Invoice, tidak dapat diedit.");

      // Paritas Delphi dtTanggalChange: nomor DO mengandung yymm, jadi edit
      // tidak boleh pindah bulan/tahun (prefix CABANG-DO.yymm. harus tetap).
      const secondDot = nomor.indexOf(".", nomor.indexOf(".") + 1);
      const prefixPart = nomor.slice(0, secondDot + 1).replace(/\d{4}\.$/, ""); // "01-DO."
      const yy = String(new Date(tanggal).getFullYear()).slice(2);
      const mm = String(new Date(tanggal).getMonth() + 1).padStart(2, "0");
      const newPrefix = `${prefixPart}${yy}${mm}.`;
      if (nomor.slice(0, secondDot + 1) !== newPrefix) {
        throw new Error("Perubahan tanggal tidak bisa beda bulan dan tahun");
      }

      await conn.query(
        `UPDATE tdo_hdr SET
           do_tanggal = ?, do_gdg_kode = ?, do_memo = ?,
           do_shipaddress = ?, do_isecer = ?, do_driver = ?,
           date_modified = NOW(), user_modified = ?
         WHERE do_nomor = ?`,
        [tanggal, gdgKode, memo, shipAddress, isEcer, driver, user.kode, nomor]
      );
    } else {
      // Get isTax + divisi dari SO
      const [[so]] = await conn.query(
        `SELECT so_istax, so_div_kode FROM tso_hdr WHERE so_nomor = ?`,
        [nomorSO]
      );
      const isTax = so?.so_istax || 1;
      const divKode = so?.so_div_kode || "";

      actualNomor = await getMaxNomor(tanggal, isTax, divKode);

      await conn.query(
        `INSERT INTO tdo_hdr
           (do_nomor, do_tanggal, do_gdg_kode, do_so_nomor, do_cus_kode,
            do_shipaddress, do_isecer, do_memo, do_driver, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, tanggal, gdgKode, nomorSO, cusKode,
          shipAddress, isEcer, memo, driver, user.kode,
        ]
      );
    }

    // Hapus detail lama
    await conn.query(`DELETE FROM tdo_dtl WHERE dod_do_nomor = ?`, [actualNomor]);

    // Insert detail
    let nourut = 1;
    for (const d of detail) {
      if (Number(d.qty) > 0) {
        await conn.query(
          `INSERT INTO tdo_dtl
             (dod_do_nomor, dod_brg_kode, dod_brg_satuan, dod_qty,
              dod_tgl_expired, dod_nourut, dod_status, dod_gdg_kode,
              dod_gdg_kons, dod_idbatch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.brgKode, d.satuan, d.qty,
            d.expired, nourut, d.closed, d.gudang,
            d.gdgKons || null, d.idBatch,
          ]
        );
        nourut++;
      }
    }

    await conn.commit();

    // Paritas Delphi simpandata: sinkronisasi status SO setelah DO dibuat
    await syncSO(nomorSO);

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
  searchSO,
  loadSO,
  getGudang,
  getDriver,
  searchStok,
  searchStokKons,
  getDetailStok,
  getStok,
  getDetailForm,
  saveData,
  syncSO,
};