// services/ai/tools.js
// Wrapper 4 laporan krm → snapshot ringkas untuk LLM. Semua akses read-only,
// cukup memanggil service laporan yang sudah ada.
const summary = require("./summarizer");
const aiCfg = require("../../config/ai");
const db = require("../../config/database");
const branches = require("./branches");
const listJualPerItemSvc = require("../penjualan/listJualPerItemService");
const fakturOutstandingSvc = require("../laporan/listFakturOutstandingService");
const saldoPiutangSvc = require("../laporan/saldoPiutangService");
const kartuStokSvc = require("../laporan/kartuStokService");
const dashboardSvc = require("../dashboardService");
const listInkasoSvc = require("../laporan/listInkasoService");
const returPenjualanSvc = require("../penjualan/returPenjualanService");
const listJualPerFakturSvc = require("../penjualan/listJualPerFakturService");
const stokExpiredSvc = require("../laporan/stokExpiredService");
const lapBulanan4Svc = require("../laporan/lapBulanan4Service");
const lapBulanan5Svc = require("../laporan/lapBulanan5Service");
const komisiSalesmanSvc = require("../komisi/komisiSalesmanService");
const listJurnalSvc = require("../bukubesar/listJurnalService");
const bukuBankSvc = require("../kasbank/bukuBankService");
const kasHarianSvc = require("../kasbank/kasHarianService");
const doRealisasiSvc = require("../laporan/doRealisasiService");
const listJualPerFakturMarginSvc = require("../laporan/listJualPerFakturMarginService");
const barangRealisasiSvc = require("../laporan/barangRealisasiService");
const transaksiHarianSvc = require("../laporan/transaksiHarianService");
const fakturPajakSvc = require("../penjualan/fakturPajakService");
const pencairanGiroSvc = require("../kasbank/pencairanGiroService");
const bayarBpSvc = require("../penjualan/bayarBiayaPromosiService");
const bayarFmSvc = require("../penjualan/bayarFeeMarketingService");
const fpSvc = require("../penjualan/fpService");
const doSvc = require("../penjualan/doService");
const soSvc = require("../penjualan/soService");
const pemusnahanSvc = require("../persediaan/pemusnahanService");
const penyesuaianStokSvc = require("../persediaan/penyesuaianStokService");
const mutasiGudangSvc = require("../persediaan/mutasiGudangService");
const historyHargaJualSvc = require("../laporan/historyHargaJualService");

// Post-filter baris (case-insensitive contains) — filter dimensi yang tidak
// didukung SQL service tua. Nilai dari AI; hanya menyaring, tidak menyuntik.
const likeFilter = (rows, col, val) =>
  val
    ? rows.filter((r) => String(r[col] ?? "").toLowerCase().includes(String(val).toLowerCase()))
    : rows;

// Service capaian/komisi mengembalikan nilai dalam RIBUAN rupiah — kembalikan
// ke rupiah utuh (invariant snapshot, §6 dokumen) agar numberGuard konsisten.
const scaleThousand = (rows, cols) =>
  rows.map((r) => {
    const o = { ...r };
    for (const k of Object.keys(o)) {
      if (cols.includes(k.toLowerCase()) && Number.isFinite(Number(o[k]))) o[k] = Number(o[k]) * 1000;
    }
    return o;
  });

// Cocokkan param rekening (nama/kode) → 1 rekening eksak, atau daftar kandidat.
// Kode eksak menang; nama: 1 kecocokan = dipakai, >1 = kandidat (jangan menebak).
async function resolveRekening(param, runIn) {
  const [reks] = await runIn(() =>
    db.query("SELECT rek_kode kode, rek_nama nama FROM trekening ORDER BY rek_kode"),
  );
  const list = reks || [];
  const q = String(param || "").trim().toLowerCase();
  if (q) {
    const byKode = list.find((r) => String(r.kode).toLowerCase() === q);
    if (byKode) return { rekening: byKode };
    const byNama = list.filter((r) => String(r.nama || "").toLowerCase().includes(q));
    if (byNama.length === 1) return { rekening: byNama[0] };
    if (byNama.length > 1) return { candidates: byNama.slice(0, 15) };
  }
  return { candidates: list.slice(0, 15) };
}

// Evaluasi ekspresi aritmetika sederhana (+, -, *, /, paren) tanpa eval().
// Dipakai untuk kolom HPP/Margin yang berbentuk ekspresi string.
const BIN = { "+": 1, "-": 1, "*": 2, "/": 2 };
function calcExpr(expr) {
  const toks = expr.replace(/\s+/g, "").match(/-?\d+(\.\d+)?|[+\-*/()]/g) || [];
  const ops = [];
  const vals = [];
  const apply = () => {
    const op = ops.pop();
    const b = vals.pop();
    const a = vals.pop();
    vals.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);
  };
  for (const t of toks) {
    if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") apply();
      ops.pop();
    } else if (BIN[t]) {
      while (ops.length && ops[ops.length - 1] !== "(" && BIN[ops[ops.length - 1]] >= BIN[t]) apply();
      ops.push(t);
    } else vals.push(Number(t));
  }
  while (ops.length) apply();
  return vals[0] || 0;
}

// Ringkas deretan baris realisasi penjualan.
function summarizePenjualan(rows, isFinance) {
  const sum = summary.sumCols(rows, ["Qty", "Nilai", "Nilai_Belum_ppn", "Kontrak", "biaya_promosi", "fee_marketing", "Nilai_Net"]);
  // Periode sebenarnya = MIN/MAX tanggal baris (baris laporan tidak diurut
  // per tanggal, jadi rows[0]/rows[last] menyesatkan model).
  const dateStr = (v) =>
    v instanceof Date
      ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
      : String(v || "");
  const dates = rows.map((r) => dateStr(r.Tanggal)).filter(Boolean).sort();
  const agg = (by) => {
    const map = new Map();
    for (const r of rows) {
      const k = r[by] || "-";
      if (!map.has(k)) {
        // Simpan ekspresi HPP/Margin utk dijumlahkan antar baris (bukan hanya
        // nilai baris terakhir), karena bisa muncul di banyak baris.
        map.set(k, { n: 0, Qty: 0, Nilai: 0, Nilai_Net: 0, hppExpr: [], marginExpr: [] });
      }
      const e = map.get(k);
      e.n += 1;
      e.Qty += Number(r.Qty) || 0;
      e.Nilai += Number(r.Nilai) || 0;
      e.Nilai_Net += Number(r.Nilai_Net) || 0;
      if (r.hpp !== undefined) e.hppExpr.push(String(r.hpp));
      if (r.margin !== undefined) e.marginExpr.push(String(r.margin));
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        n: v.n,
        Qty: summary.ROUND(v.Qty),
        Nilai: summary.ROUND(v.Nilai),
        Nilai_Net: summary.ROUND(v.Nilai_Net),
        HPP: summary.ROUND(v.hppExpr.reduce((a, x) => a + calcExpr(x), 0)),
        Margin: summary.ROUND(v.marginExpr.reduce((a, x) => a + calcExpr(x), 0)),
      }))
      .sort((a, b) => b.Nilai - a.Nilai)
      .slice(0, 8);
  };
  const snap = {
    laporan: "realisasi_penjualan",
    baris: rows.length,
    periode: dates.length ? `${dates[0]} s.d ${dates[dates.length - 1]}` : "-",
    summary: sum,
    top_outlet: agg("Outlet"),
    top_barang: agg("Nama"),
    top_kategori: agg("Kategori"),
    top_departemen: agg("Departemen"),
    top_rayon: agg("Rayon"),
    top_salesman: agg("Salesman"),
  };
  if (!isFinance) {
    for (const k of ["top_outlet", "top_barang", "top_kategori", "top_departemen", "top_rayon", "top_salesman"])
      snap[k] = snap[k].map((x) => ({ name: x.name, n: x.n, Qty: x.Qty, Nilai: x.Nilai, Nilai_Net: x.Nilai_Net }));
  }
  return snap;
}

// Ringkas faktur outstanding.
function summarizeOutstanding(rows, detailFocus) {
  const tot = rows.reduce((a, r) => a + (Number(r.Sisa_piutang) || 0), 0);
  const topCus = {};
  for (const r of rows) {
    const k = r.Customer || "-";
    topCus[k] = (topCus[k] || 0) + (Number(r.Sisa_piutang) || 0);
  }
  const topCustomers = Object.entries(topCus)
    .map(([name, sisa]) => ({ name, sisa: summary.ROUND(sisa) }))
    .sort((a, b) => b.sisa - a.sisa)
    .slice(0, 8);

  const base = {
    laporan: "faktur_outstanding",
    baris: rows.length,
    total_sisa: summary.ROUND(tot),
    ...summary.overdueBuckets(rows),
    top_customer: topCustomers,
  };

  // Mode detail: breakdown per customer (nama, jumlah faktur, sisa) + 3 nomor
  // faktur terbesar sebagai sampel — tetap ringkas, bukan dump 484 baris.
  if (detailFocus) {
    const dateId = (v) =>
      v instanceof Date
        ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
        : v;
    const perCus = new Map();
    for (const r of rows) {
      const k = r.Customer || "-";
      if (!perCus.has(k)) perCus.set(k, { faktur: 0, sisa: 0, items: [] });
      const e = perCus.get(k);
      e.faktur += 1;
      e.sisa += Number(r.Sisa_piutang) || 0;
      e.items.push(r);
    }
    const list = [...perCus.entries()]
      .map(([name, v]) => {
        const top = [...v.items]
          .sort((a, b) => (Number(b.Sisa_piutang) || 0) - (Number(a.Sisa_piutang) || 0))
          .slice(0, 3)
          .map((r) => ({
            nomor: r.Nomor,
            tanggal: dateId(r.Tanggal),
            jthTempo: dateId(r.JthTempo),
            overdue: Number(r.Overdue) || 0,
            sisa: summary.ROUND(r.Sisa_piutang),
          }));
        return { customer: name, faktur: v.faktur, sisa: summary.ROUND(v.sisa), contoh_faktur: top };
      })
      .sort((a, b) => b.sisa - a.sisa)
      .slice(0, 15);
    return { ...base, mode: detailFocus, per_customer: list };
  }

  return base;
}

// Ringkas saldo piutang.
function summarizeSaldoPiutang(rows) {
  const total = (col) => summary.ROUND(rows.reduce((a, r) => a + (Number(r[col]) || 0), 0));
  const top = summary.topBy(rows, "Saldo_Akhir", "Nama", 8);
  return {
    laporan: "saldo_piutang",
    baris: rows.length,
    summary: {
      Saldo_Awal: total("Saldo_Awal"),
      Total: total("Total"),
      Retur: total("Retur"),
      Bayar_Cash: total("Bayar_cash"),
      Bayar_Transfer: total("Bayar_transfer"),
      Giro: total("Giro"),
      Saldo_Akhir: total("Saldo_Akhir"),
    },
    top_customer: top,
  };
}

