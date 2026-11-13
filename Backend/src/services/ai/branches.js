// services/ai/branches.js
// Mode single-database (krm): hanya satu cabang, tanpa pembacaan tcabang.
const db = require("../../config/database");

const DB_NAME = () => process.env.DB_NAME || "krm";

const BRANCH = {
  kode: DB_NAME(),
  nama: "AM PERSADA",
  dbase: DB_NAME(),
  reachable: true,
};

// Daftar cabang (selalu satu).
async function listBranches() {
  return [BRANCH];
}

// Pure: cocokkan key (kode / nama / dbase) → cabang, atau null.
function resolveBranch(list, key) {
  if (!key) return null;
  const k = String(key).trim().toLowerCase();
  return (
    list.find(
      (b) =>
        String(b.kode).toLowerCase() === k ||
        String(b.nama).toLowerCase() === k ||
        String(b.dbase).toLowerCase() === k,
    ) || null
  );
}

// Jalankan fn pada database aktif (single-database).
async function branchRun(key, fn) {
  if (!key) return fn();
  const list = await listBranches();
  const b = resolveBranch(list, key);
  if (!b)
    throw new Error(
      `Cabang '${key}' tidak dikenal. Cabang yang tersedia: ${list.map((x) => x.nama).join(", ")}.`,
    );
  return db.run(b.dbase, fn);
}

// Satu baris per cabang untuk prompt model.
function branchSummary(list, currentDbase) {
  return list
    .map((b) => `${b.nama} (kode ${b.kode}, cabang Anda)`)
    .join("; ");
}

module.exports = { listBranches, resolveBranch, branchRun, branchSummary };
