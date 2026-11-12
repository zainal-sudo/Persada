// services/ai/summarizer.js
// Helper ringkas hasil laporan menjadi JSON kecil agar hemat token LLM.
// Semua nilai angka dibulatkan; baris penuh tidak dikirim ke model.

const ROUND = (n) => Math.round(Number(n) || 0);

// Total sederet kolom numerik antar baris.
function sumCols(rows, cols) {
  const out = {};
  for (const c of cols) {
    out[c] = ROUND(rows.reduce((a, r) => a + (Number(r[c]) || 0), 0));
  }
  return out;
}

// Baris teratas berdasarkan nilai satu kolom (default desc).
function topBy(rows, key, label, limit = 8) {
  const sorted = [...rows].sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0));
  return sorted.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    name: r[label],
    [(key).toLowerCase()]: ROUND(r[key]),
  }));
}

// Kelompokkan baris ke bucket tipe angka (string tercantum apa adanya).
function buckets(rows, key, defs, otherLabel = "lainnya") {
  const out = {};
  for (const d of defs) {
    if (d.test) out[d.label] = { count: 0 };
    else out[d.label] = { count: 0, total: 0 };
  }
  let other = { count: 0, total: 0 };
  for (const r of rows) {
    const v = r[key];
    const hit = defs.find((d) => d.test && d.test(v));
    if (hit) {
      const b = out[hit.label];
      b.count += 1;
      if (r.Nilai !== undefined) b.total += Number(r.Nilai) || 0;
    } else {
      other.count += 1;
      other.total += Number(r.Nilai) || 0;
    }
  }
  const res = {};
  for (const d of defs) {
    const b = out[d.label];
    res[d.label] = b.total !== undefined ? { count: b.count, total: ROUND(b.total) } : b;
  }
  res[otherLabel] = { count: other.count, total: ROUND(other.total) };
  return res;
}

// Bucket khusus faktur outstanding berdasarkan kolom Range_overdue.
function overdueBuckets(rows) {
  const groups = ["Belum", "0 sd 30", "31 s/d 60", "61 s/d 90", "91 s/d 120", "x > 120"];
  const out = {
    total_faktur: rows.length,
    sisa_piutang: ROUND(rows.reduce((a, r) => a + (Number(r.Sisa_piutang) || 0), 0)),
    by_range: {},
  };
  for (const g of groups) {
    const gRows = rows.filter((r) => String(r.Range_overdue ?? "").trim() === g);
    out.by_range[g] = {
      faktur: gRows.length,
      sisa: ROUND(gRows.reduce((a, r) => a + (Number(r.Sisa_piutang) || 0), 0)),
    };
  }
  return out;
}

const compact = (obj) => JSON.stringify(obj);

module.exports = { ROUND, sumCols, topBy, buckets, overdueBuckets, compact };