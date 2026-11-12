// utils/viewSession.ts
//
// Semua view browse/laporan menyimpan state filter (search, periode, halaman)
// ke sessionStorage agar tetap ada saat browser di-refresh. Akibatnya, kalau
// tab ditutup lalu menu dibuka lagi, state lama ikut terbaca lagi.
//
// Saat sebuah tab ditutup, state view tsb harus dibersihkan supaya buka menu
// lagi selalu tampil seperti awal. Fungsi ini menghapus:
//  1. Key dinamis BaseBrowse: `finance_browse_${path}`
//  2. Key statis per modul yang didaftarkan di VIEW_STORAGE_KEYS di bawah.

const VIEW_STORAGE_KEYS: Record<string, string> = {
  // ── Transaksi ────────────────────────────────────────────────────
  "/transaksi/bayarSupplier": "pembayaran_supplier",
  "/transaksi/bkk": "finance_periode_bkk",
  "/transaksi/bbk": "finance_periode_bbk",
  "/transaksi/bbm": "finance_periode_bbm",
  "/transaksi/bkm": "finance_periode_bkm",
  "/transaksi/bpb": "inv_periode_bpb",
  "/transaksi/jurnal-umum": "finance_periode_jurnal_umum",
  "/transaksi/mutasi-out": "finance_filter_mutasi_out",
  "/transaksi/pengajuan-transfer": "finance_periode_pengajuan_transfer",
  "/transaksi/penjualan": "minimarket_periode_penjualan",
  "/transaksi/po": "finance_periode_po",
  "/transaksi/rekonsiliasi-bank": "finance_tanggal_rekon_bank",
  "/transaksi/retur": "finance_periode_retur",
  "/transaksi/terima-setoran": "finance_periode_terima_setoran",
  "/transaksi/uang-muka": "finance_periode_uang_muka",
  "/transaksi/voucher-pembayaran": "finance_periode_voucher_pembayaran",

  // ── Posting ──────────────────────────────────────────────────────
  "/posting/pembayaran-customer": "finance_periode_pembayaran_customer",
  "/posting/pembayaran-cust-kaosan": "finance_periode_pembayaran_cust_kaosan",

  // ── Penjualan ────────────────────────────────────────────────────
  "/penjualan/so": "finance_periode_so",
  "/penjualan/do": "finance_periode_do",
  "/penjualan/fp": "finance_periode_fp",
  "/penjualan/bayar-customer": "finance_periode_bayar_customer",
  "/penjualan/bayar-biaya-promosi": "finance_periode_bayar_biaya_promosi",
  "/penjualan/bayar-fee-marketing": "finance_periode_bayar_fee_marketing",
  "/penjualan/retur-penjualan": "finance_periode_retur_penjualan",
  "/penjualan/faktur-manual": "finance_periode_faktur_manual",
  "/penjualan/faktur-pajak": "finance_periode_faktur_pajak",
  // "/penjualan/faktur-pajak-v3": "finance_faktur_pajak_v3",
  "/penjualan/serah-terima-faktur-salesman": "finance_periode_serah_terima_faktur_salesman",
  "/penjualan/tt-faktur": "finance_periode_tt_faktur",
  "/penjualan/list-jual-per-item": "penjualan_periode_listJualPerItem",
  "/penjualan/list-jual-per-faktur": "penjualan_periode_listJualPerFaktur",
  "/penjualan/list-jual-per-outlet": "penjualan_periode_listJualPerOutlet",
  "/penjualan/list-jual-per-item-akumulatif": "penjualan_periode_listJualPerItemAkumulatif",

  // ── Kas Bank ─────────────────────────────────────────────────────
  "/kasbank/buku-bank": "kasbank_periode_buku_bank",
  "/kasbank/kas-harian": "kasbank_periode_kas_harian",
  "/kasbank/penerimaan-lain": "kasbank_periode_penerimaan_lain",
  "/kasbank/pembayaran-lain": "kasbank_periode_pembayaran_lain",
  "/kasbank/pencairan-giro": "kasbank_periode_pencairan_giro",

  // ── Buku Besar ───────────────────────────────────────────────────
  "/bukubesar/jurnal-umum": "bukubesar_periode_jurnal_umum",
  "/bukubesar/list-jurnal": "bukubesar_periode_list_jurnal",

  // ── Komisi ───────────────────────────────────────────────────────
  "/komisi/salesman": "",

  // ── Laporan ──────────────────────────────────────────────────────
  "/laporan/buku-besar": "finance_periode_buku_besar",
  "/laporan/daftar-hutang": "finance_filter_daftar_hutang",
  "/laporan/kasbon-belum-selesai": "finance_filter_kasbon_belum_selesai",
  "/laporan/list-jurnal": "finance_periode_list_jurnal",
  "/laporan/rekonsiliasi-bank": "finance_filter_rekonsiliasi_bank",
  "/laporan/stok-finance": "finance_filter_stok_finance",
  "/laporan/list-jual-per-faktur-margin": "laporan_periode_listJualPerFakturMargin",
  "/laporan/list-faktur-outstanding": "laporan_periode_listFakturOutstanding",
  "/laporan/list-inkaso": "laporan_periode_listInkaso",
  "/laporan/list-mutasi-stok": "laporan_periode_listMutasiStok",
  "/laporan/list-history-stok": "laporan_periode_listHistoryStok",
  "/laporan/stok-expired": "laporan_filter_stokExpired",
  "/laporan/kartu-stok": "laporan_filter_kartuStok",
  "/laporan/barang-realisasi": "",
  "/laporan/do-realisasi": "laporan_periode_doRealisasi",
  "/laporan/lap-bulanan4": "laporan_lapBulanan4",
  "/laporan/lap-bulanan5": "laporan_lapBulanan5",
  "/laporan/lap-ytd": "laporan_lapYtd",
  "/laporan/lap-neraca": "laporan_lapNeraca",
  "/laporan/lap-laba-rugi": "laporan_lapLabaRugi",
  "/laporan/history-harga-jual": "laporan_historyHargaJual",
  "/laporan/transaksi-harian": "laporan_periode_transaksiHarian",
  "/laporan/transaksi-harian2": "laporan_periode_transaksiHarian2",
  "/laporan/saldo-piutang": "laporan_periode_saldoPiutang",
  "/laporan/item-margin-minus": "laporan_periode_itemMarginMinus",
  "/laporan/estimasi-sales": "",
  "/laporan/inkaso-bawah-het": "laporan_inkasoBawahHet",
  "/laporan/omset-vs-kategori": "",

  // ── Daftar ───────────────────────────────────────────────────────
  "/daftar/salesman": "",
  "/daftar/customer": "",
  "/daftar/jenis-customer": "",
  "/daftar/cost-center": "",
  "/daftar/setting-packing": "",
  "/daftar/setting-biaya-promosi": "",
  "/daftar/setting-fee-marketing": "",
  "/daftar/group-produk-fokus": "",
  "/daftar/kendaraan": "",
  "/daftar/ekspedisi": "",
  "/daftar/rekening": "",

  // ── Persediaan ───────────────────────────────────────────────────
  "/persediaan/sub-barang": "",
  "/persediaan/barang": "",
  "/persediaan/gudang": "",
  "/persediaan/penyesuaian-stok": "persediaan_periode_penyesuaian_stok",
  "/persediaan/pemusnahan": "persediaan_periode_pemusnahan",
  "/persediaan/mutasi-gudang": "persediaan_periode_mutasi_gudang",
  "/persediaan/hitung-stok": "persediaan_periode_hitung_stok",
  "/persediaan/list-persediaan": "persediaan_periode_list_persediaan",
  "/persediaan/tagihan-ekspedisi": "persediaan_periode_tagihan_ekspedisi",
  "/persediaan/permintaan-barang": "persediaan_periode_permintaan_barang",

  // ── Setting ──────────────────────────────────────────────────────
  "/setting/perusahaan": "",
};

