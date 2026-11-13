// services/penjualan/soFormService.js
const db = require("../../config/database");

// ── Lookup Customer ──────────────────────────────────────────────────
const getCustomer = async (search = "") => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama, cus_alamat AS alamat,
            cus_shipaddress AS shipAddress, cus_jc_kode AS jenisCustomer,
            cus_locked AS locked
     FROM tcustomer
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     ORDER BY cus_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Salesman Aktif (combo kiri — bisa dipilih) ────────────────
// Hanya salesman yang punya rayon (ada di tsalesmanaktif_dtl),
// tiap salesman membawa daftar rayon-nya (urut nourut).
const getSalesmanAktif = async () => {
  const [rows] = await db.query(
    `SELECT sa.sla_kode AS kode, sa.sla_nama AS nama,
            d.slad_sls_kode AS slsKode, s.sls_nama AS slsNama
     FROM tsalesmanaktif sa
     JOIN tsalesmanaktif_dtl d ON d.slad_sla_kode = sa.sla_kode
     LEFT JOIN tsalesman s ON s.sls_kode = d.slad_sls_kode
     WHERE sa.sla_isaktif = 1
     ORDER BY sa.sla_nama, d.slad_nourut`
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.kode)) {
      map.set(r.kode, { kode: r.kode, nama: r.nama, rayons: [] });
    }
    map.get(r.kode).rayons.push({ kode: r.slsKode, nama: r.slsNama || r.slsKode });
  }
  return [...map.values()];
};

// ── Lookup Salesman (combo kanan — readonly/disable) ─────────────────
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
     FROM tsalesman
     ORDER BY sls_nama`
  );
  return rows;
};

// ── Lookup Rekening ──────────────────────────────────────────────────
const getRekening = async (search = "") => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     WHERE rek_nama LIKE ? OR rek_kode LIKE ?
     ORDER BY rek_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Barang ────────────────────────────────────────────────────
const getBarang = async (search = "", jenisCustomer = "") => {
  const [rows] = await db.query(
    `SELECT b.brg_kode AS kode, b.brg_nama AS nama, b.brg_satuan AS satuan,
            IFNULL(h.hjj_hargajual, b.brg_hrgjual) AS hargaJual,
            IFNULL(b.brg_disc_sales, 0) AS discSales
     FROM tbarang b
     LEFT JOIN thargajualjenis h 
       ON h.hjj_brg_kode = b.brg_kode 
       AND h.hjj_jc_kode = ?
     WHERE b.brg_nama LIKE ? OR b.brg_kode LIKE ?
     ORDER BY b.brg_nama LIMIT 50`,
    [jenisCustomer, `%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Generate Nomor SO ────────────────────────────────────────────────
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-SO.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    // PAJAK: 10000 + max(4 digit terakhir) + 1 → ambil 4 digit terakhir
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(so_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tso_hdr 
       WHERE so_nomor LIKE ? AND so_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);   // ← FIX
    return `${prefix}${shortNum.padStart(4, "0")}`;
  } else {
    // NON-PAJAK: 15000 + max(3 digit terakhir) + 1 → ambil 4 digit terakhir
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(so_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tso_hdr 
       WHERE so_nomor LIKE ? AND so_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  }
};

// ── Check Customer Locked ────────────────────────────────────────────
const checkCustomerLocked = async (cusKode) => {
  const [[row]] = await db.query(
    `SELECT cus_locked FROM tcustomer WHERE cus_kode = ?`,
    [cusKode]
  );
  return row ? Number(row.cus_locked) === 1 : false;
};