// Ringkas kartu stok (browse).
function summarizeKartuStok(rows) {
  const sum = summary.sumCols(rows, ["_Awal", "_In", "_Out", "_Akhir"]);
  const byKategori = (byKey) => {
    const map = new Map();
    for (const r of rows) {
      const k = r[byKey] || "-";
      if (!map.has(k)) map.set(k, { n: 0, _Awal: 0, _In: 0, _Out: 0, _Akhir: 0 });
      const e = map.get(k);
      e.n += 1;
      e._Awal += Number(r._Awal) || 0;
      e._In += Number(r._In) || 0;
      e._Out += Number(r._Out) || 0;
      e._Akhir += Number(r._Akhir) || 0;
    }
    return [...map.entries()].map(([name, v]) => ({
      name,
      n: v.n,
      Awal: summary.ROUND(v._Awal),
      Masuk: summary.ROUND(v._In),
      Keluar: summary.ROUND(v._Out),
      Akhir: summary.ROUND(v._Akhir),
    }));
  };
  return {
    laporan: "kartu_stok",
    baris: rows.length,
    summary: sum,
    top_kategori: byKategori("Kategori").sort((a, b) => b.Akhir - a.Akhir).slice(0, 8),
    top_masuk: summary.topBy(rows, "_In", "Nama", 6),
    top_keluar: summary.topBy(rows, "_Out", "Nama", 6),
  };
}

// Ringkas detail kartu stok per barang.
function summarizeStokDetail(rows, kode) {
  const agg = (by) => {
    const map = new Map();
    for (const r of rows) {
      const k = r[by] || "-";
      if (!map.has(k)) map.set(k, { in: 0, out: 0 });
      const e = map.get(k);
      e.in += Number(r._IN) || 0;
      e.out += Number(r._OUT) || 0;
    }
    return [...map.entries()].map(([name, v]) => ({
      name,
      masuk: summary.ROUND(v.in),
      keluar: summary.ROUND(v.out),
    }));
  };
  return {
    laporan: "kartu_stok.detail",
    kode,
    baris: rows.length,
    total_masuk: summary.ROUND(rows.reduce((a, r) => a + (Number(r._IN) || 0), 0)),
    total_keluar: summary.ROUND(rows.reduce((a, r) => a + (Number(r._OUT) || 0), 0)),
    per_keterangan: agg("Keterangan"),
    referensi_terakhir: rows.slice(-5).map((r) => ({
      tanggal: r.Tanggal,
      nomor: r.Nomor,
      ket: r.Keterangan,
      masuk: Number(r._IN) || 0,
      keluar: Number(r._OUT) || 0,
    })),
  };
}

// Ringkas dashboard/briefing menjadi snapshot kecil untuk model.
function summarizeDashboard(s) {
  return {
    cabang: s.cabang,
    per_tanggal: s.asOfDate,
    omzet_bulan_ini: s.penjualan.omzet,
    omzet_bulan_lalu: s.penjualan.omzetPrev,
    perubahan_persen: s.penjualan.deltaPct,
    omzet_sebelum_ppn: s.penjualan.omzetPpn,
    jumlah_faktur: s.penjualan.faktur,
    omzet_tanggal: s.penjualan.onDate,
    piutang_outstanding: s.piutang.totalSisa,
    piutang_lewat_120_hari: s.piutang.gt120,
    piutang_top_overdue: s.piutang.topOverdue,
    piutang_aging: s.piutang.buckets,
    inkaso_bulan_ini: s.inkaso,
    retur_bulan_ini: s.retur,
    top_customer: s.topCustomer,
    top_item: s.topItem,
    stok: {
      nilai_persediaan: s.stok.nilaiPersediaan,
      item_kritis: s.stok.kritisCount,
      item_stok_negatif: s.stok.negatifCount,
      contoh_kritis: s.stok.kritisTop.slice(0, 5),
    },
  };
}

// Ringkas hasil cari_master: kandidat nama eksak untuk query.
function summarizeCariMaster(res) {
  return {
    jenis: res.jenis,
    jumlah: res.rows.length,
    kandidat: res.rows.map((r) => ({ kode: r.kode, nama: r.nama })),
    petunjuk: res.rows.length
      ? "Gunakan nama/kode EKSAK di atas dalam query berikutnya."
      : "Tidak ada yang cocok — coba keyword lain sebelum menyimpulkan data kosong.",
  };
}

// ── Summarizer tool baru ─────────────────────────────────────────────

const periodeDari = (rows, col) => {
  const ds = rows.map((r) => (r[col] instanceof Date ? r[col].toISOString().slice(0, 10) : String(r[col] || "")))
    .filter(Boolean).sort();
  return ds.length ? `${ds[0]} s.d ${ds[ds.length - 1]}` : "-";
};

function summarizeInkaso(rows) {
  const topCus = {};
  for (const r of rows) {
    const k = r.Customer || "-";
    topCus[k] = (topCus[k] || 0) + (Number(r.Terbayar) || 0);
  }
  const top = Object.entries(topCus)
    .map(([nama, total]) => ({ nama, total: summary.ROUND(total) }))
    .sort((a, b) => b.total - a.total).slice(0, 8);
  const buckets = {};
  for (const r of rows) {
    const k = String(r.Range_Hari || "-").trim();
    buckets[k] = buckets[k] || { jumlah: 0, total: 0 };
    buckets[k].jumlah += 1;
    buckets[k].total += Number(r.Terbayar) || 0;
  }
  return {
    laporan: "inkaso",
    baris: rows.length,
    periode: periodeDari(rows, "TglBayar"),
    summary: summary.sumCols(rows, ["Terbayar", "Ppn", "BiayaPromosi", "Kontrak"]),
    umur_pembayaran: buckets,
    top_customer: top,
  };
}

function summarizeRetur(rows) {
  const top = [...rows]
    .sort((a, b) => (Number(b.Total) || 0) - (Number(a.Total) || 0))
    .slice(0, 8)
    .map((r) => ({
      nomor: r.Nomor, tanggal: r.Tanggal, customer: r.Customer,
      salesman: r.Salesman, total: summary.ROUND(r.Total), faktur: r.Nomor_Faktur,
    }));
  return {
    laporan: "retur_penjualan",
    baris: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    summary: summary.sumCols(rows, ["Total", "Ppn", "Retur_CN"]),
    top_retur: top,
  };
}

function summarizePenjualanPerFaktur(rows) {
  const top = [...rows]
    .sort((a, b) => (Number(b.Riil) || 0) - (Number(a.Riil) || 0))
    .slice(0, 8)
    .map((r) => ({
      nomor: r.Nomor, tanggal: r.Tanggal, customer: r.Customer, salesman: r.Salesman,
      total: summary.ROUND(r.Total), riil: summary.ROUND(r.Riil), tax: r.Tax,
    }));
  return {
    laporan: "penjualan_per_faktur",
    baris: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    summary: summary.sumCols(rows, ["Total", "Riil", "Retur", "Kontrak", "Biaya_Promosi"]),
    top_faktur: top,
  };
}

function summarizeStokExpired(rows, isFinance) {
  const totalNilai = rows.reduce((a, r) => a + (Number(r.Stok) || 0) * (Number(r.HargaBeli) || 0), 0);
  const top = [...rows]
    .sort((a, b) => new Date(a.Expired) - new Date(b.Expired))
    .slice(0, 8)
    .map((r) => ({
      kode: r.Kode, nama: r.Nama, expired: r.Expired, stok: summary.ROUND(r.Stok),
      ...(isFinance ? { harga_beli: summary.ROUND(r.HargaBeli) } : {}),
    }));
  return {
    laporan: "stok_expired",
    baris: rows.length,
    total_stok: summary.ROUND(rows.reduce((a, r) => a + (Number(r.Stok) || 0), 0)),
    ...(isFinance ? { total_nilai: summary.ROUND(totalNilai) } : {}),
    top_expired: top,
  };
}

function summarizeCapaian(res) {
  const { dimensi, bulan, tahun } = res;
  // Service mengembalikan ribuan rupiah → rupiah utuh (kolom nilai saja,
  // persen/growth/jumlah tidak).
  const rows = scaleThousand(res.rows || [], [
    "targetbulanini", "targetsdbulanini", "riilbulanini", "riilsdbulanini",
    "riilbulaninilalu", "riilsdbulaninilalu", "targettahunan",
    "targetpiutang", "realisasipiutang", "realisasiall", "pf",
    "riilbulanininonn3", "riilsdbulanininonn3", "riilbulaninilalunonn3",
    "riilsdbulaninilalunonn3",
  ]);
  const R1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const pick = (r) => ({
    nama: dimensi === "departemen" ? r.Departemen : r.rayon,
    ...(dimensi === "rayon" && r.salesman ? { salesman: r.salesman } : {}),
    target: summary.ROUND(r.targetbulanini ?? r.TargetBulanini),
    riil: summary.ROUND(r.riilbulanini),
    capaian_pct: R1(r.persenbulanini),
    target_sd: summary.ROUND(r.targetsdbulanini ?? r.Targetsdbulanini),
    riil_sd: summary.ROUND(r.riilsdbulanini),
    capaian_sd_pct: R1(r.persensdbulanini),
    riil_bulan_lalu: summary.ROUND(r.riilbulaninilalu),
    growth_pct: R1(r.growth),
    target_tahunan: summary.ROUND(r.targettahunan),
    ratio_tahunan_pct: R1(r.ratio),
    pf: summary.ROUND(r.pf),
    target_piutang: summary.ROUND(r.targetpiutang),
    realisasi_piutang_all: summary.ROUND(r.realisasiall),
    customer_baru: Number(r.newcustomer) || 0,
  });
  const list = rows.map(pick);
  const total = list.find((x) => /^(TOTAL|total)$/i.test(x.nama || ""));
  return {
    laporan: "capaian_sales",
    dimensi, bulan, tahun,
    keterangan: "capaian = omzet bersih (setelah kontrak, biaya promosi, fee marketing, retur); growth = riil bulan ini vs bulan sama tahun lalu (%)",
    ...(total ? { total } : {}),
    per: list.filter((x) => x !== total).sort((a, b) => (b.riil || 0) - (a.riil || 0)).slice(0, 20),
  };
}

