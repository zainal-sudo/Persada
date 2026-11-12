// services/ai/agent.js
// Mode agen: LLM (via 9Router) memutuskan sendiri tool yang dipanggil
// (function calling OpenAI) — laporan existing, sql_readonly, db_schema.
// Loop berhenti saat model menjawab tanpa tool_calls, atau habis iterasi.
// Gagal apapun dilempar ke pemanggil → aiService fallback ke pipeline lama.
const aiCfg = require("../../config/ai");
const { buildSystemPrompt, TOOLS } = require("./knowledgeBase");
const tools = require("./tools");
const sqlTool = require("./sqlTool");
const schemaCatalog = require("./schemaCatalog");
const branches = require("./branches");
const intent = require("./intent");
const numberGuard = require("./numberGuard");

const MAX_TOOL_RESULT_CHARS = 16000;

// Pisahkan event SSE dari buffer stream. Pure — diuji di selfcheck.
function extractSseDataEvents(buf) {
  const data = [];
  const parts = String(buf).split(/\n\n/);
  const rest = parts.pop() || "";
  for (const part of parts) {
    for (const line of part.split("\n")) {
      const t = line.trim();
      if (t.startsWith("data:")) data.push(t.slice(5).trim());
    }
  }
  return { data, rest };
}

// Versi streaming routerChat: teks mengalir via onDelta; content + tool_calls
// tetap diakumulasi penuh agar seluruh parser/post-processing lama tetap jalan.
async function routerChatStream({ messages, toolSpecs, onDelta, isAborted }) {
  const url = `${aiCfg.routerUrl}/v1/chat/completions`;
  const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (aiCfg.routerKey) headers.Authorization = `Bearer ${aiCfg.routerKey}`;
  if (aiCfg.bypassTokenSaver) headers["X-9Router-Token-Saver"] = "off";

  const body = {
    model: aiCfg.agentModel || aiCfg.model,
    messages,
    stream: true,
    max_tokens: aiCfg.maxTokens,
    temperature: aiCfg.temperature ?? 0,
    // Minta usage token pada chunk terakhir (pokok SSE). Provider yang tak
    // mendukung mengabaikan param ini — usage tinggal undefined (gerbang: env AI_USAGE).
    stream_options: { include_usage: true },
  };
  if (toolSpecs) body.tools = toolSpecs;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), aiCfg.timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers, signal: ctrl.signal, body: JSON.stringify(body) });
    if (res.status === 401) throw new Error("NINEROUTER_KEY tidak valid (401).");
    if (res.status === 402)
      throw new Error("Kredit provider AI habis (402). Cek/top-up combo di dashboard 9Router, lalu coba lagi.");
    if (res.status === 503) throw new Error("Semua akun provider 9Router sedang tidak tersedia (503).");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`9Router error ${res.status}: ${text.slice(0, 300)}`);
    }

    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("event-stream")) {
      // Provider mengabaikan stream → respons JSON penuh.
      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error("Respons 9Router tanpa message.");
      if (message.content && onDelta) onDelta(message.content);
      return { message: { role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls }, usage: data.usage };
    }

    let content = "";
    let usage;
    const tcMap = new Map();
    let buf = "";
    const decoder = new TextDecoder();
    const handleData = (json) => {
      if (!json || json === "[DONE]") return;
      let obj;
      try {
        obj = JSON.parse(json);
      } catch {
        return;
      }
      if (obj.usage && (obj.usage.total_tokens !== undefined || obj.usage.prompt_tokens !== undefined)) {
        usage = obj.usage;
      }
      const delta = obj.choices?.[0]?.delta;
      if (!delta) return;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onDelta?.(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = tcMap.get(idx) || { id: tc.id || `tc_${idx}`, type: "function", function: { name: "", arguments: "" } };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.function.name += tc.function.name;
          if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
          tcMap.set(idx, cur);
        }
      }
    };
    const reader2 = res.body.getReader();
    try {
      while (true) {
        if (isAborted?.()) {
          await reader2.cancel();
          break;
        }
        const { done, value } = await reader2.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { data: events, rest } = extractSseDataEvents(buf);
        buf = rest;
        for (const e of events) handleData(e);
      }
      const tail = buf.replace(/^\s*data:\s?/, "").trim();
      if (tail) handleData(tail);
    } finally {
      try {
        reader2.releaseLock();
      } catch {
        /* lepas diam-diam */
      }
    }

    const tool_calls = [...tcMap.values()].filter((tc) => tc.function.name);
    const message = { role: "assistant", content, tool_calls: tool_calls.length ? tool_calls : undefined };
    return isAborted?.() ? { message, usage, aborted: true } : { message, usage };
  } finally {
    clearTimeout(timer);
  }
}

