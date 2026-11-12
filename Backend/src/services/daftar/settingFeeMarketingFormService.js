const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(fmh_nomor AS DECIMAL)), 0) AS max_val
     FROM tfeemarketing_hdr`
  );
  const nextNum = 1000 + Number(row.max_val) + 1;
  return String(nextNum).slice(-3);
};

// ── Lookup Customer ──────────────────────────────────────────────────
const getCustomer = async (search = "") => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS customer,
            IFNULL(cus_alamat, '') AS alamat, IFNULL(cus_telp, '') AS telp
     FROM tcustomer
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     ORDER BY cus_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Barang ────────────────────────────────────────────────────
const getBarang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT brg_kode AS kode, brg_nama AS nama, brg_satuan AS satuan
     FROM tbarang
     WHERE brg_nama LIKE ? OR brg_kode LIKE ?
     ORDER BY brg_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── All Item (dari FP customer) ──────────────────────────────────────
const getAllItem = async (cusKode) => {
  const [rows] = await db.query(
    `SELECT DISTINCT b.brg_kode AS kode, b.brg_nama AS nama, b.brg_satuan AS satuan
     FROM tbarang b
     INNER JOIN tfp_dtl d ON d.fpd_brg_kode = b.brg_kode
     INNER JOIN tfp_hdr h ON h.fp_nomor = d.fpd_fp_nomor
     WHERE b.brg_satuan NOT IN ('UNT', 'UNIT', 'UNI', 'SET')
       AND h.fp_cus_kode = ?
     ORDER BY b.brg_nama`,
    [cusKode]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT h.fmh_nomor AS nomor, h.fmh_cus_kode AS cusKode,
            c.cus_nama AS cusNama, IFNULL(c.cus_alamat, '') AS alamat
     FROM tfeemarketing_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.fmh_cus_kode
     WHERE h.fmh_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Setting fee marketing tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT d.fmd_brg_kode AS kode, b.brg_nama AS nama,
            IFNULL(d.fmd_persen, 0) AS persen,
            IFNULL(d.fmd_rupiah, 0) AS rupiah
     FROM tfeemarketing_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.fmd_brg_kode
     WHERE d.fmd_fmh_nomor = ?
     ORDER BY d.fmd_brg_kode`,
    [nomor]
  );

  return {
    ...header,
    detail: detail.map((d, i) => ({
      no: i + 1,
      kode: d.kode,
      nama: d.nama,
      persen: Number(d.persen),
      rupiah: Number(d.rupiah),
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload) => {
  const { isEdit, nomor, cusKode, detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tfeemarketing_hdr SET fmh_cus_kode = ?
         WHERE fmh_nomor = ?`,
        [cusKode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor();
      await conn.query(
        `INSERT INTO tfeemarketing_hdr (fmh_nomor, fmh_cus_kode)
         VALUES (?, ?)`,
        [actualNomor, cusKode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tfeemarketing_dtl WHERE fmd_fmh_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru
    for (const d of detail) {
      if (d.kode) {
        await conn.query(
          `INSERT INTO tfeemarketing_dtl
             (fmd_fmh_nomor, fmd_brg_kode, fmd_persen, fmd_rupiah)
           VALUES (?, ?, ?, ?)`,
          [actualNomor, d.kode, Number(d.persen) || 0, Number(d.rupiah) || 0]
        );
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
  getCustomer,
  getBarang,
  getAllItem,
  getDetailForm,
  saveData,
};