function summarizeKomisi(res) {
  const { bulan, tahun } = res;
  // grid1: kolom piutang dalam ribuan → rupiah utuh; grid2 sudah utuh.
  const grid1 = scaleThousand(res.grid1 || [], ["target_piutang", "realisasi_tempo", "realisasi_all"]);
  const grid2 = res.grid2 || [];
  const R1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const g1 = grid1
    .map((r) => ({
      salesman: r.salesman, rayon: r.rayon,
      target_jual: summary.ROUND(r.target_jual), realisasi_jual: summary.ROUND(r.realisasi_jual),
      capaian_pct: R1(r.persentase_jual),
      realisasi_pf: summary.ROUND(r.realisasi_pf),
      target_piutang: summary.ROUND(r.target_piutang), realisasi_piutang: summary.ROUND(r.realisasi_tempo),
      realisasi_all: summary.ROUND(r.realisasi_all),
    }))
    .sort((a, b) => (b.realisasi_jual || 0) - (a.realisasi_jual || 0))
    .slice(0, 15);
  const g2 = grid2
    .map((r) => ({
      salesman: r.salesman, riil: summary.ROUND(r.riil),
      biaya_promosi: summary.ROUND(r.biaya_promosi), fee_marketing: summary.ROUND(r.fee_marketing),
      kontrak: summary.ROUND(r.kontrak),
      komisi_jual: summary.ROUND(r.komisi_jual), total_komisi: summary.ROUND(r.total),
    }))
    .sort((a, b) => (b.total_komisi || 0) - (a.total_komisi || 0))
    .slice(0, 15);
  return {
    laporan: "komisi_salesman",
    bulan, tahun,
    rekap: g1,
    rincian_komisi: g2,
    total_komisi: summary.ROUND(grid2.reduce((a, r) => a + (Number(r.total) || 0), 0)),
  };
}

function summarizeJurnal(rows) {
  const perAkun = {};
  for (const r of rows) {
    const k = `${r.AccountName || r.Account || "-"}`;
    perAkun[k] = perAkun[k] || { akun: k, debet: 0, kredit: 0, jml: 0 };
    perAkun[k].debet += Number(r.Debet) || 0;
    perAkun[k].kredit += Number(r.Kredit) || 0;
    perAkun[k].jml += 1;
  }
  const top = Object.values(perAkun)
    .sort((a, b) => b.debet + b.kredit - (a.debet + a.kredit))
    .slice(0, 10)
    .map((x) => ({ akun: x.akun, debet: summary.ROUND(x.debet), kredit: summary.ROUND(x.kredit), jml: x.jml }));
  return {
    laporan: "jurnal",
    baris: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    summary: summary.sumCols(rows, ["Debet", "Kredit"]),
    top_akun: top,
  };
}

function summarizeBukuBank(res) {
  if (res.butuh_rekening)
    return {
      laporan: "buku_bank",
      pesan: "Nama rekening kurang spesifik — panggil ulang tool ini dengan rekening eksak dari kandidat berikut.",
      kandidat_rekening: res.kandidat,
    };
  const rows = res.rows || [];
  const saldoAwal = rows.find((r) => r.Keterangan === "Saldo Awal");
  const mutasi = rows.filter((r) => r.Keterangan !== "Saldo Awal");
  const saldoAkhir = rows.length ? Number(rows[rows.length - 1].Saldo) || 0 : 0;
  const top = [...mutasi]
    .sort((a, b) => Math.abs(Number(b.Debet) || 0) + Math.abs(Number(b.Kredit) || 0) - (Math.abs(Number(a.Debet) || 0) + Math.abs(Number(a.Kredit) || 0)))
    .slice(0, 8)
    .map((r) => ({
      tanggal: r.Tanggal, keterangan: r.Keterangan,
      masuk: summary.ROUND(r.Debet), keluar: summary.ROUND(r.Kredit),
    }));
  return {
    laporan: "buku_bank",
    rekening: res.rekening?.nama,
    baris: mutasi.length,
    saldo_awal: summary.ROUND(saldoAwal?.Saldo),
    saldo_akhir: summary.ROUND(saldoAkhir),
    total_masuk: summary.ROUND(mutasi.reduce((a, r) => a + (Number(r.Debet) || 0), 0)),
    total_keluar: summary.ROUND(mutasi.reduce((a, r) => a + (Number(r.Kredit) || 0), 0)),
    mutasi_terbesar: top,
  };
}

function summarizeKasHarian(res) {
  if (res.butuh_rekening)
    return {
      laporan: "kas_harian",
      pesan: "Nama rekening kurang spesifik — panggil ulang tool ini dengan rekening eksak dari kandidat berikut.",
      kandidat_rekening: res.kandidat,
    };
  const rows = res.rows || [];
  const saldoAwal = rows.find((r) => r.Keterangan === "Saldo Awal");
  const rekap = rows.filter((r) => r.Keterangan !== "Saldo Awal");
  return {
    laporan: "kas_harian",
    rekening: res.rekening?.nama,
    tanggal: res.tanggal,
    saldo_awal: summary.ROUND(saldoAwal?.Saldo),
    saldo_akhir: summary.ROUND(rows.length ? rows[rows.length - 1].Saldo : 0),
    total_masuk: summary.ROUND(rekap.reduce((a, r) => a + (Number(r.Debet) || 0), 0)),
    total_keluar: summary.ROUND(rekap.reduce((a, r) => a + (Number(r.Kredit) || 0), 0)),
    rekap: rekap.slice(0, 15).map((r) => ({
      keterangan: r.Keterangan, masuk: summary.ROUND(r.Debet), keluar: summary.ROUND(r.Kredit), saldo: summary.ROUND(r.Saldo),
    })),
  };
}

function summarizeOmzetCabang(res) {
  const rows = [...(res.rows || [])].sort((a, b) => (Number(b.omzet) || 0) - (Number(a.omzet) || 0));
  const total = rows.reduce((a, r) => a + (Number(r.omzet) || 0), 0);
  const totalTarget = rows.reduce((a, r) => a + (Number(r.target) || 0), 0);
  return {
    laporan: "omzet_cabang",
    periode: res.periode,
    cabang_gagal_probe: res.gagal || [],
    keterangan: "target = target bulan PENUH (tsalesmantarget) — omzet = nilai faktur setelah diskon + PPN, TANPA ongkir, dikurangi retur pada periode yang sama; capaian = omzet / target × 100 (bukan capaian resmi Riil per-rayon)",
    total_grup: summary.ROUND(total),
    total_faktur: rows.reduce((a, r) => a + (Number(r.faktur) || 0), 0),
    total_target: summary.ROUND(totalTarget),
    ...(totalTarget > 0 ? { total_capaian_pct: Math.round((total / totalTarget) * 1000) / 10 } : {}),
    per_cabang: rows.map((r) => ({
      cabang: r.cabang,
      faktur: Number(r.faktur) || 0,
      omzet: summary.ROUND(r.omzet),
      omzet_blm_ppn: summary.ROUND(r.omzet_blm_ppn),
      ...(Number(r.target) > 0 ? { target: summary.ROUND(r.target) } : {}),
      ...(r.capaian_pct !== undefined ? { capaian_pct: r.capaian_pct } : {}),
      ...(r.error ? { error: r.error } : {}),
    })),
  };
}

function summarizeRekapCabang(res) {
  // Ranking lintas cabang (metrik *_customer): rows sudah digabung + dirangking di exec.
  if (["piutang_customer", "omzet_customer", "cn_customer", "biaya_promosi_customer", "fee_marketing_customer"].includes(res.metrik)) {
    const ket = {
      piutang_customer: "peringkat customer piutang terbesar digabung dari semua cabang (sisa = FP_amount - DP - bayar, header-level tanpa retur); customer yang sama ada di beberapa cabang dijumlahkan",
      omzet_customer: "peringkat customer omzet terbesar digabung dari semua cabang (omzet kotor per faktur)",
      cn_customer: "peringkat customer dengan nilai KONTRAK (CN) terbesar digabung dari semua cabang — hanya faktur ber-CN",
      biaya_promosi_customer: "peringkat customer penerima biaya promosi terbesar digabung dari semua cabang (formula header: persen × nilai sebelum PPN + rupiah)",
      fee_marketing_customer: "peringkat customer penerima fee marketing terbesar digabung dari semua cabang (dari detail item, tanpa netting retur — pendekatan ranking)",
    }[res.metrik];
    return {
      laporan: "rekap_cabang",
      metrik: res.metrik,
      batas: res.batas,
      periode: res.periode,
      cabang_gagal_probe: res.gagal || [],
      keterangan: ket,
      total_all: res.total_all,
      jumlah_customer: res.jumlah_customer,
      top_customer: res.rows || [],
    };
  }
  const rows = [...(res.rows || [])];
  const ket = {
    piutang: "sisa = FP_amount - DP - bayar per faktur (header-level, TANPA retur — bisa sedikit beda dari laporan outstanding resmi); overdue120 = jatuh tempo sudah lewat 120 hari dari hari ini",
    inkaso: "penerimaan pembayaran customer per tanggal bayar (header-level)",
    stok: "nilai = brg_stok × brg_lastcost barang aktif; kritis = stok <= stok minimum; negatif = stok < 0",
    jurnal: "rekap jurnal (alljurnal) per akun terfilter; Debet = pembebanan (biaya), Kredit = pengakuan (pendapatan/sumber). Rekap header — untuk rincian transaksi gunakan list jurnal per cabang",
  }[res.metrik];
  const main =
    res.metrik === "piutang" ? "sisa"
      : res.metrik === "inkaso" ? "total"
        : res.metrik === "jurnal" ? "debet"
          : "nilai";
  rows.sort((a, b) => (Number(b[main]) || 0) - (Number(a[main]) || 0));
  const sum = (f) => summary.ROUND(rows.reduce((a, r) => a + (Number(r[f]) || 0), 0));
  return {
    laporan: "rekap_cabang",
    metrik: res.metrik,
    ...(res.metrik === "jurnal" && res.akun ? { akun: res.akun } : {}),
    periode: res.periode,
    cabang_gagal_probe: res.gagal || [],
    keterangan: ket,
    total: res.metrik === "piutang"
      ? { sisa: sum("sisa"), overdue120_nilai: sum("overdue120_nilai") }
      : res.metrik === "inkaso" ? { total: sum("total") }
        : res.metrik === "jurnal" ? { debet: sum("debet"), kredit: sum("kredit") }
          : { nilai: sum("nilai"), kritis: sum("kritis"), negatif: sum("negatif") },
    per_cabang: rows.map((r) => ({
      cabang: r.cabang,
      ...(res.metrik === "piutang"
        ? { faktur: Number(r.faktur) || 0, sisa: summary.ROUND(r.sisa), overdue120_faktur: Number(r.overdue120_faktur) || 0, overdue120_nilai: summary.ROUND(r.overdue120_nilai) }
        : res.metrik === "inkaso"
          ? { dokumen: Number(r.dokumen) || 0, total: summary.ROUND(r.total) }
          : res.metrik === "jurnal"
            ? { baris: Number(r.baris) || 0, debet: summary.ROUND(r.debet), kredit: summary.ROUND(r.kredit) }
            : { nilai: summary.ROUND(r.nilai), kritis: Number(r.kritis) || 0, negatif: Number(r.negatif) || 0 }),
      ...(r.error ? { error: r.error } : {}),
    })),
  };
}

