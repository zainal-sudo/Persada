const db = require("../../config/database");

// ── Generate Kode Otomatis ───────────────────────────────────────────
// Delphi: select max(SUBSTR(sls_kode,5,3)) from tsalesman
// Format: SLS-001, SLS-002, dst
const getMaxKode = async () => {
  const [[row]] = await db.query(
    `SELECT MAX(CAST(SUBSTR(sls_kode, 5, 3) AS UNSIGNED)) AS max_val
     FROM tsalesman`
  );
  if (!row || !row.max_val) {
    return "SLS-001";
  }
  const nextNum = Number(row.max_val) + 1;
  return `SLS-${String(nextNum).padStart(3, "0")}`;
};

// ── Get Target Bulanan ───────────────────────────────────────────────
// Delphi loadtogrid:
// SELECT ID, NAMA, IFNULL(St_TARGETSALES,0) TARGET
// FROM tbulan LEFT JOIN tsalesmantarget
//   ON id = st_periode AND st_tahun = ? AND st_sls_kode = ?
const getTargetBulanan = async (kode, tahun) => {
  const [rows] = await db.query(
    `SELECT
       b.id AS periode,
       b.nama AS nama,
       IFNULL(t.st_targetsales, 0) AS target
     FROM tbulan b
     LEFT JOIN tsalesmantarget t
       ON t.st_periode = b.id
      AND t.st_tahun = ?
      AND t.st_sls_kode = ?
     ORDER BY b.id`,
    [tahun, kode]
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       sls_kode AS kode,
       sls_nama AS nama,
       IFNULL(sls_alamat, '') AS alamat,
       IFNULL(sls_kota, '') AS kota,
       IFNULL(sls_telp, '') AS telp,
       DATE_FORMAT(sls_tglmasuk, '%Y-%m-%d') AS tglMasuk,
       sls_cabang AS cabang
     FROM tsalesman
     WHERE sls_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Salesman tidak ditemukan.");

  return row;
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
    tglMasuk,
    cabang,
    tahun,
    target,
  } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualKode = kode;

    if (isEdit) {
      await conn.query(
        `UPDATE tsalesman SET
           sls_nama = ?, sls_alamat = ?, sls_kota = ?,
           sls_telp = ?, sls_tglmasuk = ?, sls_cabang = ?,
           date_modified = NOW(), user_modified = ?
         WHERE sls_kode = ?`,
        [nama, alamat, kota, telp, tglMasuk, cabang, user.kode, actualKode]
      );
    } else {
      actualKode = await getMaxKode();
      await conn.query(
        `INSERT INTO tsalesman
           (sls_kode, sls_nama, sls_alamat, sls_kota, sls_telp,
            sls_tglmasuk, sls_cabang, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [actualKode, nama, alamat, kota, telp, tglMasuk, cabang, user.kode]
      );
    }

    // Simpan target bulanan
    await conn.query(
      `DELETE FROM tsalesmantarget
       WHERE st_sls_kode = ? AND st_tahun = ?`,
      [actualKode, tahun]
    );

    for (const t of target) {
      if (Number(t.target) !== 0) {
        await conn.query(
          `INSERT INTO tsalesmantarget
             (st_sls_kode, st_periode, st_tahun, st_targetsales)
           VALUES (?, ?, ?, ?)`,
          [actualKode, t.periode, tahun, Number(t.target)]
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
  getTargetBulanan,
  getDetailForm,
  saveData,
};