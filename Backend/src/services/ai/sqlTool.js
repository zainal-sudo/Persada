// services/ai/sqlTool.js
// Tool sql_readonly untuk agent: LLM boleh mengajukan SELECT tunggal terhadap
// database cabang. Guard utama = validator ini (fail-closed). Hardening lebih
// kuat: ponytail: masih pakai kredensial app (root) — buat user MySQL khusus
// GRANT SELECT + pool terpisah (env AI_DB_USER/AI_DB_PASSWORD) bila mau guard
// level DB.
const db = require("../../config/database");
const aiCfg = require("../../config/ai");
const branches = require("./branches");

const MAX_LEN = 4000;
const MAX_ROWS = 200;
// I/O MySQL dev ini lambat (full scan puluhan detik) — 5 dtk terlalu mepet.
// ponytail: 20 dtk kompromi UX; index di FP_jthtempo akan membuat ini instan.
const TIMEOUT_MS = 20_000;

// Kolom keuangan sensitif — diblok untuk non-FINANCE (fail-closed).
const SENSITIVE_RE = /\b(hpp|hpp_avg|margin|harga_pokok|harga_beli|lastcost|profit)\b/i;

const FORBIDDEN_RE =
  /\b(insert|update|delete|drop|alter|create|truncate|rename|grant|revoke|call|lock|unlock|handler|load|shutdown|kill|optimize|repair|install|uninstall|purge|reset|set|use|into|outfile|dumpfile|prepare|execute)\b/i;

const SCHEMA_RE = /\b(information_schema|performance_schema|mysql|sys)\b/i;

// Buang string literal, komentar, dan backtick agar cek keyword tidak kena
// false positive dari isi data (mis. WHERE nama LIKE '%delete%').
function stripLiterals(sql) {
  return String(sql)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

// Pure + testable: balik { sql } bila valid, { error } bila ditolak.
function validateSql(raw, isFinance = false) {
  if (typeof raw !== "string" || !raw.trim()) return { error: "SQL kosong." };
  if (raw.length > MAX_LEN) return { error: `SQL terlalu panjang (maks ${MAX_LEN} karakter).` };

  const clean = stripLiterals(raw);
  const noTrail = clean.replace(/;\s*$/, "").trim();

  if (!/^(select|with)\b/i.test(noTrail))
    return { error: "Hanya statement SELECT/WITH yang diizinkan." };
  if (noTrail.includes(";")) return { error: "Hanya satu statement yang diizinkan." };

  const forbidden = noTrail.match(FORBIDDEN_RE);
  if (forbidden) return { error: `Keyword tidak diizinkan: ${forbidden[0]}.` };
  const schema = noTrail.match(SCHEMA_RE);
  if (schema) return { error: `Akses ke schema '${schema[0]}' tidak diizinkan.` };
  if (!isFinance) {
    const sens = noTrail.match(SENSITIVE_RE);
    if (sens) return { error: `Kolom '${sens[0]}' hanya tersedia untuk user FINANCE.` };
  }

  // LIMIT wajib — maksimal MAX_ROWS baris.
  const limits = [...noTrail.matchAll(/\blimit\s+(\d+)\b/gi)];
  for (const l of limits) {
    if (Number(l[1]) > MAX_ROWS)
      return { error: `LIMIT maksimal ${MAX_ROWS} baris.` };
  }
  let sql = raw.trim().replace(/;\s*$/, "");
  if (!limits.length) sql += ` LIMIT ${MAX_ROWS}`;

  return { sql };
}

// Eksekusi query read-only. dbKey kosong = cabang aktif (ALS dari middleware);
// diisi = cabang lain (routing via branches).
async function run(raw, user = {}, dbKey) {
  const isFinance = aiCfg.isFinanceUser(user);
  const v = validateSql(raw, isFinance);
  if (v.error) throw new Error(v.error);
  return branches.branchRun(dbKey, async () => {
    const [rows] = await db.query({ sql: v.sql, timeout: TIMEOUT_MS }, []);
    const list = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    return { rowCount: list.length, rows: list };
  });
}

module.exports = { validateSql, run, SENSITIVE_RE };
