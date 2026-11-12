// services/ai/schemaCatalog.js
// Tool db_schema untuk agent: LLM menarik struktur database cabang saat
// dibutuhkan (token-efisien), bukan ditempel penuh di setiap prompt.
const db = require("../../config/database");
const aiCfg = require("../../config/ai");
const { SENSITIVE_RE } = require("./sqlTool");
const branches = require("./branches");

const TTL_MS = 10 * 60_000;
const cache = new Map(); // dbName → { tables, at }

// Kamus bisnis: makna tabel yang rawan disalahpahami model.
// CATATAN PENTING: tsalesman = RAYON/WILAYAH, tsalesmanaktif = SALESMAN (orang).
const CATATAN = {
  tfp_hdr:
    "Header FAKTUR PENJUALAN. FP_amount = total tagihan, FP_DP = uang muka, FP_bayar = terbayar, FP_jthtempo = jatuh tempo. Sisa piutang RESMI = FP_amount - FP_DP - FP_bayar - retur (retur = SUM tretj_hdr.retj_amount per retj_fp_nomor). RELASI: 1 SO = 1 faktur. fp_so_nomor = Sales Order sumber; fp_do_nomor = DELIVERY ORDER data lama (FP baru tidak pakai DO).",
  tfp_dtl:
    "Detail item per faktur penjualan. fpd_hpp = HPP per baris (cost saat barang keluar), di-freeze saat FP disimpan = SUM(mst_stok_out*mst_hargabeli) semua DO milik SO sumber. Qty faktur = total terkirim SO (bisa lintas beberapa DO).",
  tdo_hdr:
    "Header DELIVERY ORDER (surat jalan PENGIRIMAN). do_so_nomor menghubungkan ke Sales Order (tso_hdr.so_nomor). Stok keluar tercatat lewat DO (tmasterstok.mst_noreferensi = nomor DO). FAKTUR tidak lagi mengacu DO (mengacu SO); satu SO bisa banyak DO.",
  tso_hdr:
    "Header SALES ORDER. so_sla_kode = kode salesman (→ tsalesmanaktif.sla_kode), so_sls_kode = kode rayon (→ tsalesman.sls_kode). 1 SO = 1 faktur (tfp_hdr.fp_so_nomor); so_isinvoice = 1 setelah FP dibuat. FP hanya bisa dibuat dari SO yang SO_isclosed = 1 dan SO_isinvoice = 0.",
  tsalesman:
    "RAYON/WILAYAH penjualan — BUKAN nama orang. sls_nama = nama rayon (mis. SELOGIRI, SOLO BARAT, E-KATALOG, INTERNAL).",
  tsalesmanaktif:
    "SALESMAN — nama orang penanggung jawab. sla_nama = nama salesman. Diambil dari tso_hdr.so_sla_kode, BUKAN dari tsalesman.",
  tcustomer: "Master customer. Cus_kode, Cus_nama, Cus_kota, cus_gc_kode = golongan (RS/KL/PS...).",
  transaksi_harian:
    "Mutasi harian piutang per customer+tax: penjualan, retur, bayar cash/transfer/giro, potongan. Sumber laporan saldo piutang.",
  kartu_piutang:
    "Buku besar piutang (penerimaan CR, retur). noreferensi = nomor faktur terkait (→ tfp_hdr.FP_nomor), fp_cus_Kode = kode customer. Inkaso = SUM(kredit - debet) untuk nomor CR.",
  tretj_hdr:
    "Header RETUR penjualan. retj_fp_nomor menghubungkan ke faktur; retur masuk pengurang sisa piutang resmi.",
  tretj_dtl: "Detail barang retur per dokumen retur.",
  tjatuhtempofp:
    "Jadwal JATUH TEMPO pembayaran piutang per faktur: jt_fp_nomor (→ tfp_hdr), jt_tanggaljt = tanggal jatuh tempo, jt_nilai = nilai angsuran. Untuk 'piutang yang jatuh tempo bulan depan'.",
  tbayarcus_hdr:
    "Header PEMBAYARAN CUSTOMER (penerimaan): byc_nomor, byc_tanggal = tanggal bayar, byc_nogiro = nomor giro bila ada. PEMBAYARAN TERAKHIR customer = MAX(byc_tanggal).",
  tbayarcus_dtl:
    "Alokasi pembayaran per faktur: bycd_byc_nomor (→ header), bycd_fp_nomor (→ tfp_hdr), bycd_bayar = nilai. Untuk riwayat pembayaran/inkaso per faktur.",
  tpencairangiro:
    "PENCAIRAN GIRO: cg_gironumber = nomor giro (→ tbayarcus_hdr.byc_nogiro), cg_tanggalcair = tanggal cair. Giro belum cair = belum ada baris/tanggal cair.",
  tbarang:
    "Master barang: brg_stok = stok, brg_MIN_STOK = stok minimum (kritis jika kurang), brg_lastcost = harga beli terakhir, brg_isproductfocus = product focus, brg_ktg_kode = kode kategori format 'DEPT.SUB.KAT' (bertitik).",
  tkategori:
    "Hierarki kategori produk, ktg_kode bertitik: segmen pertama = Departemen (mis. '4' = N3), dua segmen = SubDepartemen, penuh = Kategori.",
  tsalesmantarget:
    "TARGET penjualan per rayon per bulan: st_sls_kode (→ tsalesman), st_periode (1-12), st_tahun, st_targetsales.",
  tdepartementarget:
    "TARGET penjualan per departemen: dt_ktg_kode (→ tkategori), dt_periode, dt_tahun, dt_targetsales.",
  zkunjungan:
    "VIEW kunjungan marketing/sales per outlet per tanggal. Kolom USER = nama salesman (join ke tsalesmanaktif.sla_nama).",
  ttagihanekspedisi_dtl:
    "Biaya EKSPEDISI per faktur: tehd_fp_nomor (→ tfp_hdr), tehd_biaya = biaya kirim.",
  tkomisisales_hdr:
    "Batas/pengali KOMISI salesman (master skema komisi) — dipakai laporan komisi.",
  alljurnal:
    "VIEW LIST JURNAL (buku besar) semua transaksi akuntansi: Tanggal, Nomor, Account/AccountName = akun, Debet, Kredit, Kelompok = nama kelompok akun, CostCenter, Customer. Sumber 'biaya/pendapatan' — filter Kelompok/AccountName.",
  tjurnal:
    "Header JURNAL akuntansi: jur_no, jur_tanggal, jur_keterangan, jur_tipetransaksi. Item-nya di tjurnalitem.",
  tjurnalitem:
    "Item jurnal per rekening: jurd_jur_no (→ tjurnal), jurd_rek_kode (→ trekening), jurd_debet, jurd_kredit, jurd_cc_kode. Saldo rekening = SUM(debet - kredit).",
  trekening:
    "CHART OF ACCOUNTS: rek_kode (pola: 11.xxx kas, 12.xxx bank, 14.xxx piutang, 21-22.xxx pendapatan, 23.xxx biaya, 26.xxx BPP), rek_nama, REK_KOL_ID (→ tkelompok).",
  tkelompok:
    "KELOMPOK AKUN (KOL_KODE A-N): A KAS & BANK, B PIUTANG, E PERSEDIAAN, G HUTANG, H MODAL, I BPP, J PENDAPATAN USAHA, K PENDAPATAN DILUAR USAHA, L FIXED COST, M VARIABLE COST, N KOREKSI LABARUGI.",
  tcabang: "Master cabang (cbg_kode, cbg_nama, dbase = nama database cabang).",
  tmasterstok:
    "Ledger MUTASI STOK per barang per tanggal expired per gudang: mst_stok_in/mst_stok_out = qty masuk/keluar, mst_hargabeli = harga beli, mst_noreferensi = nomor dokumen (DO/PB/MTC/RETJ/dll). Sumber semua perhitungan stok. PERHATIAN: mst_expired_date 1899-12-30 = BARANG TANPA tanggal expired (bukan expired 1899); satu DO+barang+expired bisa beberapa baris (keluar bertahap). RETUR penjualan (RETJ) mencatat stok masuk (mst_stok_in) dgn mst_noreferensi = nomor retur & mst_hargabeli = cost DO terakhir milik SO sumber — sumber HPP retur di laporan.",
  tpod_hdr: "POD (bukti serah terima DO): pod_do_nomor (→ tdo_hdr), pod_foto = foto/bukti terkirim, pod_tanggal. DO tanpa POD = 'Belum Terkirim' (bisa karena input lag, bukan pasti tidak terkirim).",
  tpermintaanbarang_hdr:
    "Header PERMINTAAN BARANG (PB) antar gudang/cabang: pb_nomor, pb_isclosed (0 = masih terbuka).",
  tpermintaanbarang_dtl:
    "Detail PB: pbd_pb_nomor, pbd_brg_kode, pbd_qty (minta), pbd_qtyterima (terima). Kurang = pbd_qty - pbd_qtyterima.",
  tso_dtl:
    "Detail item Sales Order (barang yang dipesan). sod_qty_invoice = qty sudah di-invoice; qty faktur tersedia = sod_qty - sod_qty_invoice.",
  tdo_dtl: "Detail item Delivery Order (barang yang dikirim).",
  tkontrak:
    "Master/data KONTRAK penjualan (skema Cn) — dasar potongan kontrak pada faktur.",
  tfakturpajak_hdr:
    "Header FAKTUR PAJAK yang diterbitkan per faktur penjualan (industri PPN/Faktur Pajak).",
  tfakturpajak_dtl: "Detail item faktur pajak.",
  tpo_hdr: "Header PURCHASE ORDER (pembelian) ke supplier: po_nomor, po_sup_kode.",
  tpo_dtl: "Detail item PO pembelian.",
  tsupplier: "Master supplier (pemasok barang): sup_kode, sup_nama. Hutang ke supplier = tbayarsup.",
  tbayarsup_hdr:
    "Pembayaran ke SUPPLIER (hutang) — pemasok, bukan customer. Berbeda dengan tbayarcus.",
  tbayarbp_hdr: "Pembayaran klaim BIAYA PROMOSI (BP) — klaim terpisah dari piutang biasa.",
  tbayarfm_hdr: "Pembayaran klaim FEE MARKETING (FM) — klaim terpisah dari piutang biasa.",
  tbiayapromosi_hdr: "Header klaim biaya promosi (dasar tbayarbp).",
  tfeemarketing_hdr: "Header klaim fee marketing (dasar tbayarfm).",
  thetbulanan: "Master HET (harga eceran tertinggi) per barang — dasar status Bawah/Diatas HET.",
  tbarangpf: "Master barang PRODUCT FOCUS (prioritas) — dasar capaian PF.",
  tperiodeaktif: "Periode pembukuan yang sedang AKTIF (bulan/tahun berjalan di sistem).",
  ttutupperiode: "Riwayat TUTUP PERIODE — periode yang sudah ditutup tidak bisa diubah.",
  tkor_hdr: "Header KOREKSI (KOR) — koreksi manual transaksi.",
  tmutasi_hdr: "Header MUTASI GUDANG (transfer antar gudang).",
  tmus_hdr: "Header PEMUSNAHAN barang (rusak/expired).",
  tpacking_hdr: "Header PACKING barang.",
  tsj_hdr: "Header SURAT JALAN internal (selain DO).",
  tinv_hdr: "Header INVOICE pembelian/internal — bukan faktur penjualan (baca konteks sebelum memakai).",
  penjualann3bysalesman:
    "VIEW penjualan per salesman untuk departemen N3 (dipakai laporan capaian). Bergantung session var @tg1/@tg2 — jangan dipakai di sql_readonly (hasilkan nol).",
  transaksi_hariann3:
    "VIEW transaksi harian per salesman N3 (dipakai laporan komisi). Bergantung session var — jangan dipakai di sql_readonly.",
};

