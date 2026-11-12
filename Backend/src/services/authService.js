const db = require("../config/database");
const jwt = require("jsonwebtoken");

/**
 * Single-database mode: aplikasi hanya melayani database `krm`.
 * Tidak ada pembacaan lintas cabang / tcabang.
 */
const DB_NAME = () => process.env.DB_NAME || "krm";

// Kode cabang aktif diambil dari tcabang (bukan nama database),
// dipakai sebagai prefix nomor otomatis transaksi (mis. 99-KOR.2610.xxxx).
const getCbgKode = async () => {
  const [[row]] = await db.query(
    `SELECT cbg_kode FROM tcabang WHERE cbg_aktif = 1 LIMIT 1`
  );
  return row ? row.cbg_kode : DB_NAME();
};

const listCabang = async () => {
  const cbgKode = await getCbgKode();
  return [{ kode: cbgKode, cbg_nama: "Kali Rejo Makmur", dbase: DB_NAME() }];
};

const getCabang = async () => {
  const cabangs = await listCabang();
  return {
    cabangs,
    defaultDbase: DB_NAME(),
    isLocked: true,
  };
};

const assertCabangInScope = async () => {
  // mTLS lintas cabang tidak dipakai pada mode single-database.
};

/**
 * Login user
 * Semua query berjalan terhadap database tunggal (krm).
 */
const login = async (username, password) => {
  const [rows] = await db.query(
    `SELECT USER_KODE, USER_NAMA, USER_PASSWORD
     FROM tuser
     WHERE UPPER(USER_KODE) = UPPER(?) LIMIT 1`,
    [username]
  );

  if (rows.length === 0) throw new Error("Username atau password salah.");

  const user = rows[0];

  if (password !== user.USER_PASSWORD)
    throw new Error("Username atau password salah.");

  const cbgKode = await getCbgKode();

  const payload = {
    kode: user.USER_KODE,
    nama: user.USER_NAMA,
    level: "USER",
    cabang: cbgKode,
    cabangNama: "Kali Rejo Makmur",
    database: DB_NAME(),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  let menus = [];
  try {
    const [menuRows] = await db.query(
      `SELECT HAK_MEN_ID AS menu_id,
              'Y' AS hak_view,
              IFNULL(hak_men_insert, 'N') AS hak_insert,
              IFNULL(hak_men_edit,   'N') AS hak_edit,
              IFNULL(hak_men_delete, 'N') AS hak_delete,
              'N' AS hak_print
       FROM thakuser
       WHERE HAK_USER_KODE = ?`,
      [user.USER_KODE],
    );
    menus = menuRows;
  } catch {
    menus = [];
  }

  return { token, user: { ...payload, menus } };
};

const changePassword = async (userKode, oldPassword, newPassword) => {
  const [[user]] = await db.query(
    `SELECT user_kode, user_password
     FROM tuser
     WHERE UPPER(user_kode) = UPPER(?)`,
    [userKode],
  );

  if (!user) throw new Error("User tidak ditemukan.");
  if (user.user_password !== oldPassword)
    throw new Error("Password lama salah.");

  await db.query(
    `UPDATE tuser SET user_password = ?, date_modify = NOW()
     WHERE user_kode = ?`,
    [newPassword, user.user_kode],
  );

  return { success: true };
};

/**
 * Daftar user aktif dari tabel tuser — untuk lookup di halaman login.
 */
const getUsers = async () => {
  const [rows] = await db.query(
    `SELECT USER_KODE AS kode, USER_NAMA AS nama
     FROM tuser
     ORDER BY USER_KODE`
  );
  return rows;
};

module.exports = {
  login,
  changePassword,
  getCabang,
  getUsers,
  listCabang,
  assertCabangInScope,
};
