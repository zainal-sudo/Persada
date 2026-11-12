// services/ai/auditLog.js
// Jejak percakapan AI di database cabang (tai_chat) + umpan balik 👍/👎.
// Tabel dibuat otomatis saat pertama dipakai. Fail-safe: kegagalan logging
// TIDAK PERNAH mematahkan chat.
const db = require("../../config/database");

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await db.query(
    "CREATE TABLE IF NOT EXISTS tai_chat (" +
      "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
      "user_kode VARCHAR(20), cabang VARCHAR(10)," +
      "role VARCHAR(10), content MEDIUMTEXT," +
      "sources VARCHAR(255), tools VARCHAR(255)," +
      "number_check VARCHAR(10), thumb TINYINT DEFAULT NULL," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );
  ensured = true;
}

// Catat satu pergantian (pertanyaan user + jawaban asisten).
// Return id baris jawaban (untuk tombol 👍/👎), atau null bila gagal.
async function logExchange(user, question, answer, meta = {}) {
  try {
    await ensureTable();
    const kode = String(user?.kode || "-").slice(0, 20);
    const cabang = String(user?.cabang || "-").slice(0, 10);
    const sources = (meta.sources || []).join(",").slice(0, 255);
    const tools = (meta.tools || []).join(",").slice(0, 255);
    const ncheck = String(meta.numberCheck || "").slice(0, 10);

    await db.query(
      "INSERT INTO tai_chat (user_kode, cabang, role, content) VALUES (?, ?, 'user', ?)",
      [kode, cabang, String(question || "").slice(0, 12000)],
    );
    const [res] = await db.query(
      "INSERT INTO tai_chat (user_kode, cabang, role, content, sources, tools, number_check)" +
        " VALUES (?, ?, 'assistant', ?, ?, ?, ?)",
      [kode, cabang, String(answer || "").slice(0, 60000), sources, tools, ncheck],
    );
    return res?.insertId || null;
  } catch (e) {
    console.warn("[AI] audit log gagal (dibiarkan lewat):", e.message);
    return null;
  }
}

// Set 👍 (1) / 👎 (-1) pada baris jawaban. Return true bila berhasil.
async function setThumb(chatLogId, thumb, user) {
  try {
    await ensureTable();
    if (![1, -1].includes(Number(thumb))) return false;
    const [res] = await db.query(
      "UPDATE tai_chat SET thumb = ? WHERE id = ? AND role = 'assistant' AND user_kode = ?",
      [Number(thumb), Number(chatLogId), String(user?.kode || "-").slice(0, 20)],
    );
    return (res?.affectedRows || 0) > 0;
  } catch (e) {
    console.warn("[AI] feedback gagal:", e.message);
    return false;
  }
}

module.exports = { logExchange, setThumb };