async function routerChat({ messages, toolSpecs }) {
  const url = `${aiCfg.routerUrl}/v1/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (aiCfg.routerKey) headers.Authorization = `Bearer ${aiCfg.routerKey}`;
  if (aiCfg.bypassTokenSaver) headers["X-9Router-Token-Saver"] = "off";

  const body = {
    model: aiCfg.agentModel || aiCfg.model,
    messages,
    stream: false,
    max_tokens: aiCfg.maxTokens,
    temperature: aiCfg.temperature ?? 0,
  };
  if (toolSpecs) body.tools = toolSpecs;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), aiCfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, signal: ctrl.signal, body: JSON.stringify(body) });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new Error("NINEROUTER_KEY tidak valid (401).");
  if (res.status === 402)
    throw new Error("Kredit provider AI habis (402). Cek/top-up combo di dashboard 9Router, lalu coba lagi.");
  if (res.status === 503) throw new Error("Semua akun provider 9Router sedang tidak tersedia (503).");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`9Router error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Respons 9Router tanpa message.");
  return { message, usage: data.usage };
}

// Katalog tool dalam format OpenAI. Tipe parameter boolean utk flag is*/by*.
// db = cabang opsional (lintas cabang) — tersedia di semua tool.
function toolCatalog() {
  const DB_PARAM = {
    db: {
      type: "string",
      description:
        "Kode atau nama cabang (mis. 'Solo', '01'). Kosongkan untuk cabang Anda sendiri. Hanya cabang yang dapat diakses yang akan dieksekusi.",
    },
  };
  const fns = Object.entries(TOOLS).map(([id, t]) => {
    const properties = {};
    for (const [name, desc] of Object.entries(t.params)) {
      let d = desc;
      if (name === "startDate")
        d += " Bila user menyebut nama bulan tanpa tanggal, gunakan tanggal 1 bulan itu.";
      if (name === "endDate")
        d += " Bila user menyebut nama bulan tanpa tanggal, gunakan AKHIR bulan penuh (mis. Juli = 2026-07-31) — jangan dipotong.";
      properties[name] = { type: /^(is|by)/.test(name) ? "boolean" : "string", description: d };
    }
    properties.db = DB_PARAM.db;
    return {
      type: "function",
      function: {
        name: id,
        description: `${t.label}: ${t.desc}`,
        parameters: {
          type: "object",
          properties,
          required: t.params.startDate ? ["startDate", "endDate"] : [],
        },
      },
    };
  });
  fns.push({
    type: "function",
    function: {
      name: "sql_readonly",
      description:
        "Jalankan satu query SELECT read-only ke database cabang ERP. Untuk pertanyaan di laporan lain " +
        "(mis. agregasi ad-hoc). Wajib lihat struktur tabel via tool db_schema dulu — JANGAN query information_schema " +
        "lewat sini (akan ditolak). Nama tabel kolom resmi ada di aturan metrik; salesman (orang) = via tsalesmanaktif, " +
        "bukan tsalesman. LIMIT maksimal 200 dan otomatis ditambahkan bila tidak ada.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Satu statement SELECT (MySQL), tanpa titik-koma." },
          ...DB_PARAM,
        },
        required: ["sql"],
      },
    },
  });
  fns.push({
    type: "function",
    function: {
      name: "db_schema",
      description:
        "Lihat struktur database cabang: tanpa argumen = daftar tabel; dengan 'table' = daftar kolom + tipe tabel itu (beserta catatan bisnisnya).",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nama tabel (opsional)." },
          ...DB_PARAM,
        },
      },
    },
  });
  return fns;
}