async function listTables() {
  const key = db.getCurrentDatabase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tables;
  const [rows] = await db.query(
    "SELECT table_name AS t FROM information_schema.tables " +
      "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  const tables = rows.map((r) => r.t);
  cache.set(key, { tables, at: Date.now() });
  return tables;
}

// Tanpa argumen → daftar tabel. Dengan table → kolom + tipe (sensitif
// disaring untuk non-FINANCE). dbKey opsional = cabang lain.
async function describe(table, user = {}, dbKey) {
  return branches.branchRun(dbKey, async () => {
    if (!table) {
      const tables = await listTables();
      return {
        tabel: tables,
        petunjuk: "Panggil lagi dengan argumen 'table' untuk melihat kolomnya.",
        ingat: "tsalesman = rayon/wilayah (bukan orang); tsalesmanaktif = salesman (nama orang).",
      };
    }
    const tables = await listTables();
    const found = tables.find((t) => t.toLowerCase() === String(table).toLowerCase());
    if (!found) return { error: `Tabel '${table}' tidak ada. Pilih dari: ${tables.join(", ")}` };
    const [rows] = await db.query(
      "SELECT column_name, column_type, column_key FROM information_schema.columns " +
        "WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position",
      [found],
    );
    const isFinance = aiCfg.isFinanceUser(user);
    const kolom = rows
      .filter((r) => isFinance || !SENSITIVE_RE.test(r.column_name))
      .map((r) => `${r.column_name} ${r.column_type}${r.column_key === "PRI" ? " PK" : ""}`);
    const out = { tabel: found, jumlah_kolom: kolom.length, kolom };
    const catatan = CATATAN[found.toLowerCase()];
    if (catatan) out.catatan = catatan;
    return out;
  });
}

module.exports = { describe };
