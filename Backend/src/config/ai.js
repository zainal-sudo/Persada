// config/ai.js
// Konfigurasi AI Assistant (9Router). Key diambil dari env, jangan hardcode.
require("dotenv").config();

const parseKodes = (val, def) =>
  (val || def)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

// Tiga daftar terpisah (jangan digabung — tiap kebijakan beda):
//  - AI (widget + endpoint): FINANCE, OWNER, MGR
//  - HPP/Margin/Lastcost: FINANCE saja
//  - Ganti cabang (Pusat): FINANCE, OWNER
const aiAllowedKodes = parseKodes(process.env.AI_ALLOWED_KODES, "FINANCE,OWNER,MGR");
const financeKodes = parseKodes(process.env.FINANCE_ALLOWED_KODES, "FINANCE");
const branchKodes = parseKodes(process.env.BRANCH_ALLOWED_KODES, "FINANCE,OWNER");

const up = (user) => String(user?.kode || "").toUpperCase();

module.exports = {
  routerUrl: process.env.NINEROUTER_URL || "http://localhost:20128",
  routerKey: process.env.NINEROUTER_KEY || "",
  model: process.env.AI_MODEL || "bsmchat",
  maxTokens: Number(process.env.AI_MAX_TOKENS) || 1024,
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 90000,
  // 0 = jawaban deterministik (laporan, bukan improvisasi).
  temperature: Number(process.env.AI_TEMPERATURE ?? 0),
  // Token saver 9Router (RTK) di-bypass agar angka laporan tetap presisi.
  bypassTokenSaver: true,
  // Mode agen (function calling). Matikan dengan AI_AGENT=off → pipeline lama.
  agentEnabled: (process.env.AI_AGENT || "on") !== "off",
  agentMaxIter: Number(process.env.AI_AGENT_MAX_ITER) || 8,
  agentModel: process.env.AI_AGENT_MODEL || "",
  aiAllowedKodes,
  financeKodes,
  branchKodes,
  // Akses widget/endpoint AI.
  isAiUser: (user) => aiAllowedKodes.includes(up(user)),
  // Akses HPP/Margin/Lastcost (dipakai laporan & AI tool).
  isFinanceUser: (user) => financeKodes.includes(up(user)),
  // Boleh memilih cabang Pusat.
  isBranchUser: (user) => branchKodes.includes(up(user)),
};