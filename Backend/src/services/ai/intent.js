// services/ai/intent.js
// Deteksi laporan yang diminta + ekstraksi parameter (tanggal, filter) dari
// pertanyaan user. Rule-based (bukan LLM) agar hemat token dan deterministik.
//
// Mendukung follow-up percakapan: pesan tanpa laporan (mis. "lha kalau bulan
// agustus?") mewarisi laporan dari pertanyaan sebelumnya, dan periode selalu
// ditentukan paling spesifik dari pesan terakhir ("bulang agustus" → Agustus).

const { TOOLS } = require("./knowledgeBase");

const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthEnd = (y, m0) => fmt(new Date(y, m0 + 1, 0));

// ── Nama bulan Bahasa Indonesia (toleran typo 3-4 huruf awal) ───────
const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const MONTH_PREFIX = MONTHS.map((m) => m.slice(0, 4));
const MONTH_RE = /(?:bulan\s*)?\b(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\b/g;

const splitHint = (s) => s.toLowerCase().split(/[?.,!;]|k(alau|lo|lau)?\s+|tapi\s+/i).filter(Boolean);

// Bulan yang diminta user = SEBUTAN BULAN TERAKHIR dalam teks
// ("itu september? klo bulang agustus?" → agustus). Fragment terakhir dipakai
// untuk menangkap yang paling relevan walaupun bullet di tengah.
function lastMonthIndex(text) {
  const frags = splitHint(text);
  for (let i = frags.length - 1; i >= 0; i--) {
    const ms = frags[i].match(MONTH_RE);
    if (ms && ms.length) {
      const tok = ms[ms.length - 1].replace(/^bulan\s*/, "").slice(0, 3);
      const idx = MONTH_PREFIX.findIndex((p) => p.startsWith(tok));
      if (idx !== -1) return idx;
    }
  }
  return null;
}

// Nama bulan (opsional kata "bulan" di depan) + opsional tahun → rentang.
function monthRange(text) {
  const frag = lastFragContainingMonth(text);
  if (!frag) return null;
  const idx = lastMonthIndex(frag);
  if (idx === null) return null;
  const matches = [...frag.matchAll(MONTH_RE)];
  const match = matches[matches.length - 1];
  const tail = frag.slice(match.index + match[0].length);
  const past = /(lalu|kemarin|tahun lalu)/.test(tail);
  const yMatch = tail.match(/\b(19|20)\d{2}\b/);
  let year = yMatch ? Number(yMatch[0]) : new Date().getFullYear();
  if (past && !yMatch) year -= 1;
  return { startDate: fmt(new Date(year, idx, 1)), endDate: monthEnd(year, idx) };
}

function lastFragContainingMonth(text) {
  const frags = splitHint(text);
  for (let i = frags.length - 1; i >= 0; i--) {
    if (frags[i].match(MONTH_RE)) return frags[i];
  }
  return null;
}

// ── Tanggal literal ──────────────────────────────────────────────────
function findDates(text) {
  const matches = text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g);
  if (!matches) return null;
  const dates = matches.map((s) => {
    const [a, b, c] = s.split(/[\/\-]/);
    return a.length === 4 ? s : `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  });
  return { startDate: dates[0], endDate: dates[1] || dates[0] };
}

const DAY_RANGE_RE = /\b(\d{1,2})\s*(?:sampai|hingga|s\s*\/?\s*d\.?|s\.d\.|[-–—])\s*(?:tanggal\s*)?(\d{1,2})(?!\d)/i;
const UNTIL_NOW_RE = /(?:sampai|hingga|s\/?d|s\.d\.|[-–—])\s*(?:sekarang|hari ini|saat ini|today)\b/i;

function requestedPeriod(text, inherited = null) {
  if (!text || EXPLANATION_RE.test(text)) return null;
  const literal = findDates(text);
  const month = monthRange(text);
  const range = text.match(DAY_RANGE_RE);
  const namedDates = [...text.toLowerCase().matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE.source})\\s*(\\d{4})?`, "g"))];
  const dateInMonth = (day, period) => `${period.startDate.slice(0, 8)}${String(day).padStart(2, "0")}`;
  let period = literal;
  if (!period && namedDates.length > 1) {
    const first = namedDates[0];
    const last = namedDates[namedDates.length - 1];
    const year = last[4] || first[4] || new Date().getFullYear();
    period = {
      startDate: dateInMonth(first[1], monthRange(`${first[2]} ${first[4] || year}`)),
      endDate: dateInMonth(last[1], monthRange(`${last[2]} ${last[4] || year}`)),
    };
  }
  if (!period && range) {
    const base = month || relativePeriod(text) || inherited;
    if (!base || base.ask || base.startDate.slice(0, 7) !== base.endDate.slice(0, 7))
      return { ask: "Tanggal tersebut untuk bulan dan tahun berapa?" };
    period = { startDate: dateInMonth(range[1], base), endDate: dateInMonth(range[2], base) };
  }
  if (!period && namedDates.length) {
    const date = dateInMonth(namedDates[0][1], month);
    period = { startDate: date, endDate: date };
  }
  if (!period) period = month || relativePeriod(text);
  if (UNTIL_NOW_RE.test(text)) {
    if (!period) return { ask: "Mulai tanggal, bulan, dan tahun berapa?" };
    period = { ...period, endDate: fmt(new Date()) };
  }
  return period;
}

