// middleware/resolveMenuId.js
const db = require("../config/database");

/**
 * Middleware untuk resolve menuId otomatis dari route path.
 * 
 * Cara kerja:
 * 1. Ambil baseUrl dari request (contoh: "/api/transaksi/po")
 * 2. Buang prefix "/api" (menjadi: "/transaksi/po")
 * 3. Cari di tabel tmenu berdasarkan men_route
 * 4. Simpan MEN_ID ke req.menuId
 * 
 * Kalau route tidak terdaftar di tmenu (misal: /auth/login, /dashboard),
 * maka req.menuId = null → checkPermission akan skip.
 */
const resolveMenuId = async (req, res, next) => {
  try {
    // Ambil path dari URL
    // Contoh: req.baseUrl = "/api/transaksi/po" atau "/api/master/account"
    const apiPath = req.baseUrl || req.originalUrl.split("?")[0];
    
    // Buang prefix "/api"
    let routePath = apiPath.replace(/^\/api/, "");
    
    // Buang trailing slash
    routePath = routePath.replace(/\/$/, "");
    
    // Kalau path kosong (misal: /api), skip
    if (!routePath) {
      req.menuId = null;
      return next();
    }

    // Cari di database: tmenu WHERE men_route = routePath
    const [rows] = await db.query(
      `SELECT MEN_ID FROM tmenu WHERE men_route = ? LIMIT 1`,
      [routePath]
    );

    if (rows.length === 0) {
      // Route tidak terdaftar di menu → tidak perlu permission
      req.menuId = null;
    } else {
      req.menuId = rows[0].MEN_ID;
    }

    next();
  } catch (error) {
    // Kalau gagal resolve, set null agar tidak block akses
    console.error("⚠️ Gagal resolve menuId:", error.message);
    req.menuId = null;
    next();
  }
};

module.exports = { resolveMenuId };