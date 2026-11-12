const mysql = require("mysql2/promise");
const { AsyncLocalStorage } = require("async_hooks");
require("dotenv").config();

/**
 * Routing database multi-cabang.
 *
 * - systemPool  → database sistem (krm) dari env DB_NAME, hanya untuk baca tcabang.
 * - Pool cabang  → satu pool per nama database (dbase), dibuat lazy & di-cache.
 * - Konteks per-request disimpan via AsyncLocalStorage agar semua db.query() /
 *   db.getConnection() di service/controller otomatis memakai database cabang
 *   yang sedang aktif (diset di middleware verifyToken / saat login).
 */

const als = new AsyncLocalStorage();

const baseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+07:00",
};

// Pool sistem: database pusat (krm) — hanya untuk daftar cabang
const systemPool = mysql.createPool({
  ...baseConfig,
  database: process.env.DB_NAME,
});

// Cache pool per database cabang
const pools = new Map();

function getPool(database) {
  const dbName = database || process.env.DB_NAME;
  if (!pools.has(dbName)) {
    pools.set(dbName, mysql.createPool({ ...baseConfig, database: dbName }));
  }
  return pools.get(dbName);
}

function getCurrentDatabase() {
  const ctx = als.getStore();
  return (ctx && ctx.database) || process.env.DB_NAME;
}

async function query(sql, params) {
  return getPool(getCurrentDatabase()).query(sql, params);
}

async function getConnection() {
  return getPool(getCurrentDatabase()).getConnection();
}

/**
 * Menjalankan fn dengan konteks database tertentu.
 * Semua query async di dalam fn memakai database ini.
 */
function run(database, fn) {
  return als.run({ database }, fn);
}

// Test koneksi sistem saat startup
systemPool
  .getConnection()
  .then((conn) => {
    console.log("✅ Database connected:", process.env.DB_NAME);
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
  });

module.exports = {
  systemPool,
  baseConfig,
  getPool,
  getCurrentDatabase,
  run,
  query,
  getConnection,
};