function periodQuestion(period) {
  if (period.ask) return period.ask;
  const valid = (value) => {
    const [y, m, d] = value.split("-").map(Number);
    return fmt(new Date(y, m - 1, d)) === value;
  };
  if (!valid(period.startDate) || !valid(period.endDate)) return "Tanggal tidak valid. Sebutkan tanggal yang sesuai kalender.";
  if (period.startDate > period.endDate) return "Tanggal mulai harus sebelum atau sama dengan tanggal akhir.";
  if (period.startDate < "2024-01-01" || period.endDate > fmt(new Date()))
    return `Periode yang tersedia 1 Januari 2024 sampai ${fmt(new Date())}. Pilih tanggal dalam rentang tersebut.`;
  return null;
}

// ── Periode relatif ──────────────────────────────────────────────────
const REL_PERIOD_RE = /(hari ini|today|kemarin|yesterday|bulan lalu|last month|bulan kemarin|bulan ini|this month|minggu ini|minggu kemarin|ytd|tahun ini|tahun lalu)/i;

function relativePeriod(text) {
  const t = text.toLowerCase();
  const now = new Date();
  if (/(bulan ini|this month)/.test(t)) return defaultPeriod();
  if (/(kemarin|yesterday)/.test(t) && !/bulan kemarin|minggu kemarin/.test(t)) {
    const d = addDays(now, -1);
    return { startDate: fmt(d), endDate: fmt(d) };
  }
  if (/(hari ini|today)/.test(t)) return { startDate: fmt(now), endDate: fmt(now) };
  if (/(bulan lalu|last month|bulan kemarin)/.test(t)) {
    return { startDate: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), endDate: monthEnd(now.getFullYear(), now.getMonth() - 1) };
  }
  if (/(minggu ini|minggu kemarin)/.test(t)) {
    const previous = /minggu kemarin/.test(t);
    const monday = addDays(now, -((now.getDay() + 6) % 7) - (previous ? 7 : 0));
    return { startDate: fmt(monday), endDate: previous ? fmt(addDays(monday, 6)) : fmt(now) };
  }
  if (/(tahun lalu|last year)/.test(t))
    return { startDate: `${now.getFullYear() - 1}-01-01`, endDate: `${now.getFullYear() - 1}-12-31` };
  if (/(ytd|tahun ini)/i.test(t)) return { startDate: `${now.getFullYear()}-01-01`, endDate: fmt(now) };
  return null;
}

// Periode "eksplisit paling spesifik" dari teks. Prioritas:
// tanggal literal > nama bulan > relatif > default bulan berjalan.
function explicitPeriod(text) {
  if (!text) return defaultPeriod();
  return requestedPeriod(text) || defaultPeriod();
}

function defaultPeriod() {
  const now = new Date();
  return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
}

// ── Aturan laporan ───────────────────────────────────────────────────
const RULES = [
  {
    id: "realisasi_penjualan",
    kw: /(penjualan|omzet|omset|realisasi|list.?jual|faktur penjualan|revenue|jual per item|terlaris)/i,
  },
  {
    id: "faktur_outstanding",
    kw: /(outstanding|overdue|belum bayar|belum lunas|faktur yang (sudah )?lewat|piutang jatuh|lewat jatuh tempo|yang belum di bayar)/i,
  },
  {
    id: "inkaso",
    kw: /(inkaso|pembayaran|yang (terakhir )?membayar|sudah membayar|baru.baru ini.*membayar|terbayar|dibayar|uang masuk)/i,
  },
  {
    id: "saldo_piutang",
    kw: /(saldo piutang|piutang customer|piutang|terbesar)/i,
  },
  {
    id: "kartu_stok",
    kw: /(kartu stok|stok (barang )?|stock|persediaan|mutasi stok|paling banyak keluar|paling banyak masuk)/i,
  },
];

const ALL_KW = RULES.reduce((acc, r) => ({ ...acc, [r.id]: r.kw }), {});
const TOOL_ORDER = ["realisasi_penjualan", "faktur_outstanding", "inkaso", "saldo_piutang", "kartu_stok"];