// Pure + testable: pastikan maksud "bulan X" = BULAN PENUH. Model kadang
// mengirim periode terpotong (mis. Juli 1–20) padahal user menyebut bulan
// tanpa tanggal. Koreksi bila range model berada di bulan yang sama dengan
// maksud user (intent.explicitPeriod) tapi tidak penuh.
const isMonthEnd = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return d === new Date(y, m, 0).getDate();
};

function repairPeriod(params, question) {
  try {
    const wanted = intent.explicitPeriod(question || "");
    if (!wanted || wanted.ask || !isMonthEnd(wanted.endDate)) return params;
    const wantedYM = wanted.startDate.slice(0, 7);
    if (
      params.startDate?.slice(0, 7) === wantedYM &&
      params.endDate?.slice(0, 7) === wantedYM &&
      (params.startDate !== wanted.startDate || params.endDate !== wanted.endDate)
    ) {
      return { ...params, startDate: wanted.startDate, endDate: wanted.endDate };
    }
    // Lazy-default: model memakai periode bulan berjalan (default) padahal
    // user eksplisit menyebut bulan penuh lain ("klo bulan agustus?") →
    // pakai maksud user.
    const now = new Date();
    const curStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    if (
      wanted.endDate < fmtToday() &&
      params.startDate === curStart &&
      params.endDate === fmtToday()
    ) {
      return { ...params, startDate: wanted.startDate, endDate: wanted.endDate };
    }
    // Model tidak mengirim tanggal sama sekali → pakai maksud user.
    if (!params.startDate && !params.endDate) {
      return { ...params, startDate: wanted.startDate, endDate: wanted.endDate };
    }
  } catch {
    /* repair adalah bonus — gagal apa adanya */
  }
  return params;
}

const fmtToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

async function execTool(name, args, user, question) {
  if (Object.hasOwn(TOOLS, name)) {
    const params = repairPeriod({ ...args }, question);
    if (!params.startDate || !params.endDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      params.startDate = params.startDate || `${y}-${m}-01`;
      params.endDate = params.endDate || `${y}-${m}-${String(now.getDate()).padStart(2, "0")}`;
    }
    const res = await tools.exec(name, params, user);
    return { tool: res.tool, params, data: tools.summarize(res) };
  }
  if (name === "sql_readonly") return sqlTool.run(args.sql, user, args.db);
  if (name === "db_schema") return schemaCatalog.describe(args.table, user, args.db);
  throw new Error(`Tool tidak dikenal: ${name}`);
}

const truncate = (s) =>
  s.length > MAX_TOOL_RESULT_CHARS ? s.slice(0, MAX_TOOL_RESULT_CHARS) + '...,"catatan":"HASIL DIPOTONG"' : s;

// Sebagian provider di balik combo mengirim tool call sebagai teks DSML
// (markup DeepSeek/GLM) yang tidak di-parse gateway menjadi tool_calls.
// Parser fallback toleran: balikin array tool_callsOpenAI-format, atau null.
function parseDsml(content) {
  if (!content || !content.includes("DSML")) return null;
  const calls = [];
  const invokeRe = /invoke\s+name="([^"]+)">([\s\S]*?)(?:<\/[^>]*invoke>|$)/g;
  const paramRe = /parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*parameter>/g;
  let m;
  while ((m = invokeRe.exec(content)) !== null) {
    const args = {};
    let p;
    paramRe.lastIndex = 0;
    while ((p = paramRe.exec(m[2])) !== null) args[p[1]] = p[2].trim();
    calls.push({ id: `dsml_${calls.length}`, type: "function", function: { name: m[1], arguments: JSON.stringify(args) } });
  }
  return calls.length ? calls : null;
}

// Provider paling bandel: nulis SQL telanjang sebagai teks jawaban alih-alih
// tool call. Deteksi dan eksekusi sebagai sql_readonly.
function parseBareSql(content) {
  const t = String(content || "").trim();
  if (!/^(select|with)\b/i.test(t) || t.length > 4000) return null;
  if (!/\bfrom\b/i.test(t)) return null;
  return [{ id: "sql_0", type: "function", function: { name: "sql_readonly", arguments: JSON.stringify({ sql: t }) } }];
}