// ── Get Disc Sales ───────────────────────────────────────────────────
const getDiscSales = async (brgKode) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(brg_disc_sales, 0) AS discSales 
     FROM tbarang WHERE brg_kode = ?`,
    [brgKode]
  );
  return row ? Number(row.discSales) : 0;
};

// ── Get Last Cost ────────────────────────────────────────────────────
const getLastCost = async (brgKode) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MST_HARGABELI, 0) AS lastCost
     FROM tmasterstok
     WHERE mst_brg_kode = ?
       AND mst_hargabeli > 1
       AND (mst_noreferensi LIKE '%MTCI%' OR mst_noreferensi LIKE '%KOR%')
     ORDER BY mst_tanggal DESC
     LIMIT 1`,
    [brgKode]
  );
  return row ? Number(row.lastCost) : 0;
};

// ── Ambil SO dari Database Kedua ─────────────────────────────────────
const getAmbilSO = async (cabang, databaseUtama) => {
  const [[config]] = await db.query(
    `SELECT ahost, adatabase, auser, apassword 
     FROM tsetingdb WHERE nama = 'default2'`
  );

  if (!config) throw new Error("Konfigurasi database kedua tidak ditemukan.");

  const mysql = require("mysql2/promise");
  const conn2 = await mysql.createConnection({
    host: config.ahost,
    user: config.auser,
    password: config.apassword,
    database: config.adatabase,
  });

  try {
    const [rows] = await conn2.query(
      `SELECT 
         h.so_nomor, 
         h.so_cus_kode, 
         c.cus_nama, 
         DATE_FORMAT(h.so_tanggal, '%Y-%m-%d') AS so_tanggal,
         s.sls_nama AS Rayon,
         (SELECT sla_nama FROM \`${databaseUtama}\`.tsalesmanaktif 
          WHERE sla_sls_kode = h.so_sls_kode AND sla_isaktif = 1 
          LIMIT 1) AS Salesman
       FROM tso_hdr h
       INNER JOIN \`${databaseUtama}\`.tcustomer c ON c.cus_kode = h.so_cus_kode
       INNER JOIN \`${databaseUtama}\`.tsalesman s ON s.sls_kode = h.so_sls_kode
       WHERE h.so_cabang = ?
         AND h.so_statuskirim = 1
         AND h.so_tanggal > CURDATE() - INTERVAL 7 DAY
       ORDER BY h.so_tanggal DESC, s.sls_nama ASC`,
      [cabang]
    );
    return rows;
  } finally {
    await conn2.end();
  }
};


// ── Get Detail SO dari Database Kedua ────────────────────────────────
const getDetailAmbilSO = async (nomor, databaseUtama) => {
  const [[config]] = await db.query(
    `SELECT ahost, adatabase, auser, apassword 
     FROM tsetingdb WHERE nama = 'default2'`
  );

  if (!config) throw new Error("Konfigurasi database kedua tidak ditemukan.");

  const mysql = require("mysql2/promise");
  const conn2 = await mysql.createConnection({
    host: config.ahost,
    user: config.auser,
    password: config.apassword,
    database: config.adatabase,
  });

  try {
    const [rows] = await conn2.query(
      `SELECT 
         d.sod_brg_satuan AS brgSatuan,
         d.sod_brg_kode AS brgKode,
         b.brg_nama AS brgNama,
         d.sod_qty AS qty,
         IFNULL(d.sod_discpr, 0) AS discPr,
         b.brg_hrgjual AS hargaJual,
         h.so_sls_kode AS slsKode,
         (SELECT sla_kode FROM \`${databaseUtama}\`.tsalesmanaktif 
          WHERE sla_sls_kode = h.so_sls_kode AND sla_isaktif = 1 
          LIMIT 1) AS slaKode
       FROM tso_dtl d
       INNER JOIN \`${databaseUtama}\`.tbarang b ON b.brg_kode = d.sod_brg_kode
       INNER JOIN tso_hdr h ON h.so_nomor = d.sod_so_nomor
       LEFT JOIN \`${databaseUtama}\`.tsalesman s ON s.sls_kode = h.so_sls_kode
       WHERE d.sod_so_nomor = ?
       ORDER BY d.sod_nourut ASC`,
      [nomor]
    );
    return rows;
  } finally {
    await conn2.end();
  }
};