function summarizeStokAnalisis(res) {
  const { slowMoving, habis, oos, ambang, batas = 15, periode } = res;
  const smTop = (slowMoving || [])
    .slice(0, batas)
    .map((r, i) => ({ rank: i + 1, nama: r.Nama, kategori: r.Kategori, stok_akhir: summary.ROUND(r._Akhir), keluar: summary.ROUND(r._Out) }));
  const habisTop = (habis || [])
    .slice(0, batas)
    .map((r, i) => ({ rank: i + 1, nama: r.Nama, keluar: summary.ROUND(r._Out), akhir: summary.ROUND(r._Akhir) }));
  const oosTop = (oos || [])
    .sort((a, b) => (Number(b.pernah_jual_periode ? 1 : 0) - Number(a.pernah_jual_periode ? 1 : 0)) || (Number(a.brg_stok) || 0) - (Number(b.brg_stok) || 0))
    .slice(0, batas)
    .map((r, i) => ({ rank: i + 1, nama: r.brg_nama, stok: summary.ROUND(r.brg_stok), min: summary.ROUND(r.brg_MIN_STOK), ...(r.pernah_jual_periode ? { masih_laris: true } : {}) }));
  return {
    laporan: "stok_analisis",
    periode: `${periode.startDate} s.d ${periode.endDate}`,
    slow_moving: { ambang_keluar: ambang, jumlah: (slowMoving || []).length, top: smTop },
    habis_di_periode: { jumlah: (habis || []).length, top: habisTop },
    out_of_stock_sekarang: {
      jumlah: res.oosTotal ?? (oos || []).length,
      masih_laris: (oos || []).filter((r) => r.pernah_jual_periode).length,
      top: oosTop,
    },
  };
}

