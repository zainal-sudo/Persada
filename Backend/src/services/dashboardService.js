// services/dashboardService.js
// Dashboard krm (rombak total — versi garmen tidak relevan dan dihapus).
// Sumber data: tfp_hdr (penjualan), faktur outstanding service (piutang),
// tkartupiutang (inkaso — dulu kartu_piutang view, rusak & filter 'CR%' salah),
// tbarang (stok). Semua query scope database cabang via ALS (atau branchRun).
const db = require("../config/database");
const aiCfg = require("../config/ai");
const branches = require("./ai/branches");
const fakturOutstandingSvc = require("./laporan/listFakturOutstandingService");
const listJualPerItemSvc = require("./penjualan/listJualPerItemService");
const { ROUND } = require("./ai/summarizer");

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Evaluasi ekspresi margin/hpp (string "a-b") — pola sama dengan tools.js.
function evalExpr(expr) {
  const toks = String(expr).replace(/\s+/g, "").match(/-?\d+(\.\d+)?|[+\-*/()]/g) || [];
  const ops = [];
  const out = [];
  const apply = () => {
    const op = ops.pop();
    const b = out.pop();
    const a = out.pop();
    out.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);
  };
  for (const t of toks) {
    if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") apply();
      ops.pop();
    } else if ("+-*/".includes(t)) {
      while (ops.length && ops[ops.length - 1] !== "(" && "*/".includes(ops[ops.length - 1]) && !"+-".includes(t)) apply();
      ops.push(t);
    } else out.push(Number(t));
  }
  while (ops.length) apply();
  return out[0] || 0;
}

function topBy(rows, key, limit, isFinance) {
  const map = new Map();
  for (const r of rows) {
    const k = r[key] || "-";
    if (!map.has(k)) map.set(k, { nama: k, qty: 0, nilai: 0, marginExpr: [] });
    const e = map.get(k);
    e.qty += Number(r.Qty) || 0;
    e.nilai += Number(r.Nilai) || 0;
    if (isFinance && r.margin !== undefined) e.marginExpr.push(String(r.margin));
  }
  return [...map.entries()]
    .map(([nama, v]) => {
      const o = { nama, qty: ROUND(v.qty), nilai: ROUND(v.nilai) };
      if (isFinance) o.margin = ROUND(v.marginExpr.reduce((a, x) => a + evalExpr(x), 0));
      return o;
    })
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, limit);
}

// Komposisi omzet per dimensi (nama kolom list jual). Top N + gabungan
// sisanya sebagai "Lainnya" supaya pie chart tetap terbaca.
function komposisi(rows, key, limit = 6) {
  const map = new Map();
  for (const r of rows) {
    const k = (r[key] || "").trim() || "-";
    map.set(k, (map.get(k) || 0) + (Number(r.Nilai) || 0));
  }
  const list = [...map.entries()].map(([nama, nilai]) => ({ nama, nilai: ROUND(nilai) })).sort((a, b) => b.nilai - a.nilai);
  if (list.length <= limit) return list;
  const top = list.slice(0, limit);
  top.push({ nama: "Lainnya", nilai: ROUND(list.slice(limit).reduce((a, x) => a + x.nilai, 0)) });
  return top;
}

