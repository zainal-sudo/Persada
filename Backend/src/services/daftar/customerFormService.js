const db = require("../../config/database");

// ── Lookup Jenis Customer ────────────────────────────────────────────
const getJenisCustomer = async () => {
  const [rows] = await db.query(
    `SELECT jc_kode AS kode, jc_nama AS nama
     FROM tjeniscustomer
     ORDER BY jc_nama`
  );
  return rows;
};

// ── Lookup Golongan Customer ─────────────────────────────────────────
const getGolonganCustomer = async () => {
  const [rows] = await db.query(
    `SELECT gc_kode AS kode, gc_nama AS nama
     FROM tgolongancustomer
     ORDER BY gc_nama`
  );
  return rows;
};

// ── Lookup Marketing (Salesman Aktif) ────────────────────────────────
// Delphi edtMarketingClickBtn:
// SELECT Kode, Nama, Alamat FROM (
//   SELECT sls_kode Kode,
//     (SELECT sla_nama FROM tsalesmanaktif
//      WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 LIMIT 1) Nama,
//     sls_alamat Alamat
//   FROM tsalesman
// ) a WHERE Nama IS NOT NULL
const getMarketing = async (search = "") => {
  const [rows] = await db.query(
    `SELECT
       s.sls_kode AS kode,
       IFNULL(sa.sla_nama, '') AS nama,
       IFNULL(s.sls_alamat, '') AS alamat
     FROM tsalesman s
     INNER JOIN tsalesmanaktif sa
       ON sa.sla_sls_kode = s.sls_kode
      AND sa.sla_isaktif = 1
     WHERE s.sls_nama LIKE ? OR s.sls_kode LIKE ?
     ORDER BY sa.sla_nama
     LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       c.cus_kode AS kode,
       c.cus_nama AS nama,
       IFNULL(c.cus_alamat, '') AS alamat,
       IFNULL(c.cus_kota, '') AS kota,
       IFNULL(c.cus_telp, '') AS telp,
       IFNULL(c.cus_fax, '') AS fax,
       IFNULL(c.cus_email, '') AS email,
       IFNULL(c.cus_top, 0) AS top,
       IFNULL(c.cus_jc_kode, '') AS jcKode,
       IFNULL(j.jc_nama, '') AS jcNama,
       IFNULL(c.cus_CP, '') AS cp,
       IFNULL(c.cus_shipaddress, '') AS shipAddress,
       IFNULL(c.cus_gc_kode, '') AS gcKode,
       IFNULL(g.gc_nama, '') AS gcNama,
       IFNULL(c.cus_npwp, '') AS npwp,
       IFNULL(c.cus_namanpwp, '') AS namaNpwp,
       IFNULL(c.cus_alamatnpwp, '') AS alamatNpwp,
       IFNULL(c.cus_kotanpwp, '') AS kotaNpwp,
       c.cus_cabang AS cabang,
       IFNULL(
         (SELECT sc_sls_kode FROM tsalescustomer
          WHERE sc_cus_kode = c.cus_kode LIMIT 1), '') AS marketing
     FROM tcustomer c
     LEFT JOIN tjeniscustomer j ON j.jc_kode = c.cus_jc_kode
     LEFT JOIN tgolongancustomer g ON g.gc_kode = c.cus_gc_kode
     WHERE c.cus_kode = ?
     LIMIT 1`,
    [kode]
  );

  if (!row) throw new Error("Customer tidak ditemukan.");

  // Ambil nama marketing
  let namaMarketing = "";
  if (row.marketing) {
    const [[mkt]] = await db.query(
      `SELECT sls_nama AS nama FROM tsalesman WHERE sls_kode = ? LIMIT 1`,
      [row.marketing]
    );
    namaMarketing = mkt?.nama || "";
  }

  return { ...row, namaMarketing };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit,
    kode,
    nama,
    alamat,
    kota,
    telp,
    fax,
    email,
    top,
    jcKode,
    cp,
    shipAddress,
    gcKode,
    npwp,
    namaNpwp,
    alamatNpwp,
    kotaNpwp,
    marketing,
    cabang,
  } = payload;

  // ── Validasi ────────────────────────────────────────────────────────
  // Kode wajib = paritas Delphi (ufrmCustomer.pas: "Kode Customer Belum
  // diisi"). Golongan & Telp = aturan yang lebih ketat dari Delphi (legacy
  // tidak memvalidasi keduanya) — telp hanya untuk customer BARU karena
  // 73-98% record lama masih kosong (Solo 2.235, Jogja 884, Madiun 396).
  if (!kode || !String(kode).trim())
    throw new Error("Kode Customer belum diisi.");
  if (!nama || !String(nama).trim())
    throw new Error("Nama Customer belum diisi.");
  if (!gcKode)
    throw new Error("Golongan Customer belum dipilih.");
  if (!isEdit) {
    const t = String(telp || "").trim();
    if (!t) throw new Error("Nomor telp wajib diisi.");
    if (t.length < 6) throw new Error("Nomor telp minimal 6 karakter.");
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    if (isEdit) {
      await conn.query(
        `UPDATE tcustomer SET
           cus_nama = ?, cus_alamat = ?, cus_kota = ?, cus_telp = ?,
           cus_fax = ?, cus_email = ?, cus_top = ?, cus_jc_kode = ?,
           cus_CP = ?, cus_shipaddress = ?, cus_gc_kode = ?,
           cus_npwp = ?, cus_namanpwp = ?, cus_alamatnpwp = ?,
           cus_kotanpwp = ?, cus_cabang = ?,
           date_modified = NOW(), user_modified = ?
         WHERE cus_kode = ? AND cus_cabang = ?`,
        [
          nama, alamat, kota, telp, fax, email, top, jcKode,
          cp, shipAddress, gcKode, npwp, namaNpwp, alamatNpwp,
          kotaNpwp, cabang, user.kode, kode, cabang,
        ]
      );
    } else {
      await conn.query(
        `INSERT IGNORE INTO tcustomer
           (cus_kode, cus_nama, cus_kota, cus_alamat, cus_telp,
            cus_fax, cus_cp, cus_email, cus_jc_kode, cus_top,
            cus_shipaddress, cus_npwp, cus_namanpwp, cus_alamatnpwp,
            cus_kotanpwp, cus_gc_kode, cus_cabang, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          kode, nama, kota, alamat, telp, fax, cp, email, jcKode,
          top, shipAddress, npwp, namaNpwp, alamatNpwp, kotaNpwp,
          gcKode, cabang, user.kode,
        ]
      );
    }

    // Simpan marketing ke tsalescustomer
    if (marketing) {
      await conn.query(
        `INSERT IGNORE INTO tsalescustomer (sc_cus_kode, sc_sls_kode)
         VALUES (?, ?)`,
        [kode, marketing]
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

module.exports = {
  getJenisCustomer,
  getGolonganCustomer,
  getMarketing,
  getDetailForm,
  saveData,
};