/**
 * Migrasi data transaksi: cetar -> ampersada (rentang tanggal via argumen)
 *
 * Pemakaian: node migrasi_trx_cetar_okt2026.js [awal] [akhir]
 *   default: 2026-10-01 .. 2026-11-01 ( Oktober 2026)
 *   contoh:  node migrasi_trx_cetar_okt2026.js 2026-06-01 2026-10-01
 *
 * PEMBELIAN: cetar.pg_pembelian (+ pg_pembelian_konsinyasi) -> tpo_hdr/dtl (derivatif),
 *   tbpb_hdr/dtl (derivatif), tinv_hdr/dtl
 * PENJUALAN: cetar.pg_penjualan + pg_penjualan_btj + pg_penjualan_otc -> tfp_hdr/dtl
 *   cetar.pg_master_delivery_order + pg_detail_delivery_order -> tdo_hdr/dtl + tso_hdr/dtl (derivatif)
 *
 * Nomor dokumen derivatif (unik & traceable):
 *   BL-2610-00001 -> PO-2610-00001 / BPB-2610-00001
 *   TB-2610-00001 -> POK-2610-00001 / BPBK-2610-00001 (konsinyasi)
 *   DO-2610-00001 -> SO-2610-00001
 *
 * Idempoten: baris migrasi lama (user_create='MIG') DALAM RENTANG tanggal yang dihapus dulu;
 * data manual user tidak disentuh.
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const CABANG = 'AM';
const args = process.argv.slice(2);
const OKT_AWAL = args[0] || '2026-10-01';
const OKT_AKHIR = args[1] || '2026-11-01'; // exclusive

// replikasi persis logika migrasi master (cleanKode + makeUnique) agar map Sup_kode cocok
const cleanKodeOld = (s, max) => {
  let k = String(s || '').replace(/\s*\(\s*OTC\s*\)\s*$/i, '').trim();
  if (k.length > max) k = k.replace(/[^A-Za-z0-9]/g, '').slice(0, max);
  return k;
};
const makeUniqueOld = (pairs) => {
  const used = new Set();
  const res = new Map();
  for (const { orig, kode } of pairs) {
    let k = String(kode).slice(0, 10);
    if (used.has(k)) {
      let i = 2, cand;
      do { cand = k.slice(0, 10 - String(i).length) + i; i++; } while (used.has(cand) && i < 1000);
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
    database: process.env.DB_NAME, connectTimeout: 20000,
    charset: 'utf8mb4',
  });
  const q = async (sql, p) => { const [r] = await c.query(sql, p); return r; };

  async function insertBatch(table, cols, rows, chunk = 300) {
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk);
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const sql = `INSERT INTO \`${process.env.DB_NAME}\`.\`${table}\` (${cols.join(',')}) VALUES ${part.map(() => ph).join(',')}`;
      try {
        await c.query(sql, part.flat());
      } catch (e) {
        e.message = `${table} chunk@${i}: ${e.message}`;
        throw e;
      }
    }
  }

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const expDate = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s + '-01';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  };

  // ── Idempoten: hapus baris migrasi lama (user_create='MIG') ──
  const TRX_TABLES = [
    ['tpo_hdr', 'tpo_dtl', 'pod_po_nomor', 'po_nomor', 'po_tanggal'],
    ['tbpb_hdr', 'tbpb_dtl', 'bpbd_bpb_nomor', 'bpb_nomor', 'bpb_tanggal'],
    ['tinv_hdr', 'tinv_dtl', 'invd_inv_nomor', 'inv_nomor', 'inv_tanggal'],
    ['tso_hdr', 'tso_dtl', 'sod_so_nomor', 'so_nomor', 'so_tanggal'],
    ['tdo_hdr', 'tdo_dtl', 'dod_do_nomor', 'do_nomor', 'do_tanggal'],
    ['tfp_hdr', 'tfp_dtl', 'FPd_FP_nomor', 'FP_nomor', 'FP_tanggal'],
  ];
  for (const [hdr, dtl, dtlFk, hdrPk, tanggalCol] of TRX_TABLES) {
    const old = await q(
      `SELECT ${hdrPk} k FROM \`${hdr}\` WHERE user_create='MIG' AND ${tanggalCol} >= ? AND ${tanggalCol} < ?`,
      [OKT_AWAL, OKT_AKHIR]
    );
    if (old.length) {
      const ks = old.map((o) => o.k);
      for (let i = 0; i < ks.length; i += 300) {
        const part = ks.slice(i, i + 300);
        await q(`DELETE FROM \`${dtl}\` WHERE ${dtlFk} IN (?)`, [part]);
      }
      await q(
        `DELETE FROM \`${hdr}\` WHERE user_create='MIG' AND ${tanggalCol} >= ? AND ${tanggalCol} < ?`,
        [OKT_AWAL, OKT_AKHIR]
      );
    }
  }

  // ── Map master ──
  const prodSatuan = {};
  for (const r of await q('SELECT brg_kode, brg_satuan FROM tbarang')) prodSatuan[r.brg_kode] = r.brg_satuan || 'PCS';
  const supplierRows = await q('SELECT id, nama_supplier, telepon, email, no_npwp, kode_supplier, kota, alamat, masa_kredit, created_at FROM cetar.pg_supplier ORDER BY id');
  const supUnique = makeUniqueOld(supplierRows.map((s) => ({ orig: s, kode: cleanKodeOld(s.kode_supplier, 10) })));
  const supKodeById = {};
  for (const s of supplierRows) supKodeById[s.id] = supUnique.get(s);
  const outletKodeById = {};
  for (const r of await q('SELECT id, kode_outlet FROM cetar.pg_outlet')) outletKodeById[r.id] = r.kode_outlet;
  // salesman per outlet: pg_outlet_area -> pg_area -> tsalesman (kode dedupe replikasi migrasi master)
  const areaRows = await q('SELECT id, kode_area, nama_area FROM cetar.pg_area ORDER BY id');
  const slsUnique = makeUniqueOld(areaRows.map((a) => ({ orig: a, kode: cleanKodeOld(a.kode_area, 10) })));
  const slsKodeByAreaId = {};
  for (const a of areaRows) slsKodeByAreaId[a.id] = slsUnique.get(a);
  const slsKodeByOutletId = {};
  for (const r of await q('SELECT id_outlet, id_area FROM cetar.pg_outlet_area')) {
    if (!slsKodeByOutletId[r.id_outlet]) slsKodeByOutletId[r.id_outlet] = slsKodeByAreaId[r.id_area] || '';
  }
  // salesman (orang) per DO: pg_pof -> tsalesmanaktif
  const pofRows = await q('SELECT id, kode_pof, nama_pof, is_active FROM cetar.pg_pof ORDER BY id');
  const pofUnique = makeUniqueOld(pofRows.map((p) => ({ orig: p, kode: cleanKodeOld(p.kode_pof, 10) })));
  const pofKodeById = {};
  for (const p of pofRows) pofKodeById[p.id] = pofUnique.get(p);
  // seed tsalesmanaktif (INSERT IGNORE - baris manual user tidak disentuh)
  for (const p of pofRows) {
    const kode = pofKodeById[p.id];
    const nama = String(p.nama_pof || '').slice(0, 50);
    await q(`INSERT IGNORE INTO tsalesmanaktif (sla_kode, sla_nama, sla_sls_kode, sla_isaktif, sla_tgl_masuk) VALUES (?, ?, '', ?, NULL)`, [kode, nama, p.is_active === 1 ? 1 : 0]);
  }
  const gudangByNama = {};
  for (const r of await q('SELECT gdg_kode, gdg_nama FROM tgudang')) gudangByNama[r.gdg_nama.trim().toUpperCase()] = r.gdg_kode;
  const gdgKode = (nama) => gudangByNama[String(nama || '').trim().toUpperCase()] || '';
  const warnGudang = (nama) => { if (!gdgKode(nama)) gudangAsing.add(String(nama || '')); };
  const gudangAsing = new Set();

  // ─────────────────────────────────────────────────────────────
  // PEMBELIAN
  // ─────────────────────────────────────────────────────────────
  const beliRows = await q(`
    SELECT id, no_faktur, no_faktur_supplier,
           DATE_FORMAT(tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(tgl_jatuh_tempo,'%Y-%m-%d') jth,
           id_produk, jumlah_produk, harga_produk, diskon_1, ppn,
           harga_total_ppn, lokasi_gudang, catatan, batch, exp_date,
           id_supplier, status_bayar, total_tagihan_faktur, total_tagihan_terbayar,
           created_at, author, 0 is_konsinyasi
    FROM cetar.pg_pembelian WHERE tgl_nota >= ? AND tgl_nota < ?
    UNION ALL
    SELECT id, no_faktur, no_faktur_supplier,
           DATE_FORMAT(tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(tgl_jatuh_tempo,'%Y-%m-%d') jth,
           id_produk, jumlah_produk, harga_produk, diskon_1, ppn,
           harga_total_ppn, lokasi_gudang, catatan, batch, exp_date,
           id_supplier, status_bayar, total_tagihan_faktur, total_tagihan_terbayar,
           created_at, author, 1 is_konsinyasi
    FROM cetar.pg_pembelian_konsinyasi WHERE tgl_nota >= ? AND tgl_nota < ?
    ORDER BY created_at, id`, [OKT_AWAL, OKT_AKHIR, OKT_AWAL, OKT_AKHIR]);

  const beliByFaktur = new Map();
  for (const r of beliRows) {
    if (!beliByFaktur.has(r.no_faktur)) beliByFaktur.set(r.no_faktur, { head: r, lines: [] });
    beliByFaktur.get(r.no_faktur).lines.push(r);
  }

  const nomorPO = (f) => f.replace(/^(BL|TB)-/, (f.startsWith('TB-') ? 'POK' : 'PO') + '-');
  const nomorBPB = (f) => f.replace(/^(BL|TB)-/, (f.startsWith('TB-') ? 'BPBK' : 'BPB') + '-');

  const poHdr = [], poDtl = [], bpbHdr = [], bpbDtl = [], invHdr = [], invDtl = [];
  for (const [faktur, g] of beliByFaktur) {
    const h = g.head;
    const noPO = nomorPO(faktur), noBPB = nomorBPB(faktur);
    const sup = supKodeById[h.id_supplier] || '';
    warnGudang(h.lokasi_gudang);
    const amount = num(h.total_tagihan_faktur) || g.lines.reduce((s, l) => s + num(l.harga_total_ppn), 0);
    const tax = g.lines.reduce((s, l) => s + num(l.ppn), 0);
    const istax = tax > 0 ? 1 : 0;
    poHdr.push([noPO, h.tanggal, sup, String(h.catatan || '').slice(0, 100), istax, 1, 0, amount, tax, h.created_at, h.created_at, 'MIG', '', 0, null, '']);
    // PK tpo_dtl = (nomor, brg_kode): merge baris barang sama (qty dijumlah, harga rata-rata tertimbang)
    const poMap = new Map();
    for (const l of g.lines) {
      const key = String(l.id_produk);
      if (!poMap.has(key)) poMap.set(key, { produk: l.id_produk, satuan: prodSatuan[l.id_produk] || 'PCS', disc: num(l.diskon_1), qty: 0, hargaT: 0 });
      const e = poMap.get(key);
      e.qty += num(l.jumlah_produk);
      e.hargaT += num(l.jumlah_produk) * num(l.harga_produk);
    }
    let poNo = 1;
    const hargaByProduk = new Map();
    const discByProduk = new Map();
    for (const e of poMap.values()) {
      poDtl.push([noPO, e.produk, e.satuan, e.qty, e.qty, e.disc, e.qty ? e.hargaT / e.qty : 0, 1, '', 1, poNo++, '-']);
      hargaByProduk.set(String(e.produk), e.qty ? e.hargaT / e.qty : 0);
      discByProduk.set(String(e.produk), e.disc);
    }
    // PK tbpb_dtl / tinv_dtl = (nomor, brg_kode, expired): merge per barang+expired
    const bpbMap = new Map();
    for (const l of g.lines) {
      const exp = expDate(l.exp_date);
      const key = l.id_produk + '|' + (exp || '');
      if (!bpbMap.has(key)) bpbMap.set(key, { produk: l.id_produk, satuan: prodSatuan[l.id_produk] || 'PCS', exp, qty: 0, batch: String(l.batch || '') });
      bpbMap.get(key).qty += num(l.jumlah_produk);
    }
    let invNo = 1;
    for (const e of bpbMap.values()) {
      bpbDtl.push([noBPB, e.produk, e.satuan, e.qty, e.exp, invNo, 0, e.batch]);
      invDtl.push([faktur, e.produk, e.satuan, e.qty, hargaByProduk.get(String(e.produk)) ?? 0, discByProduk.get(String(e.produk)) ?? 0, invNo, e.exp, 0, e.batch]);
      invNo++;
    }
    bpbHdr.push([noBPB, h.tanggal, noPO, String(h.catatan || '').slice(0, 100), gdgKode(h.lokasi_gudang), 1, h.created_at, h.created_at, 'MIG', '']);
    invHdr.push([faktur, h.tanggal, noBPB, h.jth, sup, String(h.catatan || '').slice(0, 100), istax, 0, 0, amount, tax, num(h.total_tagihan_terbayar), String(h.status_bayar || '').toUpperCase() === 'LUNAS' ? 1 : 0, h.created_at, h.created_at, 'MIG', '', 0, String(h.no_faktur_supplier || '').slice(0, 40), istax, '', null]);
  }

  // asersi nomor unik
  const dupCheck = (arr, name) => {
    const set = new Set();
    for (const r of arr) {
      if (set.has(r[0])) throw new Error(`${name} nomor dobel: ${r[0]}`);
      set.add(r[0]);
    }
  };
  dupCheck(poHdr, 'tpo'); dupCheck(bpbHdr, 'tbpb'); dupCheck(invHdr, 'tinv');

  if (gudangAsing.size) console.log('GUDANG TIDAK DIKENAL (pembelian):', [...gudangAsing].join(' | '));

  await insertBatch('tpo_hdr', ['po_nomor','po_tanggal','po_sup_kode','po_memo','po_istax','po_isclosed','po_disc_fakturpr','po_amount','po_taxamount','date_create','date_modified','user_create','user_modified','po_status_rec','po_dateline','po_pemesan'], poHdr);
  await insertBatch('tpo_dtl', ['pod_po_nomor','pod_brg_kode','pod_brg_satuan','pod_qty','pod_qty_terima','pod_discpr','pod_harga','pod_isterima','pod_keterangan','pod_isclosed','pod_nourut','brg_kode_lama'], poDtl);
  await insertBatch('tbpb_hdr', ['bpb_nomor','bpb_tanggal','bpb_po_nomor','bpb_memo','bpb_gdg_kode','bpb_isinvoice','date_create','date_modified','user_create','user_modified'], bpbHdr);
  await insertBatch('tbpb_dtl', ['bpbd_bpb_nomor','bpbd_brg_kode','bpbd_brg_satuan','bpbd_qty','bpbd_tgl_expired','bpbd_nourut','bpbd_status','bpbd_idbatch'], bpbDtl);
  await insertBatch('tinv_hdr', ['inv_nomor','inv_tanggal','inv_bpb_nomor','inv_jthtempo','inv_sup_kode','inv_memo','inv_istax','inv_disc_fakturpr','inv_disc_faktur','inv_amount','inv_taxamount','inv_bayar','inv_isbayar','date_create','date_modified','user_create','user_modified','inv_freight','inv_nobukti','inv_ispajak','inv_nopajak','inv_tglbukti'], invHdr);
  await insertBatch('tinv_dtl', ['invd_inv_nomor','invd_brg_kode','invd_brg_satuan','invd_qty','invd_harga','invd_discpr','invd_nourut','invd_expired','invd_otorisasi','invd_idbatch'], invDtl);
  console.log(`tpo: ${poHdr.length} faktur / ${poDtl.length} baris`);
  console.log(`tbpb: ${bpbHdr.length} faktur / ${bpbDtl.length} baris`);
  console.log(`tinv: ${invHdr.length} faktur / ${invDtl.length} baris`);

  // ─────────────────────────────────────────────────────────────
  // PENJUALAN: DO + SO (derivatif) + FP
  // ─────────────────────────────────────────────────────────────
  const doMasters = await q(`
    SELECT m.id, m.no_faktur, m.id_pof, m.id_outlet, m.author, m.catatan,
           DATE_FORMAT(m.tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(m.tgl_jatuh_tempo,'%Y-%m-%d') jth,
           m.sumber_gudang, m.status_bayar, m.nama_user, m.sales_invoice_no,
           m.created_at, m.last_updated, m.total_tagihan_faktur
    FROM cetar.pg_master_delivery_order m
    WHERE m.tgl_nota >= ? AND m.tgl_nota < ?
    ORDER BY m.created_at, m.id`, [OKT_AWAL, OKT_AKHIR]);
  const doDetails = await q(`
    SELECT d.id_delivery_order, d.id_produk, d.jenis_satuan, d.jumlah_produk,
           d.harga_jual, d.diskon_1, d.harga_total, d.batch, d.exp_date
    FROM cetar.pg_detail_delivery_order d
    JOIN cetar.pg_master_delivery_order m ON m.id = d.id_delivery_order
    WHERE m.tgl_nota >= ? AND m.tgl_nota < ?
    ORDER BY d.id`, [OKT_AWAL, OKT_AKHIR]);
  const doLinesBy = new Map();
  for (const d of doDetails) {
    if (!doLinesBy.has(d.id_delivery_order)) doLinesBy.set(d.id_delivery_order, []);
    doLinesBy.get(d.id_delivery_order).push(d);
  }

  const nomorSO = (doNo) => doNo.replace(/^DO-/, 'SO-');

  const soHdr = [], soDtl = [], doHdr = [], doDtl = [];
  const doByInvoice = new Map(); // sales_invoice_no -> no DO
  for (const m of doMasters) {
    const noSO = nomorSO(m.no_faktur);
    const isInvoice = String(m.status_bayar || '').toUpperCase().includes('DIFAKTURKAN') ? 1 : 0;
    const lines = doLinesBy.get(m.id) || [];
    warnGudang(m.sumber_gudang);
    const amount = num(m.total_tagihan_faktur) || lines.reduce((s, l) => s + num(l.harga_total), 0);
    soHdr.push([noSO, m.tanggal, String(m.catatan || '').slice(0, 100), outletKodeById[m.id_outlet] || '', '', slsKodeByOutletId[m.id_outlet] || '', pofKodeById[m.id_pof] || '', 0, 0, amount, 0, 0, 1, 1, m.jth, m.created_at, m.created_at, 'MIG', '', '', '', 0]);
    lines.forEach((l, i) => {
      soDtl.push([noSO, l.id_produk, l.jenis_satuan || prodSatuan[l.id_produk] || 'PCS', num(l.jumlah_produk), num(l.jumlah_produk), isInvoice ? num(l.jumlah_produk) : 0, num(l.diskon_1), num(l.harga_jual), 1, 1, i + 1, '', '-']);
    });
    doHdr.push([m.no_faktur, m.tanggal, noSO, outletKodeById[m.id_outlet] || '', '', String(m.catatan || '').slice(0, 100), gdgKode(m.sumber_gudang), isInvoice, m.created_at, m.last_updated || m.created_at, 'MIG', '', 0]);
    lines.forEach((l, i) => {
      doDtl.push([m.no_faktur, l.id_produk, l.jenis_satuan || prodSatuan[l.id_produk] || 'PCS', num(l.jumlah_produk), expDate(l.exp_date), i + 1, 0, isInvoice ? num(l.jumlah_produk) : 0, isInvoice, gdgKode(m.sumber_gudang), String(l.batch || '')]);
    });
    if (m.sales_invoice_no && !doByInvoice.has(m.sales_invoice_no)) {
      doByInvoice.set(m.sales_invoice_no, m.no_faktur);
    }
  }
  dupCheck(soHdr, 'tso'); dupCheck(doHdr, 'tdo');
  if (gudangAsing.size) console.log('GUDANG TIDAK DIKENAL:', [...gudangAsing].join(' | '));

  await insertBatch('tso_hdr', ['so_nomor','so_tanggal','so_memo','so_cus_kode','so_shipaddress','so_sls_kode','so_sla_kode','so_disc_faktur','so_disc_fakturpr','so_amount','so_taxamount','so_DP','so_iskirim','so_isclosed','so_jthtempo','date_create','date_modified','user_create','user_modified','so_rek_dp','so_nopesanan','so_isinvoice'], soHdr);
  await insertBatch('tso_dtl', ['sod_so_nomor','sod_brg_kode','sod_brg_satuan','sod_qty','sod_qty_kirim','sod_qty_invoice','sod_discpr','sod_harga','sod_iskirim','sod_isclosed','sod_nourut','sod_keterangan','brg_kode_lama'], soDtl);
  await insertBatch('tdo_hdr', ['do_nomor','do_tanggal','do_so_nomor','do_cus_Kode','do_shipaddress','do_memo','do_gdg_kode','do_isinvoice','date_create','date_modified','user_create','user_modified','do_iskembali'], doHdr);
  await insertBatch('tdo_dtl', ['dod_do_nomor','dod_brg_kode','dod_brg_satuan','dod_qty','dod_tgl_expired','dod_nourut','dod_status','dod_qty_invoice','dod_isclosed','dod_gdg_kode','dod_idbatch'], doDtl);
  console.log(`tso: ${soHdr.length} / ${soDtl.length} baris`);
  console.log(`tdo: ${doHdr.length} / ${doDtl.length} baris`);

  // FP dari 3 tabel penjualan
  const jualRows = await q(`
    SELECT id, no_faktur, id_produk, jumlah_produk, harga_jual, diskon_1, ppn,
           harga_total, hpp_asli, DATE_FORMAT(tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(tgl_jatuh_tempo,'%Y-%m-%d') jth, id_outlet, batch, exp_date,
           sumber_gudang, status_bayar, total_tagihan_faktur,
           total_tagihan_terbayar, catatan, created_at, author, 0 src
    FROM cetar.pg_penjualan WHERE tgl_nota >= ? AND tgl_nota < ?
    UNION ALL
    SELECT id, no_faktur, id_produk, jumlah_produk, harga_jual, diskon_1, ppn,
           harga_total, hpp_asli, DATE_FORMAT(tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(tgl_jatuh_tempo,'%Y-%m-%d') jth, id_outlet, batch, exp_date,
           sumber_gudang, status_bayar, total_tagihan_faktur,
           total_tagihan_terbayar, catatan, created_at, author, 1 src
    FROM cetar.pg_penjualan_btj WHERE tgl_nota >= ? AND tgl_nota < ?
    UNION ALL
    SELECT id, no_faktur, id_produk, jumlah_produk, harga_jual, diskon_1, ppn,
           harga_total, hpp_asli, DATE_FORMAT(tgl_nota,'%Y-%m-%d') tanggal,
           DATE_FORMAT(tgl_jatuh_tempo,'%Y-%m-%d') jth, id_outlet, batch, exp_date,
           sumber_gudang, status_bayar, total_tagihan_faktur,
           total_tagihan_terbayar, catatan, created_at, author, 2 src
    FROM cetar.pg_penjualan_otc WHERE tgl_nota >= ? AND tgl_nota < ?
    ORDER BY created_at, id`, [OKT_AWAL, OKT_AKHIR, OKT_AWAL, OKT_AKHIR, OKT_AWAL, OKT_AKHIR]);

  const fpByFaktur = new Map();
  for (const r of jualRows) {
    if (!fpByFaktur.has(r.no_faktur)) fpByFaktur.set(r.no_faktur, { head: r, lines: [] });
    fpByFaktur.get(r.no_faktur).lines.push(r);
  }

  const fpHdr = [], fpDtl = [];
  let noDOCount = 0;
  for (const [faktur, g] of fpByFaktur) {
    const h = g.head;
    const doNo = doByInvoice.get(faktur) || '';
    if (!doNo) noDOCount++;
    for (const l of g.lines) warnGudang(l.sumber_gudang);
    const amount = num(h.total_tagihan_faktur) || g.lines.reduce((s, l) => s + num(l.harga_total), 0);
    const tax = g.lines.reduce((s, l) => s + num(l.ppn), 0);
    const istax = tax > 0 ? 1 : 0;
    const lunas = String(h.status_bayar || '').toUpperCase() === 'LUNAS' ? 1 : 0;
    fpHdr.push([faktur, h.tanggal, doNo, h.jth, outletKodeById[h.id_outlet] || '', String(h.catatan || '').slice(0, 100), istax, 0, 0, 0, amount, tax, 0, num(h.total_tagihan_terbayar), lunas, h.created_at, h.created_at, 'MIG', '', 0, 0, 0, 0, 0, 0, lunas ? 'LUNAS' : 'BELUM LUNAS', 0, 0, 0, 0, 0, 0, 0, 0, doNo ? nomorSO(doNo) : '']);
    g.lines.forEach((l, i) => {
      fpDtl.push([faktur, l.id_produk, prodSatuan[l.id_produk] || 'PCS', num(l.jumlah_produk), num(l.harga_jual), num(l.diskon_1), i + 1, expDate(l.exp_date), 0, gdgKode(l.sumber_gudang), num(l.hpp_asli), 0, 0, String(l.batch || ''), 0, 0]);
    });
  }
  dupCheck(fpHdr, 'tfp');
  if (gudangAsing.size) console.log('GUDANG TIDAK DIKENAL:', [...gudangAsing].join(' | '));

  await insertBatch('tfp_hdr', ['FP_nomor','FP_tanggal','FP_DO_nomor','FP_jthtempo','FP_cus_kode','FP_memo','FP_istax','FP_disc_fakturpr','FP_disc_faktur','FP_disc_item','FP_amount','FP_taxamount','FP_DP','FP_bayar','FP_isbayar','date_create','date_modified','user_create','user_modified','fp_CN','fp_freight','fp_biayarp','fp_biayapr','fp_iskembali','fp_lapor','fp_status_faktur','fp_isdtp','fp_iscetak','fp_tipecash','fp_isgunggung','fp_biayarp2','fp_biayapr2','fp_isecer','fp_iscatalog','fp_so_nomor'], fpHdr);
  await insertBatch('tfp_dtl', ['FPd_FP_nomor','FPd_brg_kode','FPd_brg_satuan','FPd_qty','FPd_harga','FPd_discpr','FPd_nourut','fpd_expired','fpd_cn','fpd_gdg_kode','fpd_bp_rp','fpd_bp_pr','fpd_hrg_min','fpd_idbatch','fpd_bp_rp2','fpd_bp_pr2'], fpDtl);
  console.log(`tfp: ${fpHdr.length} faktur / ${fpDtl.length} baris`);
  console.log(`FP tanpa DO: ${noDOCount}`);

  // ── VERIFIKASI ──
  const counts = {};
  for (const [hdr, dtl] of TRX_TABLES) {
    const h = (await q(`SELECT COUNT(*) n, SUM(user_create='MIG') mig FROM \`${hdr}\``))[0];
    const d = (await q(`SELECT COUNT(*) n FROM \`${dtl}\``))[0];
    counts[hdr] = `${h.mig}/${h.n} hdr, ${d.n} dtl`;
  }
  console.log('VERIFIKASI:', JSON.stringify(counts, null, 1));
  const orphan = await q(`
    SELECT
      (SELECT COUNT(*) FROM tpo_dtl d LEFT JOIN tpo_hdr h ON h.po_nomor=d.pod_po_nomor WHERE h.po_nomor IS NULL) po_dtl_lost,
      (SELECT COUNT(*) FROM tbpb_hdr h LEFT JOIN tpo_hdr p ON p.po_nomor=h.bpb_po_nomor WHERE p.po_nomor IS NULL) bpb_po_lost,
      (SELECT COUNT(*) FROM tinv_hdr h LEFT JOIN tbpb_hdr b ON b.bpb_nomor=h.inv_bpb_nomor WHERE b.bpb_nomor IS NULL) inv_bpb_lost,
      (SELECT COUNT(*) FROM tso_dtl d LEFT JOIN tso_hdr h ON h.so_nomor=d.sod_so_nomor WHERE h.so_nomor IS NULL) so_dtl_lost,
      (SELECT COUNT(*) FROM tdo_hdr h LEFT JOIN tso_hdr s ON s.so_nomor=h.do_so_nomor WHERE s.so_nomor IS NULL) do_so_lost,
      (SELECT COUNT(*) FROM tdo_dtl d LEFT JOIN tdo_hdr h ON h.do_nomor=d.dod_do_nomor WHERE h.do_nomor IS NULL) do_dtl_lost,
      (SELECT COUNT(*) FROM tfp_dtl d LEFT JOIN tfp_hdr h ON h.FP_nomor=d.FPd_FP_nomor WHERE h.FP_nomor IS NULL) fp_dtl_lost,
      (SELECT COUNT(*) FROM tfp_hdr h LEFT JOIN tcustomer c ON c.Cus_kode=h.FP_cus_kode WHERE h.FP_cus_kode<>'' AND c.Cus_kode IS NULL) fp_cus_lost,
      (SELECT COUNT(*) FROM tfp_dtl d LEFT JOIN tbarang b ON b.brg_kode=d.FPd_brg_kode WHERE b.brg_kode IS NULL) fp_brg_lost,
      (SELECT COUNT(*) FROM tinv_hdr h LEFT JOIN tsupplier s ON s.Sup_kode=h.inv_sup_kode WHERE h.inv_sup_kode<>'' AND s.Sup_kode IS NULL) inv_sup_lost,
      (SELECT COUNT(*) FROM tinv_dtl d LEFT JOIN tbarang b ON b.brg_kode=d.invd_brg_kode WHERE b.brg_kode IS NULL) inv_brg_lost,
      (SELECT COUNT(*) FROM tso_hdr h LEFT JOIN tcustomer c ON c.Cus_kode=h.so_cus_kode WHERE h.so_cus_kode<>'' AND c.Cus_kode IS NULL) so_cus_lost,
      (SELECT COUNT(*) FROM tdo_hdr h LEFT JOIN tcustomer c ON c.Cus_kode=h.do_cus_Kode WHERE h.do_cus_Kode<>'' AND c.Cus_kode IS NULL) do_cus_lost`);
  console.log('INTEGRITAS:', JSON.stringify(orphan[0]));
  const gudangKosong = await q(`
    SELECT
      (SELECT COUNT(*) FROM tinv_hdr h WHERE h.user_create='MIG' AND h.inv_tanggal>=? AND h.inv_tanggal<? AND h.inv_bpb_nomor NOT IN (SELECT bpb_nomor FROM tbpb_hdr)) inv_nobpb,
      (SELECT COUNT(*) FROM tfp_hdr h WHERE h.user_create='MIG' AND h.FP_tanggal>=? AND h.FP_tanggal<? AND h.FP_DO_nomor<>'' AND h.FP_DO_nomor NOT IN (SELECT do_nomor FROM tdo_hdr)) fp_do_lost2`, [OKT_AWAL, OKT_AKHIR, OKT_AWAL, OKT_AKHIR]);
  console.log('RENTANG:', OKT_AWAL, 's/d', OKT_AKHIR, '(exclusive)');
  console.log('SELESAI');
  await c.end();
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