// Loop utama. `call` dan `exec` bisa diinjeksi untuk test; onDelta/onClear
// untuk streaming (clear saat ronde ternyata tool-call / ronde baru mulai).
// Frasa "menyerah" — model bilang datanya belum ada padahal bisa diambil
// via tool. Satu kali didorong lanjut eksekusi, bukan dibiarkan jawab
// "belum bisa".
const GIVEUP_RE =
  /belum (?:berhasil|bisa|dapat|terpisah|dapat memastikan)|tidak berhasil (?:menarik|mendapatkan|mengeksekusi)/i;

async function runAgent({ messages, user, systemPrompt, maxIter, call = routerChat, exec = execTool, onDelta, onClear, isAborted }) {
  const toolSpecs = toolCatalog();
  const base = [{ role: "system", content: systemPrompt }, ...messages];
  const extras = [];
  const usedReports = new Set();
  const question = String(messages.at(-1)?.content || "");
  let nudged = false;
  let usageTotal = null;
  const addUsage = (u) => {
    if (!u) return;
    if (!usageTotal) usageTotal = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    usageTotal.prompt_tokens += u.prompt_tokens || 0;
    usageTotal.completion_tokens += u.completion_tokens || 0;
    usageTotal.total_tokens += u.total_tokens || 0;
  };
  const abortResult = () => ({
    answer: "",
    usedReports,
    toolMessages: toolMsgContents(),
    extras,
    usage: usageTotal,
    aborted: true,
  });
  const toolMsgContents = () =>
    extras.filter((m) => m.role === "tool").map((m) => m.content);

  for (let i = 0; i < maxIter; i++) {
    if (isAborted?.()) return abortResult();
    if (i > 0) onClear?.(); // ronde baru — bersihkan sisa teks ronde sebelumnya
    const { message, usage, aborted } = await call({ messages: [...base, ...extras], toolSpecs });
    addUsage(usage);
    if (aborted) return abortResult();
    let calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    let synthesized = false;
    if (process.env.AI_DEBUG_RAW) console.error("RAWCONTENT:", JSON.stringify(message.content || "").slice(0, 800));
    if (!calls.length) {
      const dsml = parseDsml(message.content) || parseBareSql(message.content);
      if (dsml) {
        calls = dsml;
        synthesized = true;
      }
    }
    if (!calls.length) {
      const giveup = !nudged && i < maxIter - 1 && GIVEUP_RE.test(String(message.content || ""));
      if (giveup) {
        nudged = true;
        extras.push({ role: "assistant", content: message.content ?? null });
        extras.push({
          role: "user",
          content:
            "(Catatan sistem: data yang dibutuhkan sebenarnya bisa diambil. Jalankan tool yang relevan SEKARANG " +
            "untuk mendapatkan angka yang ditanyakan, lalu jawab pertanyaan user dengan data tersebut.)",
        });
        continue;
      }
      if (message.content && message.content.includes("DSML"))
        throw new Error("Model mengeluarkan format tool call yang tidak dikenali.");
      return { answer: String(message.content || "").trim(), usedReports, toolMessages: toolMsgContents(), extras, usage: usageTotal };
    }

    extras.push({ role: "assistant", content: synthesized ? null : (message.content ?? null), tool_calls: calls });
    onClear?.(); // ronde ternyata tool-call (markup/teks parsial di-reset)
    for (const c of calls) {
      const name = c.function?.name || "";
      let args = {};
      try {
        args = JSON.parse(c.function?.arguments || "{}");
      } catch {
        args = {};
      }
      let out;
      try {
        if (process.env.AI_DEBUG_RAW) console.error("EXEC:", name, JSON.stringify(args).slice(0, 300));
        out = await exec(name, args, user, question);
        if (process.env.AI_DEBUG_RAW) console.error("EXEC OK:", JSON.stringify(out).slice(0, 400));
      } catch (e) {
        out = { error: e.message };
        if (process.env.AI_DEBUG_RAW) console.error("EXEC ERR:", name, e.message);
      }
      if (Object.hasOwn(TOOLS, name.split(".")[0])) usedReports.add(name.split(".")[0]);
      extras.push({ role: "tool", tool_call_id: c.id, content: truncate(JSON.stringify(out)) });
    }
  }

  // Iterasi habis → panggilan terakhir tanpa tools, paksa jawaban akhir.
  // Provider bandel kadang masih menulis SQL/DSML sebagai teks — beri satu
  // nudge tanpa tools; gagal lagi → throw → fallback pipeline lama.
  const stripMarkup = (s) =>
    String(s || "")
      .replace(/<[^>]{0,40}(?:DSML|invoke|parameter|calls)[^>]{0,40}>/g, "")
      .replace(/<｜｜[^>]*>/g, "")
      .trim();
  const NUDGE =
    "Data sudah cukup. JANGAN menulis SQL atau permintaan tool lagi, juga jangan menuliskan rencana query. " +
    "Jawab pertanyaan terakhir user SEKARANG dalam Bahasa Indonesia dengan gaya eksekutif, berdasarkan data yang sudah ada di percakapan.";
  if (isAborted?.()) return abortResult();
  let { message } = await call({ messages: [...base, ...extras] });
  let finalAnswer = stripMarkup(message.content);
  if (isAborted?.()) return abortResult();
  if (!finalAnswer || parseBareSql(finalAnswer)) {
    ({ message } = await call({ messages: [...base, ...extras, { role: "system", content: NUDGE }] }));
    finalAnswer = stripMarkup(message.content);
    if (isAborted?.()) return abortResult();
  }
  if (!finalAnswer || parseBareSql(finalAnswer)) throw new Error("Ronde terakhir tidak menghasilkan jawaban teks.");
  return { answer: finalAnswer, usedReports, toolMessages: toolMsgContents(), extras, usage: usageTotal };
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

async function chat({ messages, user, hooks = {} }) {
  if (!user) throw new Error("User tidak terdeteksi.");
  const isFinance = aiCfg.isFinanceUser(user);
  let branchLine = "";
  try {
    const list = await branches.listBranches();
    branchLine = `\n- Cabang Anda: ${user.cabangNama || user.cabang || "-"}. Daftar cabang: ${branches.branchSummary(list, user.database)}. Untuk data cabang lain, isi parameter db (kode atau nama). Sebut cabang selalu dengan NAMA, bukan kode.`;
  } catch {
    branchLine = `\n- Cabang Anda: ${user.cabangNama || user.cabang || "-"}.`;
  }
  const systemPrompt =
    buildSystemPrompt({
      userName: user.nama || user.kode,
      userKode: user.kode,
      cabang: user.cabangNama || user.cabang,
      isFinance,
    }) +
    "\n\nMODE AGEN:" +
    `\n- Tanggal hari ini: ${today()}.` +
    branchLine +
    "\n- Untuk data ERP gunakan tools; jangan mengarang angka. Boleh memanggil beberapa tool berturut-turut sebelum menjawab." +
    "\n- Semua angka WAJIB diambil dari hasil tool pada percakapan ini. Jangan menyalin angka dari pesan-pesan sebelumnya — jalankan ulang tool bila perlu angka terkini." +
    "\n- Nama bulan tanpa tanggal = BULAN PENUH (mis. 'Juli' = 2026-07-01 s.d. 2026-07-31; Februari 28/29 sesuai tahun). 'Bulan ini' = 1 s.d. hari ini. Jangan pernah memotong periode bulan." +
    "\n- Follow-up tanpa laporan baru yang menyebut nama bulan (mis. 'klo bulan agustus?') = GANTI periode topik sebelumnya ke bulan itu; bulan TERAKHIR yang user sebut yang berlaku." +
    "\n- Pertanyaan kondisi bisnis umum atau minta briefing (mis. 'bagaimana kondisi bisnis saya?', 'ringkas keadaan hari ini') → gunakan dashboard_summary; angkanya sudah mencakup penjualan, piutang, inkaso, retur, dan stok." +
    "\n- Pertanyaan di luar 4 laporan (mis. breakdown per customer, top penunggak per overdue) → gunakan sql_readonly, dan lihat struktur tabel via db_schema bila ragu nama kolom." +
    "\n- Sebelum sql_readonly memakai nama customer/barang/salesman, panggil cari_master dulu untuk mendapat nama/kode EKSAK — jangan menebak ejaan." +
    "\n- Pertanyaan per customer/salesman/rayon/departemen/kategori (mis. 'omzet juli salesman baskara', 'FOS customer X') → pakai PARAM FILTER tool (isi nama EKSAK dari cari_master), JANGAN langsung sql_readonly. Filter tersedia: realisasi_penjualan (customer/barang/salesman/rayon/departemen/kategori/marketing), faktur_outstanding (customer/rayon/salesman), saldo_piutang (customer), kartu_stok (barang), inkaso & retur_penjualan & penjualan_per_faktur (customer, salesman), transaksi_piutang (customer). JANGAN menjawab 'belum dapat dirinci' bila data bisa ditarik dengan filter ini." +
    "\n- Dokumen tunggal ('isi faktur 01-FP.2605.0907', 'detail DO/SO/retur/pajak') → detail_dokumen (jenis + nomor eksak). Giro sudah cair → pencairan_giro; klaim biaya promosi/fee marketing dibayar → klaim (jenis bp/fm); biaya ekspedisi → tagihan_ekspedisi; faktur pajak → faktur_pajak; mutasi piutang harian customer → transaksi_piutang; pemusnahan/penyesuaian/mutasi gudang → stok_ops (param jenis); riwayat harga jual barang → history_harga_jual (param kode)." +
    "\n- Growth/perbandingan antar periode (mis. 'penjualan juli vs agustus', 'naik atau turun?') → panggil tool yang sama DUA kali (satu panggilan per periode) lalu hitung delta; atau untuk capaian/growth per rayon/departemen langsung pakai capaian_sales (sudah memuat realisasi bulan sama tahun lalu + growth). Penyebab naik/turun hanya boleh dinyatakan bila ada datanya — bukan spekulasi." +
    "\n- Pertanyaan LINTAS CABANG (all cabang / grup / semua cabang / seluruh cabang / nasional): omzet vs target & % capaian → omzet_cabang; piutang/inkaso/stok/biaya-jurnal lintas cabang → rekap_cabang (param metrik; jurnal + param akun); peringkat customer lintas cabang (mis. 'top 10 customer cn terbanyak di all cabang', '10 customer biaya promosi terbanyak', '15 customer fee marketing', 'penyumbang omset terbesar') → rekap_cabang metrik 'piutang_customer'/'omzet_customer'/'cn_customer'/'biaya_promosi_customer'/'fee_marketing_customer' (param batas). Kata 'all cabang' WAJIB tool lintas-cabang — DILARANG menjawab hanya dari cabang sendiri walau ada laporan lama di konteks percakapan. JANGAN memanggil capaian_sales, jurnal, faktur_outstanding, atau laporan lain berulang dengan db berbeda — melebihi batas iterasi dan jawaban jadi tidak lengkap. Laporan per-rayon/salesman untuk SATU cabang → capaian_sales." +
    "\n- Pertanyaan 'urutan ke N' / 'top N barang/customer' bila N melebihi yang tampil di snapshot: panggil ULANG tool yang sama dengan param batas lebih besar, lalu jawab dari snapshot BARU memakai nomor rank di snapshot. DILARANG melanjutkan daftar atau menebak peringkat dari ingatan konteks — rank harus dari data snapshot terbaru." +
    "\n- Etika eksekusi: permintaan langsung dari user (mis. 'coba breakdown per salesman') = kerjakan SEGERA dengan tools; cek db_schema dulu bila ragu struktur data. JANGAN menjawab 'belum punya data', 'mau saya jalankan?', atau meminta izin ulang. 'Belum bisa' hanya jika benar-benar tidak ada cara mendapatkan datanya." +
    "\n- Jawaban untuk eksekutif: daftar bernomor dengan nama penting dibold, bukan tabel; tanpa istilah teknis (tabel/kolom/SQL/nama tool/kata snapshot/query)." +
    "\n- Snapshot laporan hanya berisi agregat umum (top berdasarkan total sisa). Pertanyaan yang menuntut peringkat menurut dimensi lain — mis. 'terbesar DAN sudah lewat jatuh tempo' (porsi overdue per customer) — WAJIB dijawab lewat sql_readonly SEBELUM menjawab; jangan menebak dari top_customer dan jangan cukup memberi catatan bahwa angkanya belum spesifik." +
    "\n- Bila user tidak menyebut periode, pakai bulan berjalan (tanggal 1 s.d. hari ini)." +
    "\n- Hasil query/laporan 0 baris BUKAN otomatis 'tidak ada data' — cek ulang filter, periode, dan ejaan nama; coba satu variasi query bila perlu; baru simpulkan dengan jujur." +
    "\n- Setelah data cukup, jawab sesuai gaya eksekutif di atas; jangan tampilkan SQL mentah.";

  const exec = hooks.exec || execTool;
  // Streaming: teks tiap ronde mengalir; clear saat ronde ternyata tool-call.
  let emitted = false;
  const onDelta = (t) => {
    emitted = true;
    hooks.onDelta?.(t);
  };
  const onClear = () => {
    if (emitted) {
      emitted = false;
      hooks.onClear?.();
    }
  };
  const call = hooks.stream
    ? (req) => routerChatStream({ ...req, onDelta, onClear, isAborted: hooks.isAborted })
    : routerChat;
  const result = await runAgent({
    messages,
    user,
    systemPrompt,
    maxIter: aiCfg.agentMaxIter || 8,
    exec,
    call,
    onDelta: hooks.stream ? onDelta : undefined,
    onClear: hooks.stream ? onClear : undefined,
    isAborted: hooks.isAborted,
  });
  if (result.aborted) {
    return {
      answer: "",
      sources: [...result.usedReports],
      model: aiCfg.agentModel || aiCfg.model,
      toolCount: result.usedReports.size,
      periodAssumed: result.usedReports.size > 0,
      replyMode: null,
      agent: true,
      numberCheck: "ok",
      usage: result.usage,
      aborted: true,
    };
  }
  if (!result.answer) throw new Error("Agent mengembalikan jawaban kosong.");
  const { answer, usedReports, toolMessages, extras } = result;

  // ── Penjaga konsistensi angka: nominal jawaban harus ada di data tool ──
  let finalAnswer = answer;
  let numberCheck = "ok";
  if (toolMessages.length) {
    const check = numberGuard.checkAnswer(finalAnswer, toolMessages);
    if (!check.ok) {
      try {
        const repair = await routerChat({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            ...extras,
            {
              role: "system",
              content:
                `JAWABAN SEBELUMNYA MENGANDUNG ANGKA YANG TIDAK DITEMUKAN DI DATA: ` +
                `${check.unverified.map((u) => u.raw).join(", ")}. ` +
                `Jawab ulang pertanyaan user HANYA dengan angka yang ada di data percakapan ini. Jangan mengarang angka.`,
            },
          ],
        });
        const retryAnswer = String(repair.message?.content || "").trim();
        const recheck = numberGuard.checkAnswer(retryAnswer, toolMessages);
        if (retryAnswer && recheck.ok) {
          finalAnswer = retryAnswer;
          numberCheck = "repaired";
        } else {
          numberCheck = "warn";
          console.warn("[AI] angka belum terverifikasi:", check.unverified.map((u) => u.raw).join(", "));
        }
      } catch {
        numberCheck = "warn";
      }
    }
  }

  return {
    answer: finalAnswer,
    sources: [...usedReports],
    model: aiCfg.agentModel || aiCfg.model,
    toolCount: usedReports.size,
    periodAssumed: usedReports.size > 0,
    replyMode: null,
    agent: true,
    numberCheck,
    usage: result.usage,
  };
}

module.exports = {
  chat,
  runAgent,
  routerChat,
  routerChatStream,
  toolCatalog,
  execTool,
  parseDsml,
  parseBareSql,
  repairPeriod,
  extractSseDataEvents,
};