function detectTools(text) {
  if (!text) return [];
  const hits = RULES.filter((r) => r.kw.test(text)).map((r) => r.id);
  return hits.sort((a, b) => TOOL_ORDER.indexOf(a) - TOOL_ORDER.indexOf(b));
}

function extractFilters(text, params = {}) {
  const p = { ...params };
  const cm = text.match(/(customer|outlet|pelanggan)\s+([a-z0-9-]{2,})/i);
  if (cm) p.customer = cm[2];
  const sm = text.match(/salesman(?:nya)?\s+([a-z][a-z0-9-]+)/i);
  const SM_STOP = new Set(["siapa", "apa", "yang", "itu", "saja", "aja", "saja"]);
  if (sm && !SM_STOP.has(sm[1].toLowerCase())) p.salesman = sm[1];
  if (/kontrak/.test(text)) p.isKontrak = true;
  if (/inkaso/.test(text)) p.byInkaso = true;
  if (/fokus|product ?focus|produk fokus/i.test(text)) p.isProductFocus = true;
  const gd = text.match(/gudang\s+([a-z0-9-]{1,})/i);
  if (gd) p.gudang = gd[2];
  const brg = text.match(/barang\s+(?!(dia|di|apa|yang|apa\b)\b)([a-z0-9-]{2,})/i);
  if (brg) p.barang = brg[2];
  return p;
}

// ── Analisis satu pesan ──────────────────────────────────────────────
function analyze(text, period = explicitPeriod(text)) {
  const tools = EXPLANATION_RE.test(text || "") ? [] : detectTools(text || "");
  if (tools.length === 0) return { tools: [], ask: null, params: {} };
  const ask = periodQuestion(period);
  if (ask) return { tools: [], ask, params: {} };
  const params = {};
  for (const id of tools) params[id] = extractFilters(text, period);
  return { tools, ask: null, params };
}

// ── Resolusi follow-up ───────────────────────────────────────────────
// Pesan terakhir tanpa laporan (mis. "lha kalau bulan agustus?") mewarisi
// laporan dari pertanyaan induk. Period: sebutan bulan/datar terakhir di
// pesan terakhir menang; kalau tidak menyebut periode, pakai periode induk.
// Filter induk (customer/barang/gudang) ikut diwariskan agar konteks nyambung.

// ── Balasan atas tawaran asisten ─────────────────────────────────────
// Asisten sering menutup jawaban dengan tawaran, mis. "Mau saya tarik detail
// per faktur untuk >120 hari?". User menjawab singkat: "boleh", "ya",
// "ga usah". Di sini "boleh/ya" = setuju mengeksekusi tawaran; "ga usah" =
// tolak (jangan jalankan tool apapun).
const REJECT_RE = /^(ga usah|ngga usah|nggak usah|tidak usah|ndak usah|gausah|tidak perlu|nggak perlu|ga perlu|jangan|nanti dulu|skip|ga jadi|nggak jadi|belum dulu)\b(?:[,.!?\s]*(?:nanti aja|dulu|aja|makasih|terima kasih))*[,.!?\s]*$/i;
const ACCEPT_RE = /^(boleh|ya|oke|ok|yoi|silahkan|silakan|lanjut(?:kan)?|gas|tolong|yes)\b[.!?\s]*$/i;
const OFFER_RE = /(?:mau|boleh|ingin) saya|saya (?:tarik|buatkan|ambil)/i;
const EXPLANATION_RE = /^(?:(?:oke|ok|ya)[,\s]+)?(?:apa (?:itu|arti|maksud|bedanya)|(?:jelaskan|jelasin|terangkan|ringkas|rangkum)|(?:bagaimana|gimana) cara|cara\b|kenapa\b|mengapa\b|menurut(?:mu| kamu)\b)/i;

function detectReplyMode(currentText) {
  const t = String(currentText || "").trim();
  if (REJECT_RE.test(t)) return "reject";
  if (ACCEPT_RE.test(t)) return "accept";
  return null;
}

// Dari teks tawaran asisten, tentukan "fokus detail" yang diminta.
// Contoh: "...tarik detail per faktur untuk >120 hari?" → detailFocus overdue_gt120.
function offerDetailFocus(proposalText) {
  if (!proposalText) return null;
  if (/(per faktur|detail per faktur|per customer|detail faktur)/i.test(proposalText)) {
    if (/>\s*120|120\s*hari|lebih dari 120|di atas 120|x > 120/.test(proposalText)) return "overdue_gt120";
    if (/>\s*90|90\s*hari|lebih dari 90/.test(proposalText)) return "overdue_gt90";
    if (/>\s*60|60\s*hari/.test(proposalText)) return "overdue_gt60";
    return "row_detail";
  }
  return null;
}

