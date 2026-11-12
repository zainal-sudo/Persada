// services/ai/eval.golden.js
// Golden questions — uji LIVE perilaku agen (model sungguhan via 9Router).
// Jalankan: npm run eval  (butuh 9Router hidup + koneksi DB)
// Eksekusi tool memakai fixture deterministik; yang diuji: KEPUTUSAN model
// (tool apa + parameter + isi SQL) dan beberapa keyword jawaban.
const db = require("../../config/database");
const { TOOLS } = require("./knowledgeBase");
const agent = require("./agent");

const NOW = new Date();
const Y = NOW.getFullYear();
const M = String(NOW.getMonth() + 1).padStart(2, "0");
const MONTH_START = `${Y}-${M}-01`;
const TODAY = `${Y}-${M}-${String(NOW.getDate()).padStart(2, "0")}`;

const OUTSTANDING_HISTORY = [
  { role: "user", content: "customer mana yang paling banyak nominal dan sudah lewat jatuh tempo?" },
  {
    role: "assistant",
    content: "Peringkat lewat jatuh tempo: YAY. IBU ANAK AGUNG MULIA MEDICAL Rp 950 juta, PT KALI REJO MAKMUR Rp 931 juta, dst. Mau saya uraikan penanggung jawabnya?",
    sources: ["faktur_outstanding"],
  },
];
const STOK_HISTORY = [
  { role: "user", content: "stok barang apa yang paling banyak keluar?" },
  { role: "assistant", content: "Bulan berjalan keluar 5 unit — Glove M. Mau saya cek periode lain?", sources: ["kartu_stok"] },
];
const AUGUST_HISTORY = [
  { role: "user", content: "stok barang apa yang paling banyak keluar bulan ini?" },
  { role: "assistant", content: "Bulan berjalan keluar 5 unit — Glove M. Mau saya cek periode lain?", sources: ["kartu_stok"] },
];

