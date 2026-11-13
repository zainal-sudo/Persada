// =============================================================
// Migrasi master data: cetar (pg_*) → ampersada (t*)
//   pg_gudang       → tgudang
//   pg_product      → tbarang (+ tkategori dari golongan_produk)
//   pg_jenis_outlet → tgolongancustomer
//   pg_outlet       → tcustomer  (rayon = pg_outlet_area → pg_area)
//   pg_supplier     → tsupplier
//   pg_area         → tsalesman
// Cabang: AM
// Jalankan: node sql/migrasi_cetar_ke_ampersada.js  (dari folder Backend)
// Idempoten: tabel target di-TRUNCATE dulu (kosongkan hasil migrasi lama).
// =============================================================
const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const CABANG = "AM";

const cleanKode = (s, max) => {
  let c = String(s || "").replace(/\s*\(\s*OTC\s*\)\s*$/i, "").trim();
  if (c.length > max) c = c.replace(/[^A-Za-z0-9]/g, "").slice(0, max);
  return c;
};

// dedupe sederhana: kalau tabrakan, tambahkan angka (kode tetap <= max 10)
const makeUnique = (pairs) => {
  const used = new Set();
  const res = new Map();
  for (const { orig, kode } of pairs) {
    let k = String(kode).slice(0, 10);
    if (used.has(k)) {
      let i = 2, cand;
      do { cand = (k.slice(0, 10 - String(i).length) + i); i++; } while (used.has(cand) && i < 1000);
      k = cand;
    }
    used.add(k);
    res.set(orig, k);
  }
  return res;
};

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    connectTimeout: 10000, multipleStatements: false,
  });

  const load = async (db, t, cols) => {
    const [rows] = await c.query(`SELECT ${cols} FROM \`${db}\`.\`${t}\``);
    return rows;
  };
  const trunc = async (db, t) => { await c.query(`TRUNCATE TABLE \`${db}\`.\`${t}\``); };
  const insertBatch = async (db, t, cols, rows, chunk = 300) => {
    let n = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk);
      const ph = "(" + cols.map(() => "?").join(",") + ")";
      const sql = `INSERT INTO \`${db}\`.\`${t}\` (${cols.join(",")}) VALUES ${part.map(() => ph).join(",")}`;
      await c.query(sql, part.flat());
      n += part.length;
    }
    return n;
  };
  const left = (s, n) => (s == null ? "" : String(s)).slice(0, n);
  const num = (v) => (v == null || v === "" ? 0 : Number(v));

  try {
    // ── 0) tcabang: pastikan cabang AM ada ────────────────────────────
    await c.query(
      `INSERT INTO ampersada.tcabang (cbg_kode, cbg_nama, cbg_aktif, cbg_database)
       SELECT ?, 'AM PERSADA', 1, 'ampersada'
        WHERE NOT EXISTS (SELECT 1 FROM ampersada.tcabang WHERE cbg_kode = ?)`,
      [CABANG, CABANG],
    );
    console.log("tcabang: OK (kode", CABANG + ")");

    // ── 1) pg_gudang → tgudang ────────────────────────────────────────
    const gudang = await load("cetar", "pg_gudang", "id, nama_gudang, alamat");
    await trunc("ampersada", "tgudang");
    const gudRows = gudang.map(g => [
      ("GDG" + String(g.id).padStart(3, "0")).slice(0, 10),
      left(g.nama_gudang, 30), "", left(g.alamat, 30),
    ]);
    console.log("tgudang:", await insertBatch("ampersada", "tgudang",
      ["gdg_kode", "gdg_nama", "gdg_penanggungjawab", "gdg_keterangan"], gudRows), "baris");

    // ── 2) tkategori ← distinct golongan_produk ───────────────────────
    const produk = await load("cetar", "pg_product",
      "id, nama_produk, jenis_satuan, golongan_produk, merk, harga_jual_default, catalog_price, created_at, kode_produk_jadi");
    const golongan = [...new Set(produk.map(p => p.golongan_produk || "LAIN-LAIN"))];
    const ktgMap = makeUnique(golongan.map(g => ({ orig: g, kode: cleanKode(g, 10) })));
    await trunc("ampersada", "tkategori");
    const ktgRows = golongan.map(g => [ktgMap.get(g), left(g, 30), 1]);
    console.log("tkategori:", await insertBatch("ampersada", "tkategori",
      ["ktg_kode", "ktg_nama", "ktg_tingkat"], ktgRows), "baris");

    // ── 3) pg_product → tbarang ───────────────────────────────────────
    await trunc("ampersada", "tbarang");
    const brgRows = produk.map(p => [
      p.id, left(p.nama_produk, 100), left(p.jenis_satuan, 10),
      ktgMap.get(p.golongan_produk || "LAIN-LAIN"),
      0, "", 1, 1, 0,                       // gr, gdg_default, isstok, isexpired, stok
      num(p.catalog_price), num(p.harga_jual_default),
      0, 0,                                  // min/max stok
      p.created_at, p.created_at, "MIG", "MIG",
      "", 1, 0, left(p.merk, 20), 0,        // sup_kode, isaktif, disc_sales, merk, isproductfocus
      0, left(p.divisi || "", 100), 0, 0,    // lastcost, divisi, isboom, insentif
      0, left(p.kode_produk_jadi || "", 20), 0, null, null, // harga_min, kodelama, isn3, tgl
    ]);
    console.log("tbarang:", await insertBatch("ampersada", "tbarang",
      ["brg_kode", "brg_nama", "brg_satuan", "brg_ktg_kode", "brg_gr_kode",
       "brg_gdg_default", "brg_isstok", "brg_isexpired", "brg_stok",
       "brg_hrgbeli", "brg_hrgjual", "brg_MIN_STOK", "brg_MAX_STOK",
       "date_create", "date_modified", "user_create", "user_modified",
       "brg_sup_kode", "brg_isaktif", "brg_disc_sales", "brg_merk", "brg_isproductfocus",
       "brg_lastcost", "brg_divisi", "brg_isboom", "brg_insentif",
       "brg_harga_min", "brg_kodelama", "brg_isn3", "brg_tanggal_beli", "brg_tanggal_in"],
      brgRows), "baris");

    // ── 4) pg_jenis_outlet → tgolongancustomer ────────────────────────
    const jenis = await load("cetar", "pg_jenis_outlet", "id, jenis_outlet");
    const jcByNama = new Map(jenis.map(j => [String(j.jenis_outlet).trim(), "JC" + String(j.id).padStart(3, "0")]));
    await trunc("ampersada", "tgolongancustomer");
    const gcRows = jenis.map(j => ["JC" + String(j.id).padStart(3, "0"), left(j.jenis_outlet, 100)]);
    console.log("tgolongancustomer:", await insertBatch("ampersada", "tgolongancustomer",
      ["gc_kode", "gc_nama"], gcRows), "baris");

    // ── 5) pg_area → tsalesman ────────────────────────────────────────
    const area = await load("cetar", "pg_area", "id, kode_area, nama_area");
    const slsMap = makeUnique(area.map(a => ({ orig: a, kode: cleanKode(a.kode_area, 10) })));
    await trunc("ampersada", "tsalesman");
    const slsRows = area.map(a => [
      slsMap.get(a), left(a.nama_area, 50), "", "", "",
      null, null, null, "MIG", "MIG", CABANG, 0, 1,
    ]);
    console.log("tsalesman:", await insertBatch("ampersada", "tsalesman",
      ["sls_kode", "sls_nama", "sls_alamat", "sls_kota", "sls_telp", "sls_tglmasuk",
       "date_create", "date_modified", "user_create", "user_modified", "sls_cabang", "sls_insentif", "sls_isaktif"],
      slsRows), "baris");

    // ── 6) pg_supplier → tsupplier ────────────────────────────────────
    const supplier = await load("cetar", "pg_supplier",
      "id, nama_supplier, telepon, email, no_npwp, kode_supplier, kota, alamat, masa_kredit, created_at");
    const supMap = makeUnique(supplier.map(s => ({ orig: s, kode: cleanKode(s.kode_supplier, 10) })));
    await trunc("ampersada", "tsupplier");
    const supRows = supplier.map(s => [
      supMap.get(s), left(s.nama_supplier, 50), left(s.alamat, 200), left(s.kota, 20),
      "", left(s.telepon, 20), "", 0, num(s.masa_kredit),
      "", "", "", CABANG, s.created_at, s.created_at, "MIG", "MIG", left(s.email, 40), 0,
    ]);
    console.log("tsupplier:", await insertBatch("ampersada", "tsupplier",
      ["Sup_kode", "Sup_nama", "Sup_alamat", "Sup_kota", "Sup_fax", "Sup_telp", "Sup_CP",
       "Sup_hutang", "Sup_top", "sup_bank", "sup_rekening", "sup_atasnama", "sup_cabang",
       "date_create", "date_modified", "user_create", "user_modified", "sup_email", "sup_internal"],
      supRows), "baris");

    // ── 7) pg_outlet → tcustomer ──────────────────────────────────────
    const outlet = await load("cetar", "pg_outlet",
      "id, nama_outlet, jenis_outlet, alamat, kota, telepon, no_npwp, tempo, kode_outlet, created_at");
    const oa = await load("cetar", "pg_outlet_area", "id_outlet, id_area");
    const areaById = new Map(area.map(a => [a.id, a]));
    const rayByOutlet = new Map();
    for (const m of oa) {
      const a = areaById.get(m.id_area);
      if (a) rayByOutlet.set(m.id_outlet, slsMap.get(a));
    }
    await trunc("ampersada", "tcustomer");
    const cusRows = outlet.map(o => [
      left(o.kode_outlet, 20), left(o.nama_outlet, 70), left(o.alamat, 200),
      left(o.kota, 20), "", left(o.telepon, 20), "",
      "", 0, jcByNama.get(String(o.jenis_outlet || "").trim()) || "",
      num(o.tempo), "", left(o.no_npwp, 100), "", "", "",
      o.created_at, o.created_at, "MIG", "MIG", CABANG, "", 0, rayByOutlet.get(o.id) || "",
    ]);
    console.log("tcustomer:", await insertBatch("ampersada", "tcustomer",
      ["Cus_kode", "Cus_nama", "Cus_alamat", "Cus_kota", "Cus_fax", "Cus_telp", "Cus_CP",
       "cus_email", "Cus_piutang", "cus_jc_kode", "cus_top", "cus_shipaddress", "cus_npwp",
       "cus_namanpwp", "cus_alamatnpwp", "cus_kotanpwp",
       "date_create", "date_modified", "user_create", "user_modified", "cus_cabang",
       "cus_gc_kode", "cus_locked", "cus_ray_kode"],
      cusRows, 200), "baris");

    // ── 8) Verifikasi ─────────────────────────────────────────────────
    for (const t of ["tgudang", "tkategori", "tbarang", "tgolongancustomer", "tsalesman", "tsupplier", "tcustomer"]) {
      const [r] = await c.query(`SELECT COUNT(*) c FROM ampersada.${t}`);
      console.log("VERIFIKASI", t, "=", r[0].c);
    }
    const [chk] = await c.query(
      `SELECT (SELECT COUNT(*) FROM ampersada.tcustomer t LEFT JOIN ampersada.tsalesman s
                ON t.cus_ray_kode=s.sls_kode AND s.sls_cabang=t.cus_cabang
               WHERE t.cus_ray_kode<>'' AND s.sls_kode IS NULL) ray_lost,
              (SELECT COUNT(*) FROM ampersada.tcustomer WHERE cus_jc_kode='' OR cus_jc_kode IS NULL) jc_kosong,
              (SELECT COUNT(*) FROM ampersada.tbarang b LEFT JOIN ampersada.tkategori k ON b.brg_ktg_kode=k.ktg_kode
               WHERE k.ktg_kode IS NULL) ktg_lost`);
    console.log("INTEGRITAS:", JSON.stringify(chk[0]));
    console.log("SELESAI");
  } catch (e) {
    console.error("GAGAL:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