// Periode eksplisit (tanggal literal / nama bulan) dari pesan terakhir.
// Kata relatif ("bulan lalu", "bulan ini") juga dianggap menyebut periode
// sehingga menimpa periode induk pada follow-up.
function curPeriodFor(currentText) {
  return requestedPeriod(currentText);
}

// Resolusi penuh satu pesan user terhadap konteks percakapan.
// - parentText: teks/tawaran sebelumnya (pertanyaan user ATAU tawaran asisten)
// - parentTools: id laporan yang relevan dari konteks
// Hasil `detailFocus` memberi tahu eksekutor tawaran mana yang disetujui.
function resolveConversation(currentText, parentText, parentTools = [], offerText = parentText, periodContext = null) {
  parentTools = parentTools.filter((id) => Object.hasOwn(TOOLS, id));
  const replyMode = detectReplyMode(currentText);
  const parentPeriod = periodContext || requestedPeriod(parentText);
  const period = requestedPeriod(currentText, parentPeriod) || parentPeriod || defaultPeriod();
  const cur = analyze(currentText || "", period);

  // Penolakan eksplisit → tidak menjalankan tool apapun.
  if (replyMode === "reject") return { ...cur, tools: [], params: {}, inherited: [], replyMode };

  // Persetujuan atas tawaran asisten → jalankan tool dari konteks tawaran,
  // ikutkan fokus detail yang ditawarkan.
  if (replyMode === "accept") {
    if (!parentText || !OFFER_RE.test(offerText || "") || parentTools.length === 0) return { ...cur, inherited: [], detailFocus: null };
    return {
      ...resolveFollowing(parentText, currentText, parentTools, period),
      replyMode: "accept",
      detailFocus: offerDetailFocus(offerText),
    };
  }

  if (cur.ask || cur.tools.length > 0) return { ...cur, inherited: [] };
  if (!parentText || parentTools.length === 0) return { ...cur, inherited: [] };

  if (EXPLANATION_RE.test(currentText) ||
      (!curPeriodFor(currentText) && !REL_PERIOD_RE.test(currentText) &&
       Object.keys(extractFilters(currentText)).length === 0 &&
       !/\b(?:cek ulang|perbarui|refresh|detail|rinciannya)\b/i.test(currentText))) {
    return { ...cur, tools: [], params: {}, inherited: [] };
  }

  const res = resolveFollowing(parentText, currentText, parentTools, period);
  return { ...res, replyMode: null, detailFocus: null };
}

// Inti warisan konteks: parentText (bisa tawaran asisten) + currentText.
// parentTools adalah petunjuk laporan dari konteks (explicit) — dipakai bila
// pesan terakhir tidak menyebut laporan apa pun secara eksplisit.
function resolveFollowing(parentText, currentText, parentTools, period) {
  const parent = analyze(parentText);
  const merged = analyze(`${parentText} ${currentText}`);

  const ask = periodQuestion(period);
  if (ask) return { tools: [], params: {}, inherited: [], ask };
  const newExplicit = curExplicitReport(currentText, parentText);

  // Pilihan tool: laporan baru yang eksplisit di current text > petunjuk
  // parentTools > laporan yang muncul di teks gabungan.
  let tools;
  if (newExplicit) tools = [newExplicit];
  else if (parentTools.length > 0) tools = parentTools;
  else tools = merged.tools;

  if (tools.length === 0) return { tools: [], params: {}, inherited: [] };

  const buildParams = (list) => {
    const params = {};
    for (const id of list) {
      params[id] = { ...period };
      const parentParams = parent.params[id] || {};
      const curParams = extractFilters(currentText, {});
      for (const k of ["customer", "barang", "gudang", "isKontrak", "byInkaso", "isProductFocus"]) {
        if (parentParams[k] !== undefined && curParams[k] === undefined) params[id][k] = parentParams[k];
      }
      params[id] = extractFilters(currentText, params[id]);
    }
    return params;
  };

  return { tools, params: buildParams(tools), inherited: parentTools };
}

// Laporan yang disebut eksplisit di currentText TAPI tidak di parentText.
function curExplicitReport(currentText, parentText) {
  for (const r of RULES) {
    if (r.kw.test(currentText) && !r.kw.test(parentText)) return r.id;
  }
  return null;
}

// Re-export agar tetap compat bila ada pemanggil lama.
function toolIds() {
  return Object.keys(TOOLS);
}

module.exports = { analyze, resolveConversation, toolIds, ALL_KW, explicitPeriod, requestedPeriod, detectReplyMode, offerDetailFocus };