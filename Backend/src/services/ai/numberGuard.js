// services/ai/numberGuard.js
// Penjaga konsistensi angka: nominal "Rp ..." dalam jawaban harus dapat
// ditelusuri ke data yang dikirim ke model — langsung, atau sebagai hasil
// kurang/jumlah dua angka data (margin = omzet - HPP itu sah).
// Deterministik, tanpa LLM.
//
// ponytail: toleransi 1% + rasio gagal >30% baru dianggap pelanggaran —
// pendeteksi fabrikasi kasar, bukan audit akuntansi. Perketat bila perlu.

// "Rp 950 juta" / "Rp 1,23 miliar" / "Rp 123.456.789" / "Rp 7,6 jt" / "Rp0"
const RUPIAH_RE =
  /(?<![a-z])rp\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:,\d+)?)(\s?(?:juta|miliar|ribu|jt|rb|m))?\b/gi;

function parseRupiah(numStr, unit) {
  // Konvensi Indonesia: titik = ribuan, koma = desimal.
  let s = String(numStr).trim().replace(/\./g, "").replace(/,/g, ".");
  const v = parseFloat(s);
  if (!isFinite(v)) return null;
  const u = (unit || "").trim().toLowerCase();
  if (u === "juta" || u === "jt") return v * 1e6;
  if (u === "miliar" || u === "m") return v * 1e9;
  if (u === "ribu" || u === "rb") return v * 1e3;
  return v;
}

function extractAmounts(text) {
  const out = [];
  for (const m of String(text || "").matchAll(RUPIAH_RE)) {
    const value = parseRupiah(m[1], m[2]);
    if (value !== null && value > 0) out.push({ raw: m[0].trim(), value });
  }
  return out;
}

// Kumpulkan semua angka dari JSON hasil tool (termasuk angka di dalam
// string ekspresi margin/hpp seperti "815000000-270500000").
function collectNumbers(jsonStr) {
  const out = [];
  let obj;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    return out;
  }
  const walk = (v) => {
    if (typeof v === "number" && isFinite(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const k of Object.keys(v)) walk(v[k]);
    } else if (typeof v === "string") {
      for (const m of v.matchAll(/-?\d+(\.\d+)?/g)) {
        const n = parseFloat(m[0]);
        if (isFinite(n)) out.push(n);
      }
    }
  };
  walk(obj);
  return out;
}

// ok = rasio nominal tak-terverifikasi ≤ 30%.
function checkAnswer(answer, groundJsons = []) {
  const amounts = extractAmounts(answer);
  if (!amounts.length) return { ok: true, checked: 0, unverified: [] };
  const ground = [];
  for (const j of groundJsons) ground.push(...collectNumbers(j));
  if (!ground.length) return { ok: true, checked: amounts.length, unverified: [] };

  const tol = (v) => Math.max(Math.abs(v) * 0.01, 1);
  const near = (a, b) => Math.abs(a - b) <= tol(b);
  const matchSingle = (v) => ground.some((g) => near(v, g));
  // derived: kurang/jumlah dua angka data — sampling 300 terbesar.
  const top = [...ground].sort((a, b) => Math.abs(b) - Math.abs(a)).slice(0, 300);
  const matchDerived = (v) => {
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        if (near(v, top[i] + top[j]) || near(v, Math.abs(top[i] - top[j]))) return true;
      }
    }
    return false;
  };

  const unverified = [];
  for (const a of amounts) {
    if (matchSingle(a.value) || matchDerived(a.value)) continue;
    unverified.push(a);
  }
  return { ok: unverified.length / amounts.length <= 0.3, checked: amounts.length, unverified };
}

module.exports = { extractAmounts, collectNumbers, checkAnswer };