const CASES = [
  {
    id: "penjualan-bulan-ini",
    q: "bagaimana realisasi penjualan bulan ini",
    expect: { tool: "realisasi_penjualan", params: { startDate: MONTH_START, endDate: TODAY } },
  },
  {
    id: "juli-penuh",
    q: "penjualan cabang solo bulan juli",
    expect: { tool: "realisasi_penjualan", params: { startDate: `${Y}-07-01`, endDate: `${Y}-07-31` } },
    answerNot: [/1\s*[-–]\s*20\s*juli/i],
  },
  {
    id: "followup-juli-penuh",
    history: [
      { role: "user", content: "coba penjualan cabang solo bulan agustus" },
      { role: "assistant", content: "Penjualan Solo Agustus Rp 755 juta dari 314 faktur.", sources: ["realisasi_penjualan"] },
    ],
    q: "eh bulan juli deh",
    expect: { tool: "realisasi_penjualan", params: { startDate: `${Y}-07-01`, endDate: `${Y}-07-31` } },
  },
  {
    id: "rentang-eksplisit-dihormati",
    q: "stok 1-20 juli",
    expect: { tool: "kartu_stok", params: { startDate: `${Y}-07-01`, endDate: `${Y}-07-20` } },
  },
  {
    id: "penunggak-overdue",
    q: "customer mana yang piutangnya paling besar dan sudah lewat jatuh tempo?",
    expectAnyTool: ["faktur_outstanding", "sql_readonly"],
  },
  {
    id: "salesman-dari-tsalesmanaktif",
    history: OUTSTANDING_HISTORY,
    q: "itu salesmannya siapa? biar saya push suruh nagih",
    expect: { tool: "sql_readonly", sqlContainsAny: ["tsalesmanaktif", "sla_nama"] },
  },
  {
    id: "briefing",
    q: "bagaimana kondisi bisnis saya hari ini?",
    expect: { tool: "dashboard_summary" },
  },
  {
    id: "lintas-cabang-jogja",
    q: "penjualan cabang jogja bulan ini",
    expect: { tool: "realisasi_penjualan", hasDb: true },
  },
  {
    id: "omzet-salesman-baskara",
    q: "omzet bulan juli 2026 salesman baskara",
    expect: { tool: "realisasi_penjualan" },
    answerNot: [/belum dapat (disajikan|dirinci)/i, /mohon informasikan/i],
  },
  {
    id: "fos-customer",
    q: "FOS customer PT KALI REJO MAKMUR",
    expectAnyTool: ["faktur_outstanding"],
    answerNot: [/belum dapat (disajikan|dirinci)/i],
  },
  {
    id: "saldo-piutang-customer",
    q: "saldo piutang customer PT KALI REJO MAKMUR",
    expectAnyTool: ["saldo_piutang"],
  },
  {
    id: "inkaso-bulan-lalu",
    q: "inkaso bulan juli berapa?",
    expectAnyTool: ["inkaso", "dashboard_summary"],
  },
  {
    id: "retur-bulan-ini",
    q: "retur bulan ini dari customer mana saja?",
    expectAnyTool: ["retur_penjualan", "dashboard_summary"],
  },
  {
    id: "faktur-terbesar",
    q: "faktur penjualan terbesar bulan juli?",
    expectAnyTool: ["penjualan_per_faktur", "realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "stok-expired",
    q: "barang apa saja yang stoknya mau expired bulan depan?",
    expectAnyTool: ["stok_expired", "sql_readonly"],
  },
  {
    id: "capaian-juli",
    q: "capaian sales bulan juli bagaimana?",
    expectAnyTool: ["capaian_sales", "sql_readonly"],
  },
  {
    id: "komisi-bulan-lalu",
    q: "komisi salesman bulan juli berapa?",
    expectAnyTool: ["komisi_salesman", "sql_readonly"],
  },
  {
    id: "growth-juli-agustus",
    q: "growth penjualan juli vs agustus berapa persen?",
    expect: { tool: "realisasi_penjualan", minCalls: 2 },
  },
  {
    id: "pembayaran-terakhir",
    q: "pembayaran terakhir customer RS PANTI RAHAYU PURWODADI kapan?",
    expectAnyTool: ["inkaso", "sql_readonly"],
    answerNot: [/belum dapat memastikan/i, /tidak tercantum/i, /belum dapat disajikan/i, /apakah anda ingin/i, /mau saya (tarik|bantu)/i, /perlu ditarik terlebih dahulu/i],
  },
  {
    id: "pembayaran-salesman-heru",
    q: "baru baru ini customer yang melakukan pembayaran salesmannya heru siapa saja?",
    expectAnyTool: ["inkaso", "sql_readonly"],
    answerNot: [/belum dapat memastikan/i, /apakah anda ingin/i, /mau saya (tarik|bantu)/i, /perlu ditarik terlebih dahulu/i],
  },
  {
    id: "jurnal-biaya",
    q: "biaya bulan juli apa saja yang paling besar?",
    expectAnyTool: ["jurnal", "sql_readonly"],
  },
  {
    id: "pendapatan-jurnal",
    q: "pendapatan bulan juli di jurnal berapa?",
    expectAnyTool: ["jurnal", "sql_readonly"],
  },
  {
    id: "buku-bank",
    q: "buku bank BCA bulan juli?",
    expectAnyTool: ["buku_bank", "sql_readonly"],
  },
  {
    id: "kas-harian",
    q: "kas harian kas besar hari ini?",
    expectAnyTool: ["kas_harian", "sql_readonly"],
  },
  {
    id: "perbandingan-cabang",
    q: "cabang mana yang omzetnya paling besar bulan juli?",
    expectAnyTool: ["omzet_cabang", "realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "omzet-vs-target-all-cabang",
    q: "omzet vs target, persentase pencapaian all cabang bulan september?",
    expect: { tool: "omzet_cabang" },
    answerNot: [/belum dapat (disajikan|dirinci)/i, /tersedia secara rinci per wilayah/i],
  },
  {
    id: "piutang-all-cabang",
    q: "total piutang outstanding semua cabang berapa?",
    expectAnyTool: ["rekap_cabang", "sql_readonly"],
  },
  {
    id: "inkaso-all-cabang",
    q: "inkaso semua cabang bulan juli berapa?",
    expectAnyTool: ["rekap_cabang", "sql_readonly"],
  },
  {
    id: "stok-all-cabang",
    q: "nilai persediaan stok seluruh cabang berapa?",
    expectAnyTool: ["rekap_cabang", "sql_readonly"],
  },
  {
    id: "biaya-entertain-all-cabang",
    q: "biaya entertain all cabang bulan juli?",
    expectAnyTool: ["rekap_cabang", "sql_readonly"],
    answerNot: [/belum dapat (disajikan|dirinci)/i, /apakah anda ingin/i, /mau saya (tarik|bantu)/i],
  },
  {
    id: "pendapatan-bunga-semua-cabang",
    q: "pendapatan bunga semua cabang bulan juli berapa?",
    expectAnyTool: ["rekap_cabang", "sql_readonly"],
  },
  {
    id: "top-piutang-all-cabang",
    q: "top 10 piutang terbesar by customer all cabang",
    expect: { tool: "rekap_cabang" },
    answerNot: [/untuk cabang Solo, berikut/i, /belum dapat/i],
  },
  {
    id: "top-omzet-customer-all-cabang",
    q: "top 10 customer omzet semua cabang bulan juli?",
    expect: { tool: "rekap_cabang" },
  },
  {
    id: "top-customer-cn-all-cabang",
    q: "top 10 customer cn terbanyak di all cabang",
    expect: { tool: "rekap_cabang" },
  },
  {
    id: "biaya-promosi-customer-all-cabang",
    q: "10 customer biaya promosi terbanyak all cabang",
    expect: { tool: "rekap_cabang" },
  },
  {
    id: "fee-marketing-customer-all-cabang",
    q: "15 customer fee marketing all cabang",
    expect: { tool: "rekap_cabang" },
  },
  {
    id: "slow-moving-15-barang",
    q: "15 barang yang ada stok lumayan banyak tapi tidak ada penjualan dalam satu tahun terakhir",
    expect: { tool: "stok_analisis" },
    answerNot: [/kelanjutan daftar/i, /belum dapat/i],
  },
  {
    id: "transaksi-customer",
    q: "transaksi piutang customer PT KALI REJO MAKMUR bulan juli",
    expectAnyTool: ["transaksi_piutang", "sql_readonly", "saldo_piutang"],
  },
  {
    id: "faktur-pajak-juli",
    q: "faktur pajak bulan juli terbit berapa?",
    expectAnyTool: ["faktur_pajak", "sql_readonly"],
  },
  {
    id: "giro-sudah-cair",
    q: "giro yang sudah cair bulan juli berapa?",
    expectAnyTool: ["pencairan_giro", "sql_readonly"],
  },
  {
    id: "klaim-bayar-promosi",
    q: "klaim biaya promosi yang sudah dibayar bulan juli?",
    expectAnyTool: ["klaim", "sql_readonly"],
  },
  {
    id: "ekspedisi-juli",
    q: "biaya ekspedisi bulan juli berapa?",
    expectAnyTool: ["tagihan_ekspedisi", "realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "detail-faktur",
    q: "coba isi detail faktur 01-FP.2605.0907",
    expect: { tool: "detail_dokumen" },
    answerNot: [/belum dapat/i, /apakah anda ingin/i],
  },
  {
    id: "dimusnahkan-bulan-ini",
    q: "barang apa saja yang dimusnahkan bulan juli?",
    expectAnyTool: ["stok_ops", "sql_readonly"],
  },
  {
    id: "mutasi-belum-realisasi",
    q: "mutasi gudang yang belum realisasi ada?",
    expectAnyTool: ["stok_ops", "sql_readonly"],
  },
  {
    id: "stok-expired-per-barang",
    q: "stok kasa lipat expirednya kapan saja?",
    expectAnyTool: ["stok_expired", "kartu_stok", "sql_readonly"],
  },
  {
    id: "harga-jual-bulan-lalu",
    q: "harga jual produk bulan lalu ke customer?",
    expectAnyTool: ["history_harga_jual", "realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "cari-supplier",
    q: "cari supplier yang namanya mirip 'medika'",
    expectAnyTool: ["cari_master", "sql_readonly"],
  },
  {
    id: "barang-paling-laku",
    q: "barang apa yang paling banyak terjual bulan ini?",
    expectAnyTool: ["realisasi_penjualan", "kartu_stok", "sql_readonly"],
  },
  {
    id: "produk-focus",
    q: "omzet product focus bulan juli berapa?",
    expectAnyTool: ["realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "kontrak-only",
    q: "penjualan kontrak bulan juli berapa?",
    expectAnyTool: ["realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "penunggak-120",
    q: "customer mana saja yang piutangnya lewat jatuh tempo lebih dari 120 hari?",
    expectAnyTool: ["faktur_outstanding", "sql_readonly"],
    answerNot: [/belum dapat (disajikan|dirinci)/i],
  },
  {
    id: "total-piutang-sekarang",
    q: "total piutang outstanding kita sekarang berapa?",
    expectAnyTool: ["faktur_outstanding", "dashboard_summary", "sql_readonly"],
  },
  {
    id: "customer-baru",
    q: "ada berapa customer baru bulan juli?",
    expectAnyTool: ["capaian_sales", "sql_readonly"],
  },
  {
    id: "margin-departemen",
    q: "margin departemen N3 bulan juli berapa?",
    expectAnyTool: ["realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "penjualan-eceran",
    q: "penjualan eceran bulan juli berapa?",
    expectAnyTool: ["realisasi_penjualan", "sql_readonly"],
  },
  {
    id: "stok-slow-moving",
    q: "stok slow moving bulan juli apa saja?",
    expectAnyTool: ["stok_analisis", "sql_readonly"],
    answerNot: [/belum dapat (disajikan|dirinci)/i],
  },
  {
    id: "stok-out-of-stock",
    q: "barang yang out of stock sekarang apa saja?",
    expectAnyTool: ["stok_analisis", "dashboard_summary", "sql_readonly"],
    answerNot: [/belum dapat (disajikan|dirinci)/i],
  },
  {
    id: "kunjungan-salesman",
    q: "kunjungan salesman bulan juli bagaimana?",
    expectAnyTool: ["kunjungan", "sql_readonly"],
    answerNot: [/belum dapat (disajikan|dirinci)/i],
  },
  {
    id: "piutang-jatuh-tempo",
    q: "piutang yang jatuh tempo 2 minggu ke depan berapa?",
    expectAnyTool: ["piutang_masuk", "sql_readonly"],
  },
  {
    id: "giro-belum-cair",
    q: "giro yang belum cair ada berapa?",
    expectAnyTool: ["piutang_masuk", "sql_readonly"],
  },
  {
    id: "do-belum-kirim",
    q: "DO yang belum terkirim bulan juli?",
    expectAnyTool: ["do_realisasi", "sql_readonly"],
  },
  {
    id: "faktur-margin-minus",
    q: "faktur yang marginnya minus bulan juli?",
    expectAnyTool: ["faktur_margin", "sql_readonly"],
  },
  {
    id: "pb-outstanding",
    q: "permintaan barang yang belum terpenuhi apa saja?",
    expectAnyTool: ["pb_outstanding", "sql_readonly"],
  },
  {
    id: "chitchat-tanpa-tool",
    q: "halo bro, terima kasih ya",
    expect: { tools: 0 },
  },
  {
    id: "knowledge-n3",
    q: "apa itu N3?",
    expect: { tools: 0 },
    answerNot: [/tidak tahu/i, /belum (bisa|tersedia)/i],
  },
  {
    id: "knowledge-alur-siklus",
    q: "jelaskan alur dari sales order sampai faktur lunas dibayar",
    expect: { tools: 0 },
    answerNot: [/tidak tahu/i],
  },
  {
    id: "reject-tanpa-tool",
    history: OUTSTANDING_HISTORY,
    q: "ga usah",
    expect: { tools: 0 },
  },
  {
    id: "penjualan-hari-ini",
    q: "penjualan hari ini berapa?",
    expectAnyTool: ["realisasi_penjualan", "dashboard_summary"],
  },
  {
    id: "stok-bulan-ini",
    q: "stok barang apa yang paling banyak keluar bulan ini?",
    expect: { tool: "kartu_stok", params: { startDate: MONTH_START, endDate: TODAY } },
  },
  {
    id: "followup-agustus",
    history: AUGUST_HISTORY,
    q: "itu bulan september ini?? klo bulan agustus?",
    expect: { tool: "kartu_stok", params: { startDate: `${Y}-08-01`, endDate: `${Y}-08-31` } },
  },
  {
    id: "cari-master-entitas",
    q: "omzet customer yang namanya mirip 'kali rejo' bulan ini",
    expectAnyTool: ["cari_master", "sql_readonly", "realisasi_penjualan"],
  },
];

// ── Fixture hasil tool (deterministik, bentuk sama dengan execTool asli) ──
const FIXTURES = {
  realisasi_penjualan: {
    tool: "realisasi_penjualan",
    isFinance: true,
    rows: [
      { Tanggal: `${Y}-07-05`, Outlet: "RS X", Nama: "Glove M", Qty: 10, Nilai: 500000, Nilai_Belum_ppn: 450000, Departemen: "N3", Rayon: "SOLO BARAT", margin: "500000-300000" },
    ],
  },
  faktur_outstanding: {
    tool: "faktur_outstanding",
    rows: [
      { Customer: "PT KALI REJO MAKMUR", Sisa_piutang: 850888318, Overdue: 190, Range_overdue: "x > 120", Nomor: "FP/1", Tanggal: `${Y}-01-01`, JthTempo: `${Y}-02-01` },
    ],
  },
  saldo_piutang: { tool: "saldo_piutang", rows: [{ Nama: "PT KALI REJO MAKMUR", Saldo_Akhir: 850888318 }] },
  kartu_stok: { tool: "kartu_stok", rows: [{ Nama: "Glove M", _Awal: 0, _In: 0, _Out: 5, _Akhir: 0, Kategori: "Glove" }] },
  dashboard_summary: {
    tool: "dashboard_summary",
    isFinance: true,
    snap: {
      cabang: "Solo",
      asOfDate: TODAY,
      penjualan: { omzet: 755125589, omzetPpn: 678000000, faktur: 314, omzetPrev: 4387157133, fakturPrev: 1164, deltaPct: -83, onDate: { omzet: 0, faktur: 0 } },
      series6: [],
      piutang: { totalSisa: 9032929114, buckets: {}, gt120: { count: 496, total: 2194720606 }, topOverdue: { customer: "PT BINA SUKSES MEDIKA", sisa: 726411438 } },
      inkaso: { total: 0, count: 0 },
      retur: { total: 0, count: 0 },
      topCustomer: [{ nama: "PT X", qty: 10, nilai: 500000, margin: 200000 }],
      topItem: [{ nama: "Glove M", qty: 10, nilai: 500000, margin: 200000 }],
      departemen: [{ nama: "N3", nilai: 500000 }],
      stok: { nilaiPersediaan: 1339100983, kritisCount: 281, negatifCount: 141, kritisTop: [{ nama: "SPUID NIPRO 3CC", stok: 200, min: 10000 }] },
    },
  },
};

async function main() {
  // Filter opsional: npm run eval -- <kata-kunci-id> (mis. npm run eval -- juli)
  const filter = process.argv[2] ? process.argv[2].toLowerCase() : "";
  const cases = filter ? CASES.filter((c) => c.id.toLowerCase().includes(filter)) : CASES;
  const user = { kode: "FINANCE", nama: "Eval", cabang: "01", cabangNama: "Solo", database: "krm", level: "USER" };
  const calls = [];
  const exec = async (name, args, u, question) => {
    // tangkap argumen SETELAH repairPeriod (paritas dengan execTool asli)
    const fixed = Object.hasOwn(TOOLS, name)
      ? agent.repairPeriod({ ...(args || {}) }, question || "")
      : args || {};
    calls.push({ name, args: JSON.parse(JSON.stringify(fixed)) });
    const f = FIXTURES[name];
    if (!f) return { error: `fixture '${name}' tidak tersedia` };
    return JSON.parse(JSON.stringify(f));
  };

  let failed = 0;
  console.log(`\n=== GOLDEN QUESTIONS (${cases.length}${filter ? ` dipilih '${filter}'` : ""} kasus, model live) ===`);
  for (const c of cases) {
    calls.length = 0;
    let answer = "";
    let error = null;
    const t0 = Date.now();
    try {
      const res = await agent.chat({
        messages: [...(c.history || []), { role: "user", content: c.q }],
        user,
        hooks: { exec },
      });
      answer = res.answer;
    } catch (e) {
      error = e.message;
    }
    const ms = Date.now() - t0;

    const problems = [];
    if (error) problems.push(`error: ${error}`);
    else {
      const exp = c.expect || {};
      if (exp.tools === 0) {
        if (calls.length > 0) problems.push(`diharapkan tanpa tool, tapi dipanggil: ${calls.map((x) => x.name).join(", ")}`);
      } else if (exp.expectAnyTool) {
        if (!calls.some((x) => exp.expectAnyTool.includes(x.name)))
          problems.push(`tool dipanggil: ${calls.map((x) => x.name).join(", ") || "(tidak ada)"} — diharapkan salah satu dari ${exp.expectAnyTool.join("/")}`);
      } else if (exp.tool) {
        const call = calls.find((x) => x.name === exp.tool);
        if (!call) problems.push(`tool ${exp.tool} tidak dipanggil (yang dipanggil: ${calls.map((x) => x.name).join(", ") || "-"})`);
        else {
          if (exp.minCalls) {
            const n = calls.filter((x) => x.name === exp.tool).length;
            if (n < exp.minCalls)
              problems.push(`${exp.tool} dipanggil ${n}x, diharapkan >= ${exp.minCalls} (perbandingan periode butuh beberapa panggilan)`);
          }
          if (exp.params) {
            for (const [k, v] of Object.entries(exp.params)) {
              if (JSON.stringify(call.args[k]) !== JSON.stringify(v))
                problems.push(`${exp.tool}.${k} = ${JSON.stringify(call.args[k])}, diharapkan ${JSON.stringify(v)}`);
            }
          }
          if (exp.hasDb && !call.args.db) problems.push(`${exp.tool}.db kosong — cabang tidak diteruskan`);
        }
        if (exp.sqlContainsAny || exp.sqlContains) {
          const need = exp.sqlContainsAny || [exp.sqlContains];
          const sqls = calls.filter((x) => x.name === exp.tool).map((x) => String(x.args.sql || "").toLowerCase());
          if (!sqls.length) problems.push(`tool ${exp.tool} tidak dipanggil`);
          else if (!sqls.some((sql) => need.some((s) => sql.includes(s.toLowerCase()))))
            problems.push(`tidak ada SQL memuat ${JSON.stringify(need)} (dari ${sqls.length} panggilan): ${sqls[0].slice(0, 120)}`);
        }
      }
      for (const re of c.answerNot || []) {
        if (re.test(answer)) problems.push(`jawaban memuat pola terlarang ${re}`);
      }
    }

    const status = problems.length ? "FAIL" : "PASS";
    if (problems.length) failed += 1;
    console.log(`${status}: ${c.id} (${ms}ms)${problems.length ? "\n   - " + problems.join("\n   - ") : ""}`);
  }

  console.log(`\n=== HASIL: ${cases.length - failed}/${cases.length} PASS ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("EVAL GAGAL:", e.message);
  process.exit(1);
});