// tanggal = posisi acuan "YYYY-MM-DD". Kosong = hari ini (dipakai tool AI).
// Divalidasi di dashboardController, jadi string di sini sudah lolos cek format.
const getSummary = async (user = {}, dbKey = "", tanggal = "") =>
  branches.branchRun(dbKey, async () => {
    const isFinance = aiCfg.isFinanceUser(user);
    // Dipecah manual, bukan new Date("YYYY-MM-DD"): string itu di-parse sebagai UTC
    // lalu digeser ke zona lokal, sehingga bisa meleset satu hari.
    const asOf = tanggal || fmt(new Date());
    const [y, month] = asOf.split("-").map(Number);
    const m = month - 1; // 0-based, sama seperti getMonth()
    const monthStart = (off = 0) => fmt(new Date(y, m - off, 1));
    // Label cabang = database yang benar-benar di-query (bisa beda dari login).
    let labelCabang = user.cabangNama || user.cabang || "-";
    try {
      const list = await branches.listBranches();
      const cur = list.find((b) => b.dbase === db.getCurrentDatabase());
      if (cur) labelCabang = cur.nama;
    } catch {
      /* label login saja */
    }

    // ── Penjualan: 6 bulan s/d tanggal posisi (sumber MoM & grafik) ──
    // Omzet = SUM(fp_amount - fp_freight) dikurangi SUM(retj_amount) pada periode
    // yang sama: nilai setelah diskon + PPN, tanpa ongkir, neto retur. Basis ini
    // sama dengan kolom Nilai pada List Jual Per Item, jadi KPI dan Top 5 bisa
    // dibandingkan. Batas atas wajib: tanpa itu seri bulan posisi ikut menghitung
    // faktur setelah tanggal yang dipilih.
    const [seriesRows] = await db.query(
      "SELECT DATE_FORMAT(fp_tanggal, '%Y-%m') bulan," +
        " IFNULL(SUM(fp_amount - IFNULL(fp_freight, 0)), 0) omzet_kotor," +
        " IFNULL(SUM(fp_amount - fp_taxamount), 0) omzet_ppn, COUNT(*) faktur" +
        " FROM tfp_hdr WHERE fp_tanggal >= ? AND fp_tanggal <= ?" +
        " GROUP BY DATE_FORMAT(fp_tanggal, '%Y-%m')",
      [monthStart(5), asOf],
    );
    const [returSeriesRows] = await db.query(
      "SELECT DATE_FORMAT(retj_tanggal, '%Y-%m') bulan, IFNULL(SUM(retj_amount), 0) retur" +
        " FROM tretj_hdr WHERE retj_tanggal >= ? AND retj_tanggal <= ?" +
        " GROUP BY DATE_FORMAT(retj_tanggal, '%Y-%m')",
      [monthStart(5), asOf],
    );
    const seriesMap = new Map(seriesRows.map((r) => [r.bulan, r]));
    const returMap = new Map(returSeriesRows.map((r) => [r.bulan, Number(r.retur) || 0]));
    const series6 = [];
    for (let off = 5; off >= 0; off--) {
      const d = new Date(y, m - off, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const r = seriesMap.get(key);
      series6.push({
        bulan: key,
        omzet: ROUND((Number(r?.omzet_kotor) || 0) - (returMap.get(key) || 0)),
        // Omzet SEBELUM PPN. Sengaja dibiarkan pada basis lama (belum netting
        // retur, masih termasuk ongkir): tidak dipakai FE, hanya dibaca AI
        // summarizeDashboard. Ubah bersamaan saat basis AI dirapikan.
        omzetPpn: ROUND(r?.omzet_ppn || 0),
        faktur: Number(r?.faktur || 0),
      });
    }
    const cur = series6[series6.length - 1];
    const prev = series6[series6.length - 2] || { omzet: 0, faktur: 0 };
    // Omzet per tanggal posisi, satu hari. Basis sama dengan series6: tanpa
    // ongkir, dikurangi retur tanggal tersebut.
    const [[onDateRow]] = await db.query(
      "SELECT IFNULL(SUM(fp_amount - IFNULL(fp_freight, 0)), 0) omzet, COUNT(*) faktur FROM tfp_hdr WHERE fp_tanggal = ?",
      [asOf],
    );
    const [[onDateReturRow]] = await db.query(
      "SELECT IFNULL(SUM(retj_amount), 0) total FROM tretj_hdr WHERE retj_tanggal = ?",
      [asOf],
    );

    // ── Piutang outstanding (as-of tanggal posisi) ──
    // ponytail: outstandingSvc memakai fp_bayar saat ini, bukan akumulasi kartu_piutang
    // per tanggal, jadi posisi untuk tanggal lama sudah memotong pembayaran yang masuk
    // sesudah tanggal itu. FE melabelinya "faktur s/d <tanggal>" karena itu.
    // Posisi historis presisi: join kartu_piutang per faktur, s/d asOf.
    const outstanding = await fakturOutstandingSvc.getBrowse({ startDate: asOf, endDate: asOf });
    let totalSisa = 0;
    const gt120 = { count: 0, total: 0 };
    const buckets = { belum: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, gt120: 0 };
    const perCus = new Map();
    for (const r of outstanding) {
      const sisa = Number(r.Sisa_piutang) || 0;
      totalSisa += sisa;
      const range = String(r.Range_overdue ?? "").trim();
      // bucket total = sisa piutang pada rentang tsb
      if (range === "Belum") buckets.belum += sisa;
      else if (range === "0 sd 30") buckets.d1_30 += sisa;
      else if (range === "31 s/d 60") buckets.d31_60 += sisa;
      else if (range === "61 s/d 90") buckets.d61_90 += sisa;
      else if (range === "91 s/d 120") buckets.d91_120 += sisa;
      else buckets.gt120 += sisa;
      if (range === "x > 120") {
        gt120.count += 1;
        gt120.total += sisa;
      }
      if ((Number(r.Overdue) || 0) > 0) {
        const k = r.Customer || "-";
        perCus.set(k, (perCus.get(k) || 0) + sisa);
      }
    }
    const topOverdueEntry = [...perCus.entries()].sort((a, b2) => b2[1] - a[1])[0];

    // ── Inkaso & retur bulan berjalan (s/d tanggal posisi) ──
    const [[inkasoRow]] = await db.query(
      "SELECT COUNT(*) c, IFNULL(SUM(kp_kredit - kp_debit), 0) total FROM tkartupiutang" +
        " WHERE kp_src LIKE 'CR|%' AND kp_tanggal BETWEEN ? AND ?",
      [monthStart(0), asOf],
    );
    const [[returRow]] = await db.query(
      "SELECT COUNT(*) c, IFNULL(SUM(retj_amount), 0) total FROM tretj_hdr WHERE retj_tanggal BETWEEN ? AND ?",
      [monthStart(0), asOf],
    );

    // ── Top customer / item / kategori / area / salesman (reuse list jual) ──
    let topCustomer = [];
    let topItem = [];
    let kategoriKomposisi = [];
    let areaKomposisi = [];
    let salesmanKomposisi = [];
    try {
      const jualRows = await listJualPerItemSvc.getBrowse({ startDate: monthStart(0), endDate: asOf }, user);
      topCustomer = topBy(jualRows, "Outlet", 5, isFinance);
      topItem = topBy(jualRows, "Nama", 5, isFinance);
      kategoriKomposisi = komposisi(jualRows, "Kategori", 6);
      areaKomposisi = komposisi(jualRows, "Rayon", 6);
      salesmanKomposisi = komposisi(jualRows, "Salesman", 6);
    } catch {
      /* detail penjualan opsional — dashboard tetap tampil */
    }

    // ── Stok ──
    const [[stokNilaiRow]] = await db.query(
      "SELECT IFNULL(SUM(brg_stok * brg_lastcost), 0) nilai FROM tbarang WHERE brg_isstok = 1 AND brg_isaktif = 1",
    );
    const [[stokNegRow]] = await db.query(
      "SELECT COUNT(*) c FROM tbarang WHERE brg_isstok = 1 AND brg_isaktif = 1 AND brg_stok < 0",
    );
    const [stokKritisRows] = await db.query(
      "SELECT brg_nama nama, brg_stok stok, brg_MIN_STOK minStok FROM tbarang" +
        " WHERE brg_isstok = 1 AND brg_isaktif = 1 AND brg_MIN_STOK > 0 AND brg_stok <= brg_MIN_STOK" +
        " ORDER BY (brg_MIN_STOK - brg_stok) DESC LIMIT 10",
    );
    const [[stokKritisCountRow]] = await db.query(
      "SELECT COUNT(*) c FROM tbarang WHERE brg_isstok = 1 AND brg_isaktif = 1 AND brg_MIN_STOK > 0 AND brg_stok <= brg_MIN_STOK",
    );

    const deltaPct = prev.omzet > 0 ? ROUND(((cur.omzet - prev.omzet) / prev.omzet) * 100) : null;

    return {
      cabang: labelCabang,
      asOfDate: asOf,
      penjualan: {
        omzet: cur.omzet,
        omzetPpn: cur.omzetPpn,
        faktur: cur.faktur,
        omzetPrev: prev.omzet,
        fakturPrev: prev.faktur,
        deltaPct,
        onDate: {
          omzet: ROUND((Number(onDateRow.omzet) || 0) - (Number(onDateReturRow.total) || 0)),
          faktur: Number(onDateRow.faktur),
        },
      },
      series6,
      piutang: {
        totalSisa: ROUND(totalSisa),
        buckets: {
          belum: ROUND(buckets.belum),
          d1_30: ROUND(buckets.d1_30),
          d31_60: ROUND(buckets.d31_60),
          d61_90: ROUND(buckets.d61_90),
          d91_120: ROUND(buckets.d91_120),
          gt120: ROUND(buckets.gt120),
        },
        gt120,
        topOverdue: topOverdueEntry
          ? { customer: topOverdueEntry[0], sisa: ROUND(topOverdueEntry[1]) }
          : null,
      },
      inkaso: { total: ROUND(inkasoRow.total), count: Number(inkasoRow.c) },
      retur: { total: ROUND(returRow.total), count: Number(returRow.c) },
      topCustomer,
      topItem,
      kategori: kategoriKomposisi,
      area: areaKomposisi,
      salesman: salesmanKomposisi,
      stok: {
        nilaiPersediaan: ROUND(stokNilaiRow.nilai),
        kritisCount: Number(stokKritisCountRow.c),
        negatifCount: Number(stokNegRow.c),
        kritisTop: stokKritisRows.map((r) => ({ nama: r.nama, stok: Number(r.stok), min: Number(r.minStok) })),
      },
    };
  });

module.exports = { getSummary };
