#!/usr/bin/env node
// Naikkan versi rilis dan tulis catatan rilisnya dalam satu langkah.
//
//   npm run release -- patch "catatan 1" "catatan 2"
//   npm run release -- minor "catatan 1"
//   npm run release -- 1.2.0 "catatan 1"
//
// Versi dan catatan rilis hidup di src/config/changelog.json (sumber tunggal).
// Skrip ini juga menyamakan "version" di package.json + package-lock.json BE dan
// FE, supaya tidak ada lagi versi yang tertinggal sendiri saat dirilis.

const fs = require("fs");
const path = require("path");

const CONFIG = path.join(__dirname, "..", "src", "config", "changelog.json");
const MIRRORS = [
  path.join(__dirname, "..", "package.json"),
  path.join(__dirname, "..", "package-lock.json"),
  path.join(__dirname, "..", "..", "FE-Krm", "package.json"),
  path.join(__dirname, "..", "..", "FE-Krm", "package-lock.json"),
];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, data) => fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);

const parse = (v) =>
  String(v || "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

const compare = (a, b) => {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
};

const usage =
  "Pakai: npm run release -- <patch|minor|major|versi> \"catatan 1\" [\"catatan 2\" ...]";

const fail = (msg) => {
  console.error(`\n${msg}\n${usage}\n`);
  process.exit(1);
};

const [bump, ...notes] = process.argv.slice(2);

if (!bump || bump === "-h" || bump === "--help") {
  console.log(`\n${usage}\n`);
  process.exit(bump ? 0 : 1);
}

if (notes.length === 0) {
  fail("Catatan rilis wajib diisi, karena inilah yang dibaca user saat versi naik.");
}

const cfg = readJson(CONFIG);
if (!Array.isArray(cfg.history)) cfg.history = [];

const known = cfg.history.map((e) => String(e.version));
const current = known.length ? known.slice().sort(compare).pop() : "0.0.0";

let next;
if (["patch", "minor", "major"].includes(bump)) {
  const [maj, min, pat] = parse(current);
  next = { major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[bump];
} else {
  if (!/^\d+\.\d+\.\d+$/.test(bump)) fail(`Versi "${bump}" tidak valid, pakai format x.y.z.`);
  if (compare(bump, current) <= 0) fail(`Versi ${bump} harus lebih tinggi dari ${current}.`);
  next = bump;
}

if (known.includes(next)) fail(`Versi ${next} sudah ada di changelog.json.`);

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
  now.getDate(),
).padStart(2, "0")}`;

const entry = { version: next, date: today, notes };
cfg.history.push(entry);
writeJson(CONFIG, cfg);

const mirrored = [];
for (const file of MIRRORS) {
  if (!fs.existsSync(file)) continue;
  const json = readJson(file);
  json.version = next;
  // package-lock menyimpan versi paket root di dua tempat.
  if (json.packages && json.packages[""] && json.packages[""].version) {
    json.packages[""].version = next;
  }
  writeJson(file, json);
  mirrored.push(path.relative(process.cwd(), file));
}

console.log(`\nVersi ${current} -> ${next} (${today})`);
notes.forEach((n) => console.log(`  - ${n}`));
console.log(`\nDiperbarui: src/config/changelog.json`);
mirrored.forEach((f) => console.log(`            ${f}`));
console.log("");
