// Sumber tunggal versi aplikasi + catatan rilis.
// Versi = entri terbaru di history. Naikkan lewat `npm run release`, jangan edit manual.
const raw = require("./changelog.json");

const parse = (v) =>
  String(v || "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

// 1 kalau a > b, -1 kalau a < b, 0 kalau sama.
const compare = (a, b) => {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
};

const entries = (Array.isArray(raw.history) ? raw.history : [])
  .filter((e) => e && e.version)
  .map((e) => ({
    version: String(e.version),
    date: e.date || null,
    notes: Array.isArray(e.notes) ? e.notes.map(String) : [],
  }));

// Urutan di berkas tidak perlu dijaga: di sini selalu diurutkan (terbaru dulu).
const history = entries.slice().sort((a, b) => compare(b.version, a.version));

const version = history.length ? history[0].version : "0.0.0";
const date = history.length ? history[0].date : null;
const changelog = history.length ? history[0].notes : [];

module.exports = { version, date, changelog, history };
