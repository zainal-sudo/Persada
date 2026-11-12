const db = require("../../config/database");

// ── Generate Kode Otomatis ───────────────────────────────────────────
const getMaxKode = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(brg_kode), 10000) AS max_val FROM tbarang`
  );
  return Number(row.max_val) + 1;
};

// ── Lookup Tipe Barang (tgroup) ─────────────────────────────────────
const getTipeBarang = async () => {
  const [rows] = await db.query(
    `SELECT gr_kode AS kode, gr_nama AS nama FROM tgroup ORDER BY gr_nama`
  );
  return rows;
};

// ── Lookup Kategori (tkategori) ─────────────────────────────────────
const getKategori = async () => {
  const [rows] = await db.query(
    `SELECT ktg_kode AS kode, ktg_nama AS nama FROM tkategori ORDER BY ktg_nama`
  );
  return rows;
};

// ── Lookup Gudang (tgudang) ─────────────────────────────────────────
const getGudang = async () => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama FROM tgudang ORDER BY gdg_nama`
  );
  return rows;
};

// ── Lookup Supplier (tsupplier) ─────────────────────────────────────
const getSupplier = async () => {
  const [rows] = await db.query(
    `SELECT sup_kode AS kode, sup_nama AS nama FROM tsupplier ORDER BY sup_nama`
  );
  return rows;
};

// ── Get Harga Jual per Jenis Customer ───────────────────────────────
const getHargaJualJenis = async (brgKode = "") => {
  const [rows] = await db.query(
    `SELECT jc.jc_kode AS kode, jc.jc_nama AS nama,
            IFNULL(h.hjj_hargajual, 0) AS hargajual
     FROM tjeniscustomer jc
     LEFT JOIN thargajualjenis h
       ON h.hjj_jc_kode = jc.jc_kode
      AND h.hjj_brg_kode = ?
     ORDER BY jc.jc_kode`,
    [brgKode || 0]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       brg_kode AS kode, brg_nama AS nama, brg_satuan AS satuan,
       brg_ktg_kode AS ktgKode, brg_gr_kode AS grKode,
       brg_gdg_default AS gdgDefault, brg_sup_kode AS supKode,
       brg_isaktif AS isAktif, brg_isstok AS isStok,
       brg_isexpired AS isExpired, brg_isproductfocus AS isProductFocus,
       brg_hrgbeli AS hargaBeli, brg_hrgjual AS hargaJual,
       brg_min_stok AS minStok, brg_max_stok AS maxStok,
       brg_merk AS merk, brg_disc_sales AS discSales,
       brg_harga_min AS het
     FROM tbarang
     WHERE brg_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Barang tidak ditemukan.");

  const detail = await getHargaJualJenis(kode);

  return { ...row, detail };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, kode, nama, satuan, ktgKode, grKode, gdgDefault, supKode,
    isAktif, isStok, isExpired, isProductFocus,
    hargaBeli, hargaJual, minStok, maxStok, merk, discSales, het,
    detail,
  } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualKode = kode;

    if (isEdit) {
      await conn.query(
        `UPDATE tbarang SET
           brg_nama = ?, brg_satuan = ?, brg_ktg_kode = ?, brg_gr_kode = ?,
           brg_gdg_default = ?, brg_sup_kode = ?, brg_hrgjual = ?,
           brg_hrgbeli = ?, brg_isaktif = ?, brg_isstok = ?,
           brg_isexpired = ?, brg_min_stok = ?, brg_max_stok = ?,
           brg_isproductfocus = ?, brg_disc_sales = ?, brg_harga_min = ?,
           brg_merk = ?, date_modified = NOW(), user_modified = ?
         WHERE brg_kode = ?`,
        [
          nama, satuan, ktgKode, grKode, gdgDefault, supKode,
          hargaJual, hargaBeli, isAktif ? 1 : 0, isStok ? 1 : 0,
          isExpired ? 1 : 0, minStok, maxStok,
          isProductFocus ? 1 : 0, discSales, het, merk,
          user.kode, actualKode,
        ]
      );
    } else {
      actualKode = String(await getMaxKode());
      await conn.query(
        `INSERT INTO tbarang
           (brg_kode, brg_nama, brg_satuan, brg_merk, brg_gr_kode,
            brg_ktg_kode, brg_gdg_default, brg_sup_kode,
            brg_hrgjual, brg_hrgbeli, brg_isaktif, brg_isstok,
            brg_isexpired, brg_isproductfocus, brg_disc_sales,
            brg_min_stok, brg_max_stok, brg_harga_min,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualKode, nama, satuan, merk, grKode, ktgKode, gdgDefault,
          supKode, hargaJual, hargaBeli, isAktif ? 1 : 0, isStok ? 1 : 0,
          isExpired ? 1 : 0, isProductFocus ? 1 : 0, discSales,
          minStok, maxStok, het, user.kode,
        ]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM thargajualjenis WHERE hjj_brg_kode = ?`,
      [actualKode]
    );

    // Insert detail baru
    for (const d of detail) {
      if (Number(d.hargajual) > 0) {
        await conn.query(
          `INSERT INTO thargajualjenis (hjj_brg_kode, hjj_jc_kode, hjj_hargajual)
           VALUES (?, ?, ?)`,
          [actualKode, d.kode, Number(d.hargajual)]
        );
      }
    }

    await conn.commit();
    return { kode: actualKode };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMaxKode,
  getTipeBarang,
  getKategori,
  getGudang,
  getSupplier,
  getHargaJualJenis,
  getDetailForm,
  saveData,
};