function summarizeKunjungan(res) {
  const rows = res.rows || [];
  const perSalesman = {};
  const perKeperluan = {};
  const perOutlet = {};
  for (const r of rows) {
    const s = r.salesman || "-";
    perSalesman[s] = perSalesman[s] || { salesman: s, kunjungan: 0, outlet: new Set() };
    perSalesman[s].kunjungan += 1;
    perSalesman[s].outlet.add(r.cus_kode);
    const k = String(r.keperluan || "-").trim() || "-";
    perKeperluan[k] = (perKeperluan[k] || 0) + 1;
    const o = r.outlet || r.cus_kode || "-";
    perOutlet[o] = (perOutlet[o] || 0) + 1;
  }
  return {
    laporan: "kunjungan",
    periode: res.periode,
    total: rows.length,
    per_salesman: Object.values(perSalesman)
      .map((x) => ({ salesman: x.salesman, kunjungan: x.kunjungan, outlet_unik: x.outlet.size }))
      .sort((a, b) => b.kunjungan - a.kunjungan)
      .slice(0, 15),
    per_keperluan: Object.entries(perKeperluan)
      .map(([keperluan, jumlah]) => ({ keperluan, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 8),
    top_outlet: Object.entries(perOutlet)
      .map(([outlet, jumlah]) => ({ outlet, kunjungan: jumlah }))
      .sort((a, b) => b.kunjungan - a.kunjungan)
      .slice(0, 8),
  };
}

function summarizePiutangMasuk(res) {
  const jt = res.jatuhTempo || [];
  const giro = res.giroBelumCair || [];
  const perTanggal = {};
  const perCustomer = {};
  for (const r of jt) {
    const t = r.tanggal || "-";
    perTanggal[t] = perTanggal[t] || { tanggal: t, faktur: 0, nilai: 0 };
    perTanggal[t].faktur += 1;
    perTanggal[t].nilai += Number(r.jt_nilai) || 0;
    const c = r.customer || "-";
    perCustomer[c] = (perCustomer[c] || 0) + (Number(r.jt_nilai) || 0);
  }
  return {
    laporan: "piutang_masuk",
    periode: res.periode,
    jatuh_tempo: {
      jumlah_faktur: jt.length,
      total: summary.ROUND(jt.reduce((a, r) => a + (Number(r.jt_nilai) || 0), 0)),
      per_tanggal: Object.values(perTanggal)
        .sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
        .slice(0, 10)
        .map((x) => ({ tanggal: x.tanggal, faktur: x.faktur, nilai: summary.ROUND(x.nilai) })),
      top_customer: Object.entries(perCustomer)
        .map(([customer, nilai]) => ({ customer, nilai: summary.ROUND(nilai) }))
        .sort((a, b) => b.nilai - a.nilai)
        .slice(0, 8),
    },
    giro_belum_cair: {
      jumlah: giro.length,
      total: summary.ROUND(giro.reduce((a, r) => a + (Number(r.nilai) || 0), 0)),
      terlama: [...giro]
        .sort((a, b) => (String(a.tanggal_terima) < String(b.tanggal_terima) ? -1 : 1))
        .slice(0, 8)
        .map((r) => ({ nomor: r.nomor, tanggal_terima: r.tanggal_terima, giro: r.giro, nilai: summary.ROUND(r.nilai) })),
    },
  };
}

function summarizeDoRealisasi(res) {
  const rows = res.rows || [];
  const belum = rows.filter((r) => String(r.Status) === "Belum Terkirim");
  return {
    laporan: "do_realisasi",
    periode: periodeDari(rows, "Tanggal"),
    status: {
      terkirim: rows.length - belum.length,
      belum_terkirim: belum.length,
    },
    contoh_belum_terkirim: [...belum]
      .sort((a, b) => (String(a.Tanggal) < String(b.Tanggal) ? -1 : 1))
      .slice(0, 10)
      .map((r) => ({ nomor: r.Nomor, tanggal: r.Tanggal, customer: r.Customer })),
  };
}

function summarizeFakturMargin(res) {
  const rows = res.rows || [];
  const base = {
    laporan: "faktur_margin",
    baris: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    summary: summary.sumCols(rows, ["Total", "Riil", "Net"]),
  };
  if (!res.isFinance) return base;
  const sorted = [...rows].sort((a, b) => (Number(a.Margin) || 0) - (Number(b.Margin) || 0));
  const minus = sorted.filter((r) => (Number(r.Margin) || 0) < 0);
  return {
    ...base,
    summary: { ...base.summary, ...summary.sumCols(rows, ["Hpp", "Margin"]) },
    margin_minus: {
      jumlah: minus.length,
      total_margin_minus: summary.ROUND(minus.reduce((a, r) => a + (Number(r.Margin) || 0), 0)),
      terburuk: minus.slice(0, 8).map((r) => ({
        nomor: r.Nomor, tanggal: r.Tanggal, customer: r.Customer,
        net: summary.ROUND(r.Net), hpp: summary.ROUND(r.Hpp), margin: summary.ROUND(r.Margin),
      })),
    },
    top_margin: [...rows]
      .sort((a, b) => (Number(b.Margin) || 0) - (Number(a.Margin) || 0))
      .slice(0, 8)
      .map((r) => ({ nomor: r.Nomor, customer: r.Customer, margin: summary.ROUND(r.Margin) })),
  };
}

function summarizePbOutstanding(res) {
  const rows = res.rows || [];
  return {
    laporan: res.tool || "pb_outstanding",
    baris: rows.length,
    total_kurang: summary.ROUND(rows.reduce((a, r) => a + (Number(r.Kurang) || 0), 0)),
    top: [...rows]
      .sort((a, b) => (Number(b.Kurang) || 0) - (Number(a.Kurang) || 0))
      .slice(0, 10)
      .map((r) => ({
        sku: r.SKU, nama: r.NamaBarang,
        minta: summary.ROUND(r.Minta), terima: summary.ROUND(r.Terima), kurang: summary.ROUND(r.Kurang),
        ...(r.Nomor ? { nomor_pb: r.Nomor } : {}),
      })),
  };
}

function summarizeTransaksiPiutang(rows) {
  const perCus = {};
  for (const r of rows) {
    const k = r.Nama || r.Customer || "-";
    perCus[k] = perCus[k] || { customer: k, total: 0, cash: 0, transfer: 0, giro: 0, retur: 0 };
    perCus[k].total += Number(r.Total) || 0;
    perCus[k].cash += Number(r.Bayar_Cash) || 0;
    perCus[k].transfer += Number(r.Bayar_Transfer) || 0;
    perCus[k].giro += Number(r.Giro) || 0;
    perCus[k].retur += Number(r.Retur) || 0;
  }
  const top = Object.values(perCus)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((x) => ({
      customer: x.customer, total: summary.ROUND(x.total),
      bayar_cash: summary.ROUND(x.cash), bayar_transfer: summary.ROUND(x.transfer),
      giro: summary.ROUND(x.giro), retur: summary.ROUND(x.retur),
    }));
  return {
    laporan: "transaksi_piutang",
    baris: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    summary: summary.sumCols(rows, ["Total", "Bayar_Cash", "Bayar_Transfer", "Giro", "Retur", "Kontrak", "Biaya_Promosi"]),
    top_customer: top,
  };
}

function summarizeFakturPajak(rows) {
  const top = [...rows]
    .sort((a, b) => (Number(b.Total) || 0) - (Number(a.Total) || 0))
    .slice(0, 8)
    .map((r) => ({ nomor: r.Nomor, nomor_pajak: r.FakturPajak, tanggal: r.Tanggal, customer: r.Customer, total: summary.ROUND(r.Total), ppn: summary.ROUND(r.Ppn) }));
  return {
    laporan: "faktur_pajak",
    jumlah: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    total_ppn: summary.ROUND(rows.reduce((a, r) => a + (Number(r.Ppn) || 0), 0)),
    top: top,
  };
}

function summarizePencairanGiro(rows) {
  const top = [...rows]
    .sort((a, b) => (Number(b.Nilai) || 0) - (Number(a.Nilai) || 0))
    .slice(0, 8)
    .map((r) => ({ nomor: r.Nomor, giro: r.GiroNumber, tgl_cair: r.TglCair, bank: r.Bank, nilai: summary.ROUND(r.Nilai) }));
  return {
    laporan: "pencairan_giro",
    jumlah: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    total: summary.ROUND(rows.reduce((a, r) => a + (Number(r.Nilai) || 0), 0)),
    top: top,
  };
}

function summarizeKlaim(res) {
  const rows = res.rows || [];
  const top = [...rows]
    .sort((a, b) => (Number(b.Nilai) || 0) - (Number(a.Nilai) || 0))
    .slice(0, 8)
    .map((r) => ({ nomor: r.Nomor, tanggal: r.Tanggal, customer: r.Customer, salesman: r.Salesman, nilai: summary.ROUND(r.Nilai), rekening: r.Rekening }));
  return {
    laporan: "klaim",
    jenis: res.jenis === "fm" ? "fee_marketing" : "biaya_promosi",
    jumlah: rows.length,
    periode: periodeDari(rows, "Tanggal"),
    total: summary.ROUND(rows.reduce((a, r) => a + (Number(r.Nilai) || 0), 0)),
    top: top,
  };
}

function summarizeTagihanEkspedisi(rows) {
  return {
    laporan: "tagihan_ekspedisi",
    jumlah_faktur: rows.length,
    periode: periodeDari(rows, "tanggal"),
    total_biaya: summary.ROUND(rows.reduce((a, r) => a + (Number(r.biaya) || 0), 0)),
    terbesar: (rows || []).slice(0, 8).map((r) => ({ nomor: r.nomor, customer: r.customer, tanggal: r.tanggal, biaya: summary.ROUND(r.biaya) })),
  };
}

function summarizeDetailDokumen(res) {
  if (!res.header)
    return { laporan: "detail_dokumen", jenis: res.jenis, nomor: res.nomor, pesan: "Dokumen tidak ditemukan — cek ejaan nomor (contoh format: 01-FP.2605.0907)." };
  return {
    laporan: "detail_dokumen",
    jenis: res.jenis,
    header: res.header,
    jumlah_item: (res.items || []).length,
    item: (res.items || []).slice(0, 30).map((r) => ({
      kode: r.Kode, nama: r.Nama, satuan: r.Satuan, qty: r.Jumlah, harga: r.Harga, disc: r.Disc, nilai: r.Nilai,
    })),
  };
}

function summarizeStokOps(res) {
  const rows = res.rows || [];
  const { jenis } = res;
  if (res.tool === "stok_ops.detail")
    return {
      laporan: "stok_ops", jenis, mode: "detail", nomor: res.nomor, jumlah_item: rows.length,
      item: rows.slice(0, 30).map((r) => ({
        kode: r.Kode, nama: r.Nama, expired: r.Expired, satuan: r.Satuan,
        qty: r.QtyMusnah ?? r.QtyKorksi ?? r.Jumlah, harga: r.Harga, nilai: r.Nilai,
      })),
    };
  const total = (f) => summary.ROUND(rows.reduce((a, r) => a + (Number(r[f]) || 0), 0));
  const list = rows.slice(0, 10).map((r) => ({
    nomor: r.Nomor, tanggal: r.Tanggal,
    ...(jenis === "mutasi" ? { asal: r.Asal, tujuan: r.Tujuan, realisasi: r.Realisasi } : { gudang: r.Gudang, total: summary.ROUND(r.Total) }),
    keterangan: (r.Keterangan || "").slice(0, 60),
  }));
  return {
    laporan: "stok_ops",
    jenis,
    periode: periodeDari(rows, "Tanggal"),
    jumlah_dokumen: rows.length,
    ...(jenis === "mutasi"
      ? { belum_realisasi: rows.filter((r) => String(r.Realisasi) === "Belum").length }
      : { total_nilai: total("Total") }),
    daftar: list,
  };
}

function summarizeHistoryHarga(res) {
  const rows = res.rows || [];
  if (res.tool === "history_harga_jual.detail")
    return {
      laporan: "history_harga_jual", mode: "detail", kode: res.kode, bulan: res.bulan, tahun: res.tahun,
      jumlah_baris: rows.length,
      harga_per_customer: rows.slice(0, 20).map((r) => ({
        customer: r.Customer, harga: r.Harga, disc: r.Disc, kontrak: r.Kontrak,
        harga_net: summary.ROUND(r.HargaNet), salesman: r.Salesman, ppn: r.Status,
      })),
    };
  return {
    laporan: "history_harga_jual", bulan: res.bulan, tahun: res.tahun,
    jumlah_barang_terjual: rows.length,
    barang: rows.slice(0, 15).map((r) => ({ kode: r.Kode, nama: r.Nama, kategori: r.Kategori, merk: r.Merk })),
  };
}

function summarizeStokExpiredDetail(res) {
  const rows = res.rows || [];
  return {
    laporan: "stok_expired", mode: "detail", kode: res.kode,
    jumlah_batch: rows.length,
    total_stok: summary.ROUND(rows.reduce((a, r) => a + (Number(r.stok) || 0), 0)),
    ...(res.isFinance ? { total_nilai: summary.ROUND(rows.reduce((a, r) => a + (Number(r.stok) || 0) * (Number(r.harga_beli) || 0), 0)) } : {}),
    batch: rows.slice(0, 20).map((r) => ({
      expired: r.expired, stok: summary.ROUND(r.stok), ...(res.isFinance ? { harga_beli: summary.ROUND(r.harga_beli) } : {}),
    })),
  };
}

// ── Registri tool ──
module.exports = {
  async exec(id, params, user = {}) {
    const isFinance = aiCfg.isFinanceUser(user);
    // db = pilihan cabang (opsional) — dipakai untuk routing, bukan parameter
    // laporan. Jalankan seluruh pemanggilan service dalam scope cabang tsb.
    const { db: dbKey, ...svcParams } = params || {};
    const runIn = (fn) => branches.branchRun(dbKey, fn);
    switch (id) {
      case "realisasi_penjualan": {
        // Alias nama param (TOOLS/legacy "customer"/"barang") → nama param service.
        const p = { ...svcParams };
        if (p.customer && !p.customerName) p.customerName = p.customer;
        if (p.barang && !p.barangName) p.barangName = p.barang;
        let rows = await runIn(() => listJualPerItemSvc.getBrowse(p, user));
        rows = likeFilter(rows, "Departemen", p.departemen);
        rows = likeFilter(rows, "Kategori", p.kategori);
        rows = likeFilter(rows, "Marketing", p.marketing);
        if (p.eceran) rows = rows.filter((r) => String(r.Eceran || "").toLowerCase() === String(p.eceran).toLowerCase());
        if (p.statusHet) rows = rows.filter((r) => String(r.StatusHet || "").toLowerCase().includes(String(p.statusHet).toLowerCase()));
        if (p.isCatalog) rows = rows.filter((r) => String(r.isCatalog || "").toLowerCase() === String(p.isCatalog).toLowerCase());
        return { tool: id, isFinance, rows };
      }
      case "faktur_outstanding": {
        let rows = await runIn(() => fakturOutstandingSvc.getBrowse(svcParams));
        rows = likeFilter(rows, "Rayon", svcParams.rayon);
        rows = likeFilter(rows, "Salesman", svcParams.salesman);
        // Mode detail: saring hanya faktur yang sudah tua (mis. >120 hari).
        const focus = svcParams.detailFocus;
        if (focus && rows.length) {
          const keep = ["overdue_gt120", "overdue_gt90", "overdue_gt60"].find((f) => f === focus);
          if (keep) {
            const min = Number(keep.split("_")[1].replace("gt", "")) || 0;
            rows = rows.filter(
              (r) => (Number(r.Overdue) || 0) > min || String(r.Range_overdue).trim() === "x > 120",
            );
          }
        }
        return { tool: id, rows, detailFocus: focus };
      }
      case "saldo_piutang": {
        const rows = await runIn(() => saldoPiutangSvc.getBrowse(svcParams));
        return { tool: id, rows };
      }
      case "kartu_stok": {
        if (svcParams.kode) {
          const rows = await runIn(() => kartuStokSvc.getDetail(svcParams));
          return { tool: `${id}.detail`, rows };
        }
        let rows = await runIn(() => kartuStokSvc.getBrowse(svcParams));
        rows = likeFilter(rows, "Nama", svcParams.barang);
        return { tool: id, rows };
      }
      case "inkaso": {
        let rows = await runIn(() =>
          listInkasoSvc.getBrowse({ startDate: svcParams.startDate, endDate: svcParams.endDate }),
        );
        rows = likeFilter(rows, "Customer", svcParams.customer);
        // Nama_Salesman = ORANG (tsalesmanaktif). Kolom "Salesman" lama = rayon.
        rows = likeFilter(rows, "Nama_Salesman", svcParams.salesman);
        return { tool: id, rows };
      }
      case "retur_penjualan": {
        let rows = await runIn(() =>
          returPenjualanSvc.getBrowse(svcParams.startDate, svcParams.endDate),
        );
        rows = likeFilter(rows, "Customer", svcParams.customer);
        return { tool: id, rows };
      }
      case "penjualan_per_faktur": {
        let rows = await runIn(() =>
          listJualPerFakturSvc.getBrowse({ startDate: svcParams.startDate, endDate: svcParams.endDate }),
        );
        rows = likeFilter(rows, "Salesman", svcParams.salesman);
        rows = likeFilter(rows, "Customer", svcParams.customer);
        return { tool: id, rows };
      }
      case "stok_expired": {
        // Mode detail per barang: semua batch expired barang itu (tanpa cutoff).
        if (svcParams.kode) {
          const [rows] = await runIn(() =>
            db.query(
              "SELECT mst_brg_kode kode, brg_nama nama, DATE_FORMAT(mst_expired_date,'%Y-%m-%d') expired, " +
                "IFNULL(SUM(mst_stok_in-mst_stok_out),0) stok, IFNULL(mst_hargabeli,0) harga_beli " +
                "FROM tmasterstok INNER JOIN tbarang ON brg_kode = mst_brg_kode " +
                "WHERE mst_brg_kode = ? AND mst_expired_date > '2000-01-01' AND mst_gdg_kode LIKE ? " +
                "GROUP BY mst_brg_kode, brg_nama, mst_expired_date, mst_hargabeli HAVING stok > 0 " +
                "ORDER BY mst_expired_date",
              [svcParams.kode, `${svcParams.gudang || ""}%`],
            ),
          );
          return { tool: `${id}.detail`, rows: rows || [], isFinance, kode: svcParams.kode };
        }
        const batas =
          svcParams.batasTanggal ||
          new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
        const rows = await runIn(() =>
          stokExpiredSvc.getBrowse({ startDate: batas, gudang: svcParams.gudang }),
        );
        return { tool: id, rows, isFinance, batas };
      }
      case "capaian_sales": {
        const now = new Date();
        const bulan = Number(svcParams.bulan) || now.getMonth() + 1;
        const tahun = Number(svcParams.tahun) || now.getFullYear();
        const dimensi = svcParams.dimensi === "departemen" ? "departemen" : "rayon";
        let rows =
          dimensi === "departemen"
            ? await runIn(() => lapBulanan5Svc.getBrowse({ bulan, tahun, onlySalesman: 1 }))
            : await runIn(() => lapBulanan4Svc.getBrowse({ bulan, tahun }));
        return { tool: id, rows, dimensi, bulan, tahun };
      }
      case "komisi_salesman": {
        const now = new Date();
        const bulan = Number(svcParams.bulan) || now.getMonth() + 1;
        const tahun = Number(svcParams.tahun) || now.getFullYear();
        const res = await runIn(() => komisiSalesmanSvc.getBrowse({ bulan, tahun }));
        return { tool: id, grid1: res.grid1 || [], grid2: res.grid2 || [], bulan, tahun };
      }
      case "omzet_cabang": {
        const list = await branches.listBranches();
        const sysDb = process.env.DB_NAME;
        const q = `SELECT COUNT(*) faktur, IFNULL(ROUND(SUM(fp_amount - IFNULL(fp_freight,0))),0) omzet_kotor,
            IFNULL(ROUND(SUM(fp_amount - IFNULL(fp_freight,0) - fp_taxamount)),0) omzet_blm_ppn_kotor
          FROM tfp_hdr WHERE fp_tanggal BETWEEN ? AND ?`;
        // Retur dipotong pada periode yang sama (bulan retur terjadi). Basis sama
        // dengan KPI dashboard: tanpa ongkir, neto retur.
        const qr = `SELECT IFNULL(ROUND(SUM(retj_amount)),0) retur,
            IFNULL(ROUND(SUM(retj_amount - retj_taxamount)),0) retur_blm_ppn
          FROM tretj_hdr WHERE retj_tanggal BETWEEN ? AND ?`;
        // Target cabang = SUM target rayon (tsalesmantarget) bulan penuh dari startDate.
        const d = new Date(svcParams.startDate || Date.now());
        const qt = `SELECT IFNULL(ROUND(SUM(st_targetsales)),0) target FROM tsalesmantarget WHERE st_tahun = ? AND st_periode = ?`;
        const results = await Promise.all(
          list
            .filter((b) => b.dbase !== sysDb && b.reachable)
            .map(async (b) => {
              try {
                const data = await db.run(b.dbase, async () => {
                  const [r1] = await db.query(q, [svcParams.startDate, svcParams.endDate]);
                  const [r2] = await db.query(qt, [d.getFullYear(), d.getMonth() + 1]);
                  const [r3] = await db.query(qr, [svcParams.startDate, svcParams.endDate]);
                  const retur = Number(r3[0].retur) || 0;
                  // Alias _kotor dibuang di sini; yang diteruskan ke summarizer hanya
                  // field final supaya tidak ada dua "omzet" di satu baris.
                  return {
                    faktur: Number(r1[0].faktur) || 0,
                    omzet: (Number(r1[0].omzet_kotor) || 0) - retur,
                    omzet_blm_ppn: (Number(r1[0].omzet_blm_ppn_kotor) || 0)
                      - (Number(r3[0].retur_blm_ppn) || 0),
                    target: r2[0].target,
                  };
                });
                const omzet = Number(data.omzet) || 0;
                const target = Number(data.target) || 0;
                return {
                  cabang: b.nama, kode: b.kode, ...data,
                  ...(target > 0 ? { capaian_pct: Math.round((omzet / target) * 1000) / 10 } : {}),
                };
              } catch (e) {
                return { cabang: b.nama, kode: b.kode, error: String(e.message).slice(0, 80) };
              }
            }),
        );
        const gagal = list
          .filter((b) => b.dbase !== sysDb && !b.reachable)
          .map((b) => b.nama);
        return { tool: id, rows: results, gagal, periode: `${svcParams.startDate} s.d ${svcParams.endDate}` };
      }
      case "rekap_cabang": {
        const metrik = ["piutang", "inkaso", "stok", "jurnal", "piutang_customer", "omzet_customer", "cn_customer", "biaya_promosi_customer", "fee_marketing_customer"].includes(String(svcParams.metrik || "").toLowerCase())
          ? String(svcParams.metrik).toLowerCase()
          : "piutang";
        const now = new Date();
        const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
        const start = svcParams.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const end = svcParams.endDate || iso(now);
        const today = iso(now);
        // Ranking lintas cabang: per cabang GROUP BY customer (top 50), digabung lalu dirangking.
        const batas = Math.min(Math.max(Number(svcParams.batas) || 10, 1), 50);
        const qPiutangCus = `SELECT c.cus_nama customer, COUNT(*) faktur, IFNULL(ROUND(SUM(FP_AMOUNT-fp_dp-fp_bayar)),0) sisa
          FROM tfp_hdr h INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode
          WHERE (FP_AMOUNT-fp_dp-fp_bayar) > 0
          GROUP BY c.cus_nama ORDER BY sisa DESC LIMIT 50`;
        const qOmzetCus = `SELECT c.cus_nama customer, COUNT(*) faktur, IFNULL(ROUND(SUM(fp_amount)),0) omzet
          FROM tfp_hdr h INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode
          WHERE fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)
          GROUP BY c.cus_nama ORDER BY omzet DESC LIMIT 50`;
        // CN = nilai kontrak header (fp_cn, sama dengan laporan outstanding/Riil); hanya faktur ber-CN.
        const qCnCus = `SELECT c.cus_nama customer, COUNT(*) faktur, IFNULL(ROUND(SUM(h.fp_cn)),0) nilai
          FROM tfp_hdr h INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode
          WHERE h.fp_tanggal BETWEEN ? AND date_add(?, interval 1 day) AND h.fp_cn > 0
          GROUP BY c.cus_nama ORDER BY nilai DESC LIMIT 50`;
        // Biaya promosi per customer — formula header resmi (faktur outstanding).
        const qBpCus = `SELECT c.cus_nama customer, COUNT(*) faktur,
            IFNULL(ROUND(SUM((h.fp_biayapr*(h.fp_amount-h.fp_taxamount)/100)+h.fp_biayarp)),0) nilai
          FROM tfp_hdr h INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode
          WHERE h.fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)
          GROUP BY c.cus_nama ORDER BY nilai DESC LIMIT 50`;
        // Fee marketing per customer — dari detail (fpd_bp_pr2/rp2), tanpa netting retur (pendekatan ranking).
        const qFmCus = `SELECT c.cus_nama customer, COUNT(DISTINCT h.fp_nomor) faktur,
            IFNULL(ROUND(SUM((d.fpd_qty*(((100-d.fpd_discpr)*d.fpd_harga/100)*d.fpd_bp_pr2/100))+(d.fpd_qty*d.fpd_bp_rp2))),0) nilai
          FROM tfp_dtl d INNER JOIN tfp_hdr h ON h.fp_nomor = d.fpd_fp_nomor
          INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode
          WHERE h.fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)
          GROUP BY c.cus_nama ORDER BY nilai DESC LIMIT 50`;
        const qPiutang = `SELECT COUNT(*) faktur, IFNULL(ROUND(SUM(FP_AMOUNT-fp_dp-fp_bayar)),0) sisa,
            SUM(CASE WHEN fp_jthtempo < ? THEN 1 ELSE 0 END) overdue120_faktur,
            IFNULL(ROUND(SUM(CASE WHEN fp_jthtempo < ? THEN FP_AMOUNT-fp_dp-fp_bayar ELSE 0 END)),0) overdue120_nilai
          FROM tfp_hdr WHERE (FP_AMOUNT-fp_dp-fp_bayar) > 0`;
        const qInkaso = `SELECT COUNT(DISTINCT h.byc_nomor) dokumen, IFNULL(ROUND(SUM(d.bycd_bayar)),0) total
          FROM tbayarcus_hdr h INNER JOIN tbayarcus_dtl d ON d.bycd_byc_nomor = h.byc_nomor
          WHERE h.byc_tanggal BETWEEN ? AND date_add(?, interval 1 day)`;
        const qStok = `SELECT (SELECT IFNULL(ROUND(SUM(brg_stok*brg_lastcost)),0) FROM tbarang WHERE brg_isaktif=1) nilai,
            (SELECT COUNT(*) FROM tbarang WHERE brg_isaktif=1 AND brg_MIN_STOK > 0 AND brg_stok <= brg_MIN_STOK) kritis,
            (SELECT COUNT(*) FROM tbarang WHERE brg_isaktif=1 AND brg_stok < 0) negatif`;
        // akun opsional — LIKE pada nama/kode akun/kelompok (mis. 'ENTERTAIN', 'BIAYA', 'PENDAPATAN').
        const akun = String(svcParams.akun || "").trim();
        const akunClause = akun
          ? ` AND (AccountName LIKE ? OR Account LIKE ? OR Kelompok LIKE ?)`
          : "";
        const qJurnal = `SELECT COUNT(*) baris, IFNULL(ROUND(SUM(Debet)),0) debet, IFNULL(ROUND(SUM(Kredit)),0) kredit
          FROM alljurnal WHERE Tanggal BETWEEN ? AND date_add(?, interval 1 day)${akunClause}`;
        const jurnalParams = akun
          ? [start, end, `%${akun}%`, `%${akun}%`, `%${akun}%`]
          : [start, end];
        const list = await branches.listBranches();
        const sysDb = process.env.DB_NAME;
        const results = await Promise.all(
          list
            .filter((b) => b.dbase !== sysDb && b.reachable)
            .map(async (b) => {
              try {
                const data = await db.run(b.dbase, async () => {
                  if (metrik === "piutang") {
                    const [r] = await db.query(qPiutang, [today, today]);
                    return r[0];
                  }
                  if (metrik === "inkaso") {
                    const [r] = await db.query(qInkaso, [start, end]);
                    return r[0];
                  }
                  if (metrik === "jurnal") {
                    const [r] = await db.query(qJurnal, jurnalParams);
                    return r[0];
                  }
                  if (metrik === "piutang_customer") {
                    const [r] = await db.query(qPiutangCus, []);
                    return r;
                  }
                  if (metrik === "omzet_customer") {
                    const [r] = await db.query(qOmzetCus, [start, end]);
                    return r;
                  }
                  if (metrik === "cn_customer") {
                    const [r] = await db.query(qCnCus, [start, end]);
                    return r;
                  }
                  if (metrik === "biaya_promosi_customer") {
                    const [r] = await db.query(qBpCus, [start, end]);
                    return r;
                  }
                  if (metrik === "fee_marketing_customer") {
                    const [r] = await db.query(qFmCus, [start, end]);
                    return r;
                  }
                  const [r] = await db.query(qStok, []);
                  return r[0];
                });
                return { cabang: b.nama, kode: b.kode, ...(metrik === "jurnal" && akun ? { akun } : {}), ...(Array.isArray(data) ? { data } : data) };
              } catch (e) {
                return { cabang: b.nama, kode: b.kode, error: String(e.message).slice(0, 80) };
              }
            }),
        );
        const gagal = list
          .filter((b) => b.dbase !== sysDb && !b.reachable)
          .map((b) => b.nama);
        if (metrik === "piutang_customer" || metrik === "omzet_customer" || metrik === "cn_customer" || metrik === "biaya_promosi_customer" || metrik === "fee_marketing_customer") {
          // Gabung antar cabang: customer sama dijumlah, atribusi nama cabang dipertahankan.
          const valKey = {
            piutang_customer: "sisa",
            omzet_customer: "omzet",
            cn_customer: "nilai",
            biaya_promosi_customer: "nilai",
            fee_marketing_customer: "nilai",
          }[metrik];
          const merged = new Map();
          for (const bres of results) {
            for (const r of Array.isArray(bres.data) ? bres.data : []) {
              const k = String(r.customer || "-").toLowerCase();
              const e = merged.get(k) || { nama: r.customer, nilai: 0, faktur: 0, cabang: [] };
              e.nilai += Number(r[valKey]) || 0;
              e.faktur += Number(r.faktur) || 0;
              if (!e.cabang.includes(bres.cabang)) e.cabang.push(bres.cabang);
              merged.set(k, e);
            }
          }
          const top = [...merged.values()]
            .sort((a, b) => b.nilai - a.nilai)
            .slice(0, batas)
            .map((e, i) => ({ rank: i + 1, nama: e.nama, nilai: summary.ROUND(e.nilai), faktur: e.faktur, cabang: e.cabang }));
          return {
            tool: id,
            metrik,
            batas,
            periode: metrik === "piutang_customer" ? `per ${today}` : `${start} s.d ${end}`,
            gagal,
            jumlah_customer: merged.size,
            total_all: summary.ROUND([...merged.values()].reduce((a, e) => a + e.nilai, 0)),
            rows: top,
          };
        }
        const periode = metrik === "stok" || metrik === "piutang" ? `per ${today}` : `${start} s.d ${end}`;
        return { tool: id, metrik, rows: results, gagal, periode, ...(metrik === "jurnal" ? { akun } : {}) };
      }
      case "jurnal": {
        let rows = await runIn(() =>
          listJurnalSvc.getListJurnal(svcParams.startDate, svcParams.endDate),
        );
        if (svcParams.akun) {
          const q = String(svcParams.akun).toLowerCase();
          rows = rows.filter((r) =>
            [r.AccountName, r.Kelompok, r.Account].some((v) => String(v ?? "").toLowerCase().includes(q)),
          );
        }
        rows = likeFilter(rows, "Customer", svcParams.customer);
        return { tool: id, rows };
      }
      case "buku_bank": {
        const rr = await resolveRekening(svcParams.rekening, runIn);
        if (!rr.rekening)
          return { tool: id, butuh_rekening: true, kandidat: rr.candidates };
        const rows = await runIn(() =>
          bukuBankSvc.getBukuBank(rr.rekening.kode, svcParams.startDate, svcParams.endDate),
        );
        return { tool: id, rekening: rr.rekening, rows };
      }
      case "kas_harian": {
        const rr = await resolveRekening(svcParams.rekening, runIn);
        if (!rr.rekening)
          return { tool: id, butuh_rekening: true, kandidat: rr.candidates };
        const tanggal = svcParams.tanggal || new Date().toISOString().slice(0, 10);
        const rows = await runIn(() => kasHarianSvc.getKasHarian(rr.rekening.kode, tanggal));
        return { tool: id, rekening: rr.rekening, tanggal, rows };
      }
      case "stok_analisis": {
        const now = new Date();
        const startDate = svcParams.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const endDate = svcParams.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const ambang = Number(svcParams.ambangKeluar ?? 0);
        // Jumlah item per bagian — agar 'urutan ke N'/'top N' terjawab dari snapshot, bukan ingatan.
        const batas = Math.min(Math.max(Number(svcParams.batas) || 15, 1), 50);
        const rows = await runIn(() =>
          kartuStokSvc.getBrowse({ startDate, endDate, gudang: svcParams.gudang }),
        );
        // Sort deterministik: nilai utama desc, tie-break nama (hasil eksekasi ulang identik).
        const byStok = (a, b) => (Number(b._Akhir) || 0) - (Number(a._Akhir) || 0) || String(a.Nama).localeCompare(String(b.Nama));
        const byOut = (a, b) => (Number(b._Out) || 0) - (Number(a._Out) || 0) || String(a.Nama).localeCompare(String(b.Nama));
        const slowMoving = rows.filter((r) => (Number(r._Akhir) || 0) > 0 && (Number(r._Out) || 0) <= ambang).sort(byStok);
        const habis = rows
          .filter((r) => (Number(r._Akhir) || 0) <= 0 && (Number(r._In) || 0) + (Number(r._Out) || 0) > 0)
          .sort(byOut);
        const [oos] = await runIn(() =>
          db.query(
            "SELECT brg_kode, brg_nama, brg_stok, brg_MIN_STOK FROM tbarang WHERE brg_isaktif = 1 AND brg_stok <= 0 ORDER BY brg_stok ASC, brg_nama ASC LIMIT 200",
          ),
        );
        const [[oosCount]] = await runIn(() =>
          db.query("SELECT COUNT(*) c FROM tbarang WHERE brg_isaktif = 1 AND brg_stok <= 0"),
        );
        const [jual] = await runIn(() =>
          db.query(
            "SELECT DISTINCT d.fpd_brg_kode kode FROM tfp_dtl d INNER JOIN tfp_hdr h ON h.fp_nomor = d.fpd_fp_nomor WHERE h.fp_tanggal BETWEEN ? AND ? AND d.fpd_qty > 0",
            [startDate, endDate],
          ),
        );
        const jualSet = new Set((jual || []).map((r) => String(r.kode)));
        const oosList = (oos || []).map((r) => ({
          ...r,
          ...(jualSet.has(String(r.brg_kode)) ? { pernah_jual_periode: true } : {}),
        }));
        return { tool: id, slowMoving, habis, oos: oosList, oosTotal: Number(oosCount?.c) || (oosList || []).length, ambang, batas, periode: { startDate, endDate } };
      }
      case "kunjungan": {
        const [rows0] = await runIn(() =>
          db.query(
            "SELECT z.user salesman, z.keperluan, z.cus_kode, c.Cus_nama outlet, DATE_FORMAT(z.tanggal,'%Y-%m-%d') tanggal " +
              "FROM zkunjungan z LEFT JOIN tcustomer c ON c.cus_kode = z.cus_kode " +
              "WHERE z.tanggal BETWEEN ? AND date_add(?, interval 1 day)",
            [svcParams.startDate, svcParams.endDate],
          ),
        );
        let rows = rows0 || [];
        rows = likeFilter(rows, "salesman", svcParams.salesman);
        rows = likeFilter(rows, "outlet", svcParams.outlet);
        if (svcParams.keperluan)
          rows = rows.filter((r) => String(r.keperluan ?? "").toLowerCase().includes(String(svcParams.keperluan).toLowerCase()));
        return { tool: id, rows, periode: `${svcParams.startDate} s.d ${svcParams.endDate}` };
      }
      case "piutang_masuk": {
        const now = new Date();
        const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const start = svcParams.startDate || iso(now);
        const end = svcParams.endDate || iso(new Date(now.getTime() + 30 * 86400_000));
        const [jt] = await runIn(() =>
          db.query(
            "SELECT DATE_FORMAT(jt_tanggaljt,'%Y-%m-%d') tanggal, jt_fp_nomor nomor, jt_nilai, cus_nama customer " +
              "FROM tjatuhtempofp INNER JOIN tfp_hdr ON fp_nomor = jt_fp_nomor INNER JOIN tcustomer ON cus_kode = fp_cus_kode " +
              "WHERE jt_tanggaljt BETWEEN ? AND date_add(?, interval 1 day) AND fp_amount > fp_bayar ORDER BY jt_tanggaljt",
            [start, end],
          ),
        );
        const [giro] = await runIn(() =>
          db.query(
            "SELECT h.byc_nomor nomor, DATE_FORMAT(h.byc_tanggal,'%Y-%m-%d') tanggal_terima, h.byc_nogiro giro, " +
              "IFNULL(SUM(d.bycd_bayar),0) nilai " +
              "FROM tbayarcus_hdr h INNER JOIN tbayarcus_dtl d ON d.bycd_byc_nomor = h.byc_nomor " +
              "LEFT JOIN tpencairangiro pg ON pg.cg_gironumber = h.byc_nogiro " +
              "WHERE h.byc_nogiro <> '' AND pg.cg_tanggalcair IS NULL " +
              "GROUP BY h.byc_nomor, h.byc_tanggal, h.byc_nogiro ORDER BY h.byc_tanggal LIMIT 200",
          ),
        );
        return { tool: id, jatuhTempo: jt || [], giroBelumCair: giro || [], periode: `${start} s.d ${end}` };
      }
      case "do_realisasi": {
        let rows = await runIn(() =>
          doRealisasiSvc.getBrowse({ startDate: svcParams.startDate, endDate: svcParams.endDate }),
        );
        if (svcParams.status)
          rows = rows.filter((r) => String(r.Status || "").toLowerCase().includes(String(svcParams.status).toLowerCase()));
        return { tool: id, rows };
      }
      case "faktur_margin": {
        let rows = await runIn(() =>
          listJualPerFakturMarginSvc.getBrowse({ startDate: svcParams.startDate, endDate: svcParams.endDate }),
        );
        rows = likeFilter(rows, "Salesman", svcParams.salesman);
        rows = likeFilter(rows, "Customer", svcParams.customer);
        return { tool: id, rows, isFinance };
      }
      case "pb_outstanding": {
        if (svcParams.kode) {
          const rows = await runIn(() => barangRealisasiSvc.getDetail({ kode: svcParams.kode }));
          return { tool: `${id}.detail`, rows };
        }
        let rows = await runIn(() => barangRealisasiSvc.getBrowse());
        rows = likeFilter(rows, "NamaBarang", svcParams.barang);
        return { tool: id, rows };
      }
      case "transaksi_piutang": {
        // Service hanya bisa filter kodenya (prefix). Nama customer → post-filter (pola inkaso).
        const rows0 = await runIn(() =>
          transaksiHarianSvc.getBrowse({ startDate: svcParams.startDate, endDate: svcParams.endDate }),
        );
        let rows = rows0;
        if (svcParams.customer) {
          const q = String(svcParams.customer).toLowerCase();
          rows = rows.filter(
            (r) =>
              String(r.Nama || "").toLowerCase().includes(q) ||
              String(r.Customer || "").toLowerCase().includes(q),
          );
        }
        return { tool: id, rows };
      }
      case "faktur_pajak": {
        const rows = await runIn(() =>
          fakturPajakSvc.getBrowse(svcParams.startDate, svcParams.endDate),
        );
        return { tool: id, rows };
      }
      case "pencairan_giro": {
        const rows = await runIn(() =>
          pencairanGiroSvc.getBrowse(svcParams.startDate, svcParams.endDate),
        );
        return { tool: id, rows };
      }
      case "klaim": {
        const jenis = String(svcParams.jenis || "bp").toLowerCase() === "fm" ? "fm" : "bp";
        const rows = await runIn(() =>
          (jenis === "fm" ? bayarFmSvc : bayarBpSvc).getBrowse(svcParams.startDate, svcParams.endDate),
        );
        return { tool: id, jenis, rows };
      }
      case "tagihan_ekspedisi": {
        // Rekap biaya ekspedisi per faktur (header tagihan tidak memuat nilai).
        const [rows] = await runIn(() =>
          db.query(
            "SELECT d.tehd_fp_nomor nomor, COALESCE(c.cus_nama, d.tehd_cus_nama) customer, " +
              "DATE_FORMAT(MAX(COALESCE(f.fp_tanggal, d.tehd_tanggal)),'%Y-%m-%d') tanggal, " +
              "IFNULL(ROUND(SUM(d.tehd_biaya)),0) biaya " +
              "FROM ttagihanekspedisi_dtl d INNER JOIN ttagihanekspedisi_hdr h ON h.teh_nomor = d.tehd_teh_nomor " +
              "LEFT JOIN tfp_hdr f ON f.fp_nomor = d.tehd_fp_nomor LEFT JOIN tcustomer c ON c.cus_kode = f.fp_cus_kode " +
              "WHERE h.teh_tanggal BETWEEN ? AND date_add(?, interval 1 day) " +
              "GROUP BY d.tehd_fp_nomor, COALESCE(c.cus_nama, d.tehd_cus_nama) ORDER BY biaya DESC LIMIT 200",
            [svcParams.startDate, svcParams.endDate],
          ),
        );
        return { tool: id, rows: rows || [] };
      }
      case "detail_dokumen": {
        const jenis = ["faktur", "do", "so", "retur", "pajak"].includes(String(svcParams.jenis || "").toLowerCase())
          ? String(svcParams.jenis).toLowerCase()
          : "faktur";
        const nomor = String(svcParams.nomor || "").trim();
        if (!nomor) throw new Error("nomor dokumen wajib diisi.");
        const headerQ = {
          faktur:
            "SELECT h.fp_nomor nomor, DATE_FORMAT(h.fp_tanggal,'%Y-%m-%d') tanggal, DATE_FORMAT(h.fp_jthtempo,'%Y-%m-%d') jth_tempo, " +
            "c.cus_nama customer, h.fp_amount total, h.fp_dp dp, h.fp_bayar bayar FROM tfp_hdr h " +
            "INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_Kode WHERE h.fp_nomor = ?",
          do:
            "SELECT h.do_nomor nomor, DATE_FORMAT(h.do_tanggal,'%Y-%m-%d') tanggal, c.cus_nama customer, h.do_so_nomor so_nomor " +
            "FROM tdo_hdr h LEFT JOIN tso_hdr so ON so.so_nomor = h.do_so_nomor " +
            "INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode WHERE h.do_nomor = ?",
          so:
            "SELECT h.so_nomor nomor, DATE_FORMAT(h.so_tanggal,'%Y-%m-%d') tanggal, c.cus_nama customer " +
            "FROM tso_hdr h INNER JOIN tcustomer c ON c.cus_kode = h.so_cus_kode WHERE h.so_nomor = ?",
          retur:
            "SELECT h.retj_nomor nomor, DATE_FORMAT(h.retj_tanggal,'%Y-%m-%d') tanggal, c.cus_nama customer, " +
            "h.retj_amount total, h.retj_fp_nomor faktur FROM tretj_hdr h INNER JOIN tfp_hdr f ON f.fp_nomor = h.retj_fp_nomor " +
            "INNER JOIN tcustomer c ON c.cus_kode = f.fp_cus_kode WHERE h.retj_nomor = ?",
          pajak:
            "SELECT h.fp_nomor nomor, IFNULL(h.fp_fakturpajak,'') nomor_pajak, DATE_FORMAT(h.fp_tanggalpajak,'%Y-%m-%d') tgl_pajak, " +
            "c.cus_nama customer, h.fp_amount total, h.fp_taxamount ppn FROM tfakturpajak_hdr h " +
            "INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode WHERE h.fp_nomor = ?",
        }[jenis];
        const detailFn = {
          faktur: () => fpSvc.getBrowseDetail(nomor),
          do: () => doSvc.getBrowseDetail(nomor),
          so: () => soSvc.getBrowseDetail(nomor),
          retur: () => returPenjualanSvc.getBrowseDetail(nomor),
          pajak: () => fakturPajakSvc.getBrowseDetail(nomor),
        }[jenis];
        const [headerRows, items] = await runIn(async () => {
          const [h] = await db.query(headerQ, [nomor]);
          const it = await detailFn();
          return [h, it];
        });
        return { tool: id, jenis, nomor, header: headerRows && headerRows[0] ? headerRows[0] : null, items: items || [] };
      }
      case "stok_ops": {
        const jenis = ["pemusnahan", "penyesuaian", "mutasi"].includes(String(svcParams.jenis || "").toLowerCase())
          ? String(svcParams.jenis).toLowerCase()
          : "pemusnahan";
        const svc = { pemusnahan: pemusnahanSvc, penyesuaian: penyesuaianStokSvc, mutasi: mutasiGudangSvc }[jenis];
        if (svcParams.nomor) {
          const rows = await runIn(() => svc.getBrowseDetail(String(svcParams.nomor).trim()));
          return { tool: `${id}.detail`, jenis, nomor: svcParams.nomor, rows: rows || [] };
        }
        const rows = await runIn(() => svc.getBrowse(svcParams.startDate, svcParams.endDate));
        return { tool: id, jenis, rows: rows || [] };
      }
      case "history_harga_jual": {
        const now = new Date();
        const bulan = Number(svcParams.bulan) || now.getMonth() + 1;
        const tahun = Number(svcParams.tahun) || now.getFullYear();
        if (svcParams.kode) {
          const rows = await runIn(() => historyHargaJualSvc.getDetail({ bulan, tahun, kode: String(svcParams.kode).trim() }));
          return { tool: `${id}.detail`, bulan, tahun, kode: svcParams.kode, rows: rows || [] };
        }
        const rows = await runIn(() => historyHargaJualSvc.getBrowse({ bulan, tahun }));
        return { tool: id, bulan, tahun, rows: rows || [] };
      }
      case "dashboard_summary": {
        const snap = await runIn(() => dashboardSvc.getSummary(user));
        return { tool: id, isFinance, snap };
      }
      case "cari_master": {
        const jenis = String(svcParams.jenis || "").toLowerCase();
        const kw = String(svcParams.keyword || "").trim();
        if (!["customer", "barang", "salesman", "rekening", "supplier"].includes(jenis))
          throw new Error("jenis harus 'customer', 'barang', 'salesman', 'rekening', atau 'supplier'.");
        if (kw.length < 2) throw new Error("keyword minimal 2 karakter.");
        const like = `%${kw}%`;
        let rows;
        if (jenis === "customer")
          [rows] = await runIn(() =>
            db.query(
              "SELECT Cus_kode kode, Cus_nama nama FROM tcustomer WHERE Cus_kode LIKE ? OR Cus_nama LIKE ? ORDER BY Cus_nama LIMIT 10",
              [like, like],
            ),
          );
        else if (jenis === "barang")
          [rows] = await runIn(() =>
            db.query(
              "SELECT brg_kode kode, brg_nama nama FROM tbarang WHERE brg_isaktif = 1 AND (brg_kode LIKE ? OR brg_nama LIKE ?) ORDER BY brg_nama LIMIT 10",
              [like, like],
            ),
          );
        else if (jenis === "rekening")
          [rows] = await runIn(() =>
            db.query(
              "SELECT rek_kode kode, rek_nama nama FROM trekening WHERE rek_kode LIKE ? OR rek_nama LIKE ? ORDER BY rek_kode LIMIT 10",
              [like, like],
            ),
          );
        else if (jenis === "supplier")
          [rows] = await runIn(() =>
            db.query(
              "SELECT sup_kode kode, sup_nama nama FROM tsupplier WHERE sup_kode LIKE ? OR sup_nama LIKE ? ORDER BY sup_nama LIMIT 10",
              [like, like],
            ),
          );
        else
          [rows] = await runIn(() =>
            db.query(
              "SELECT sla_kode kode, sla_nama nama FROM tsalesmanaktif WHERE sla_kode LIKE ? OR sla_nama LIKE ? ORDER BY sla_nama LIMIT 10",
              [like, like],
            ),
          );
        return { tool: id, jenis, rows: rows || [] };
      }
      default:
        throw new Error(`Tool tidak dikenal: ${id}`);
    }
  },

  summarize(res) {
    switch (res.tool) {
      case "realisasi_penjualan": return summarizePenjualan(res.rows, res.isFinance);
      case "faktur_outstanding": return summarizeOutstanding(res.rows, res.detailFocus);
      case "saldo_piutang": return summarizeSaldoPiutang(res.rows);
      case "kartu_stok": return summarizeKartuStok(res.rows);
      case "kartu_stok.detail": return summarizeStokDetail(res.rows, res.kode);
      case "dashboard_summary": return summarizeDashboard(res.snap);
      case "cari_master": return summarizeCariMaster(res);
      case "inkaso": return summarizeInkaso(res.rows);
      case "retur_penjualan": return summarizeRetur(res.rows);
      case "penjualan_per_faktur": return summarizePenjualanPerFaktur(res.rows);
      case "stok_expired": return summarizeStokExpired(res.rows, res.isFinance);
      case "stok_expired.detail": return summarizeStokExpiredDetail(res);
      case "stok_ops": case "stok_ops.detail": return summarizeStokOps(res);
      case "history_harga_jual": case "history_harga_jual.detail": return summarizeHistoryHarga(res);
      case "capaian_sales": return summarizeCapaian(res);
      case "komisi_salesman": return summarizeKomisi(res);
      case "omzet_cabang": return summarizeOmzetCabang(res);
      case "rekap_cabang": return summarizeRekapCabang(res);
      case "jurnal": return summarizeJurnal(res.rows);
      case "buku_bank": return summarizeBukuBank(res);
      case "kas_harian": return summarizeKasHarian(res);
      case "stok_analisis": return summarizeStokAnalisis(res);
      case "kunjungan": return summarizeKunjungan(res);
      case "piutang_masuk": return summarizePiutangMasuk(res);
      case "do_realisasi": return summarizeDoRealisasi(res);
      case "faktur_margin": return summarizeFakturMargin(res);
      case "pb_outstanding": case "pb_outstanding.detail": return summarizePbOutstanding(res);
      case "transaksi_piutang": return summarizeTransaksiPiutang(res.rows);
      case "faktur_pajak": return summarizeFakturPajak(res.rows);
      case "pencairan_giro": return summarizePencairanGiro(res.rows);
      case "klaim": return summarizeKlaim(res);
      case "tagihan_ekspedisi": return summarizeTagihanEkspedisi(res.rows);
      case "detail_dokumen": return summarizeDetailDokumen(res);
      default: throw new Error(`Summarizer tidak dikenal: ${res.tool}`);
    }
  },
};