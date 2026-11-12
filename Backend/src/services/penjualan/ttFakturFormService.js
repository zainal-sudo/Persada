// services/penjualan/ttFakturFormService.js
const db = require("../../config/database");

// ── Get Database2 ────────────────────────────────────────────────────
const getDatabase2 = async () => {
  const [[config]] = await db.query(
    `SELECT ahost, adatabase, auser, apassword 
     FROM tsetingdb WHERE nama = 'default2'`
  );
  return config;
};

// ── Get Salesman ─────────────────────────────────────────────────────
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode,
            (SELECT sla_nama FROM tsalesmanaktif 
             WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 LIMIT 1) AS nama
     FROM tsalesman
     HAVING nama IS NOT NULL
     ORDER BY nama`
  );
  return rows;
};

// ── Get Customer ─────────────────────────────────────────────────────
const getCustomer = async (search = "") => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama, cus_alamat AS alamat,
           gc_nama AS golongan, cus_piutang AS piutang
     FROM tcustomer
     INNER JOIN tgolongancustomer ON cus_gc_kode = gc_kode
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     ORDER BY cus_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get Invoice ──────────────────────────────────────────────────────
const getInvoice = async (cusKode) => {
  const [rows] = await db.query(
    `SELECT 
       fp_nomor AS nomorFaktur,
       DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
       (fp_amount - fp_dp - fp_bayar - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor), 0)) AS nilai
     FROM tfp_hdr
     WHERE fp_cus_kode = ?
     HAVING nilai > 1000
     ORDER BY fp_nomor`,
    [cusKode]
  );

  return rows.map((r) => ({
    nomorFaktur: r.nomorFaktur,
    tanggal: r.tanggal,
    nilai: Number(r.nilai || 0),
    check: false,
    nilai2: 0,
  }));
};

// ── Get Nomor ────────────────────────────────────────────────────────
const getMaxNomor = async (slsKode) => {
  const config = await getDatabase2();
  if (!config) throw new Error("Konfigurasi database kedua tidak ditemukan.");

  const mysql = require("mysql2/promise");
  const conn2 = await mysql.createConnection({
    host: config.ahost,
    user: config.auser,
    password: config.apassword,
    database: config.adatabase,
  });

  try {
    const now = new Date();
    const periode = `${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;

    const [[row]] = await conn2.query(
      `SELECT MAX(SUBSTR(tt_nomor, LENGTH(tt_nomor) - 2, LENGTH(tt_nomor))) AS max_num
       FROM ttt_hdr 
       WHERE CONCAT(MONTH(tt_tanggal), YEAR(tt_tanggal)) = ?
         AND tt_sls_kode = ?`,
      [periode, slsKode]
    );

    let urutan = "001";
    if (row?.max_num) {
      urutan = String(Number(row.max_num) + 1).padStart(3, "0");
    }

    return `TT${slsKode}.${periode}-${urutan}`;
  } finally {
    await conn2.end();
  }
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const config = await getDatabase2();
  if (!config) throw new Error("Konfigurasi database kedua tidak ditemukan.");

  const mysql = require("mysql2/promise");
  const conn2 = await mysql.createConnection({
    host: config.ahost,
    user: config.auser,
    password: config.apassword,
    database: config.adatabase,
  });

  try {
    const [[h]] = await conn2.query(
      `SELECT tt_nomor, DATE_FORMAT(tt_tanggal, '%Y-%m-%d') AS tanggal,
              tt_sls_kode, tt_cus_kode
       FROM ttt_hdr WHERE tt_nomor = ?`,
      [nomor]
    );

    if (!h) throw new Error("Data tidak ditemukan.");

    // Ambil nama salesman & customer
    const [[salesman]] = await db.query(
      `SELECT sls_nama FROM tsalesman WHERE sls_kode = ? LIMIT 1`,
      [h.tt_sls_kode]
    );

    const [[customer]] = await db.query(
      `SELECT cus_nama FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
      [h.tt_cus_kode]
    );

    // Ambil detail TT (ttt_dtl via conn2, tfp_hdr via db cabang)
    const [tttDtl] = await conn2.query(
      `SELECT ttd_fp_nomor AS nomorFaktur
       FROM ttt_dtl WHERE ttd_tt_nomor = ?
       ORDER BY ttd_nourut ASC`,
      [nomor]
    );

    // Ambil data faktur dari tfp_hdr (database cabang via db)
    const details = [];
    for (const d of tttDtl) {
      const [[fp]] = await db.query(
        `SELECT fp_nomor, DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal, fp_amount
         FROM tfp_hdr WHERE fp_nomor = ? LIMIT 1`,
        [d.nomorFaktur]
      );
      if (fp) {
        details.push({
          nomorFaktur: fp.fp_nomor,
          tanggal: fp.tanggal,
          nilai: Number(fp.fp_amount || 0),
        });
      }
    }

    // Ambil semua invoice customer
    const allInvoices = await getInvoice(h.tt_cus_kode);

    // Gabungkan — yang di TT sudah check
    const checkedSet = new Set(details.map((d) => d.nomorFaktur));

    for (const inv of allInvoices) {
      if (checkedSet.has(inv.nomorFaktur)) {
        inv.check = true;
        inv.nilai2 = inv.nilai;
      }
    }

    return {
      isEdit: true,
      nomor: h.tt_nomor,
      tanggal: h.tanggal,
      slsKode: h.tt_sls_kode,
      slsNama: salesman?.sls_nama || "",
      cusKode: h.tt_cus_kode,
      cusNama: customer?.cus_nama || "",
      detail: allInvoices,
    };
  } finally {
    await conn2.end();
  }
};

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { nomor, tanggal, slsKode, cusKode, detail } = payload;

  const config = await getDatabase2();
  if (!config) throw new Error("Konfigurasi database kedua tidak ditemukan.");

  const mysql = require("mysql2/promise");
  const conn2 = await mysql.createConnection({
    host: config.ahost,
    user: config.auser,
    password: config.apassword,
    database: config.adatabase,
  });

  try {
    await conn2.beginTransaction();

    // GAP-TTF-2: saat edit → hapus data exist dulu (paritas pola modul lain)
    if (payload.isEdit) {
      await conn2.query(`DELETE FROM ttt_dtl WHERE ttd_tt_nomor = ?`, [nomor]);
      await conn2.query(`DELETE FROM ttt_hdr WHERE tt_nomor = ?`, [nomor]);
    }

    // Insert header
    await conn2.query(
      `INSERT INTO ttt_hdr (tt_nomor, tt_cus_kode, tt_sls_kode, tt_tanggal)
       VALUES (?, ?, ?, ?)`,
      [nomor, cusKode, slsKode, tanggal]
    );

    // Insert detail
    for (const d of detail) {
      if (d.check === true) {
        await conn2.query(
          `INSERT IGNORE INTO ttt_dtl (ttd_tt_nomor, ttd_fp_nomor)
           VALUES (?, ?)`,
          [nomor, d.nomorFaktur]
        );
      }
    }

    await conn2.commit();
    return { nomor };
  } catch (e) {
    await conn2.rollback();
    throw e;
  } finally {
    await conn2.end();
  }
};

module.exports = {
  getSalesman,
  getCustomer,
  getInvoice,
  getMaxNomor,
  getDetailForm,
  saveData,
};