// ── Tandai SO sumber (dari DB tampung) sudah dieksekusi ─────────────
// Migrasi Delphi: simpandata → update tampung.tso_hdr set so_statuseksekusi=1
// where so_nomor=<nomor SO sumber> (ufrmPesanan.pas). Database kedua (default2).
const tandaiEksekusi = async (nomorSosales) => {
  if (!nomorSosales) return;

  const mysql = require("mysql2/promise");
  let conn2;
  try {
    const [[config]] = await db.query(
      `SELECT ahost, adatabase, auser, apassword 
       FROM tsetingdb WHERE nama = 'default2'`
    );
    if (!config) return;

    conn2 = await mysql.createConnection({
      host: config.ahost,
      user: config.auser,
      password: config.apassword,
      database: config.adatabase,
    });
    await conn2.query(
      `UPDATE tso_hdr SET so_statuseksekusi = 1 WHERE so_nomor = ?`,
      [nomorSosales]
    );
  } catch (e) {
    // Gagal menandai tidak boleh menggagalkan simpan SO utama.
    console.warn("⚠️ Gagal tandai statuseksekusi SO sumber:", e.message);
  } finally {
    if (conn2) await conn2.end();
  }
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT so_nomor AS nomor, 
            DATE_FORMAT(so_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(so_memo, '') AS memo, 
            IFNULL(so_cus_kode, '') AS cusKode, 
            IFNULL(so_shipaddress, '') AS shipAddress, 
            IFNULL(so_sls_kode, '') AS slsKode, 
            IFNULL(so_sla_kode, '') AS slaKode,
            IFNULL(so_disc_faktur, 0) AS discFaktur, 
            IFNULL(so_disc_fakturpr, 0) AS discFakturPr, 
            IFNULL(so_amount, 0) AS amount, 
            IFNULL(so_taxamount, 0) AS taxAmount,
            IFNULL(so_dp, 0) AS dp, 
            IFNULL(so_rek_dp, '') AS rekDp, 
            IFNULL(so_istax, 0) AS isTax, 
            IFNULL(so_isecer, 0) AS isEcer, 
            IFNULL(so_isproforma, 0) AS isProforma
     FROM tso_hdr WHERE so_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("SO tidak ditemukan.");

  // Ambil nama customer
  const [[customer]] = await db.query(
    `SELECT cus_nama AS cusNama, cus_alamat AS alamat 
     FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  // Ambil nama salesman aktif
  const [[salesmanAktif]] = await db.query(
    `SELECT sla_nama AS slaNama FROM tsalesmanaktif WHERE sla_kode = ? LIMIT 1`,
    [h.slaKode]
  );

  // Ambil nama salesman (rayon)
  const [[salesman]] = await db.query(
    `SELECT sls_nama AS slsNama FROM tsalesman WHERE sls_kode = ? LIMIT 1`,
    [h.slsKode]
  );

  // Ambil nama rekening
  const [[rekening]] = await db.query(
    `SELECT rek_nama AS rekNama FROM trekening WHERE rek_kode = ? LIMIT 1`,
    [h.rekDp]
  );

  const [detail] = await db.query(
    `SELECT d.sod_brg_kode AS brgKode, b.brg_nama AS brgNama,
            d.sod_brg_satuan AS satuan, d.sod_qty AS qty,
            d.sod_harga AS harga, d.sod_discpr AS discPr,
            d.sod_keterangan AS keterangan,
            ROUND(d.sod_harga * d.sod_qty * (100 - IFNULL(d.sod_discpr,0)) / 100, 2) AS total
     FROM tso_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.sod_brg_kode
     WHERE d.sod_so_nomor = ?
     ORDER BY d.sod_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    cusNama: customer?.cusNama || "",
    alamat: customer?.alamat || "",
    slaNama: salesmanAktif?.slaNama || "",
    slsNama: salesman?.slsNama || "",
    rekNama: rekening?.rekNama || "",
    detail,
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, memo, cusKode, shipAddress,
    slsKode, slaKode, discFaktur, discFakturPr, amount, taxAmount,
    dp, rekDp, isTax, isEcer, isProforma, detail,
  } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      // Delphi ufrmBrowsePesanan.cekkirim: SO yang sudah ada pengiriman tidak boleh diedit
      const [[so]] = await conn.query(
        `SELECT so_iskirim FROM tso_hdr WHERE so_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!so) throw new Error("SO tidak ditemukan.");
      if (Number(so.so_iskirim) === 1)
        throw new Error("Transaksi ini sudah ada Pengiriman, tidak dapat diedit.");

      await conn.query(
        `UPDATE tso_hdr SET
           so_tanggal = ?, so_memo = ?, so_cus_kode = ?, so_shipaddress = ?,
           so_sls_kode = ?, so_sla_kode = ?, so_disc_faktur = ?,
           so_disc_fakturpr = ?, so_amount = ?, so_taxamount = ?,
           so_dp = ?, so_rek_dp = ?, so_istax = ?, so_isecer = ?,
           so_isproforma = ?, date_modified = NOW(), user_modified = ?
         WHERE so_nomor = ?`,
        [
          tanggal, memo, cusKode, shipAddress, slsKode, slaKode,
          discFaktur, discFakturPr, amount, taxAmount, dp, rekDp,
          isTax, isEcer, isProforma, user.kode, nomor,
        ]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tso_hdr
           (so_nomor, so_tanggal, so_memo, so_cus_kode, so_shipaddress,
            so_sls_kode, so_sla_kode, so_disc_faktur, so_disc_fakturpr,
            so_amount, so_taxamount, so_dp, so_rek_dp, so_istax,
            so_isecer, so_isproforma, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, tanggal, memo, cusKode, shipAddress, slsKode,
          slaKode, discFaktur, discFakturPr, amount, taxAmount, dp,
          rekDp, isTax, isEcer, isProforma, user.kode,
        ]
      );
    }

    await conn.query(`DELETE FROM tso_dtl WHERE sod_so_nomor = ?`, [actualNomor]);

    let nourut = 1;
    for (const d of detail) {
      await conn.query(
        `INSERT INTO tso_dtl
           (sod_so_nomor, sod_brg_kode, sod_brg_satuan, sod_qty,
            sod_discpr, sod_harga, sod_keterangan, sod_nourut)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, d.brgKode, d.satuan, d.qty, d.discPr,
          d.harga, d.keterangan || "", nourut,
        ]
      );
      nourut++;
    }

    await conn.commit();

    // Setelah transaksi sukses, tandai SO sumber (dari DB tampung) sdh dieksekusi
    await tandaiEksekusi(payload.nomorSosales);

    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Riwayat Harga (sama dengan Delphi) ───────────────────────────────
const getRiwayatHarga = async (brgKode, cusKode, excludeNomor = "") => {
  const [rows] = await db.query(
    `SELECT brg_nama AS Nama, fpd_harga AS Harga, fpd_discpr AS Disc,
            DATE_FORMAT(fpd_expired, '%Y-%m-%d') AS Expired, DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS Tanggal, fpd_qty AS Qty
     FROM tfp_dtl
     INNER JOIN tbarang ON brg_kode = fpd_brg_kode
     INNER JOIN tfp_hdr ON fpd_fp_nomor = fp_nomor
     WHERE fp_nomor <> ?
       AND brg_kode = ?
       AND fp_cus_kode = ?
     ORDER BY fp_tanggal DESC
     LIMIT 50`,
    [excludeNomor, brgKode, cusKode]
  );
  return rows;
};

module.exports = {
  getCustomer,
  getSalesmanAktif,
  getSalesman,
  getRekening,
  getBarang,
  getMaxNomor,
  checkCustomerLocked,
  getDiscSales,
  getLastCost,
  getAmbilSO,
  getDetailAmbilSO,
  getDetailForm,
  saveData,
  getRiwayatHarga,
};