/**
 * Hapus state filter yang tersimpan di sessionStorage untuk sebuah route.
 * Dipanggil saat tab ditutup agar buka menu kembali selalu fresh.
 */
export const clearViewSession = (path: string): void => {
  try {
    sessionStorage.removeItem(`finance_browse_${path}`);
    const staticKey = VIEW_STORAGE_KEYS[path];
    if (staticKey) sessionStorage.removeItem(staticKey);
  } catch {
    /* sessionStorage tidak tersedia — abaikan */
  }
};

/**
 * Hapus SEMUA state filter view dari sessionStorage.
 * Dipanggil saat refresh agar semua menu browse/laporan reset ke awal.
 */
export const clearAllViewSessions = (): void => {
  try {
    // 1. Hapus semua key dinamis BaseBrowse
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("finance_browse_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));

    // 2. Hapus semua key statis yang terdaftar
    Object.values(VIEW_STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* abaikan */
  }
};

/**
 * Deteksi apakah halaman dimuat karena refresh (F5 / Ctrl+R / tombol reload).
 * Menggunakan Navigation Timing API — return false untuk back/forward/navigate.
 */
export const isPageRefresh = (): boolean => {
  try {
    const entries = performance.getEntriesByType("navigation") as any[];
    return entries.length > 0 && entries[0].type === "reload";
  } catch {
    return false;
  }
};
