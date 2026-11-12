// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../config/database");

/**
 * verifyToken
 * Memvalidasi JWT dari header Authorization: Bearer <token>
 * Menyimpan payload ke req.user
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Token tidak ditemukan." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { kode, nama, cabang, level, database, ... }
    // Semua query di route ini berjalan terhadap database cabang user
    return db.run(decoded.database, () => next());
  } catch (err) {
    return res
      .status(403)
      .json({
        success: false,
        message: "Token tidak valid atau sudah expired.",
      });
  }
};

/**
 * checkPermission(action)
 * 
 * BARU: Tidak perlu parameter menuId lagi!
 * menuId diambil dari req.menuId (sudah di-resolve oleh resolveMenuId middleware)
 * 
 * action: 'view' | 'insert' | 'edit' | 'delete' | 'print' | 'save'
 * 'save' = dinamis: insert utk dokumen baru, edit utk ubah dokumen lama
 *          (paritas Delphi: cekinsert vs cekedit).
 */
const checkPermission = (action = "view") => {
  return async (req, res, next) => {
    try {
      if (action === "save") action = req.body?.isEdit ? "edit" : "insert";
      const menuId = req.menuId;

      // Kalau route tidak terdaftar di tmenu → skip permission
      if (!menuId) return next();

      // Admin bypass semua permission
      if (req.user?.kode?.toUpperCase() === "ADMIN") return next();

      // Untuk action view/print, cukup cek user punya baris hak di thakuser
      const colMap = {
        insert: "hak_men_insert",
        edit: "hak_men_edit",
        delete: "hak_men_delete",
      };

      // Query hak akses user
      const [rows] = await db.query(
        `SELECT hak_men_insert, hak_men_edit, hak_men_delete
         FROM thakuser
         WHERE HAK_USER_KODE = ? AND HAK_MEN_ID = ? LIMIT 1`,
        [req.user.kode, menuId]
      );

      if (rows.length === 0) {
        return res
          .status(403)
          .json({ success: false, message: "Akses ditolak." });
      }

      // Cek action selain view/print
      if (action !== "view" && action !== "print") {
        const col = colMap[action];
        if (!col) {
          return res
            .status(400)
            .json({ success: false, message: "Action tidak valid." });
        }
        if (rows[0][col] !== "Y") {
          return res
            .status(403)
            .json({ success: false, message: "Akses ditolak." });
        }
      }

      next();
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Gagal memeriksa hak akses." });
    }
  };
};

module.exports = { verifyToken, checkPermission };