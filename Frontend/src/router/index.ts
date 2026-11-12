// router/index.ts — VERSI MINIMAL
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { useTabsStore } from "@/stores/tabsStore";
import { useDynamicRoutes } from "@/composables/useDynamicRoutes";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ── Route Wajib (tidak dari database) ─────────────────────────────
    {
      path: "/login",
      name: "Login",
      component: () => import("@/views/auth/LoginView.vue"),
      meta: { title: "Login", layout: "BlankLayout", requiresAuth: false },
    },
    {
      path: "/",
      name: "Dashboard",
      component: () => import("@/views/dashboard/DashboardView.vue"),
      meta: {
        layout: "DefaultLayout",
        requiresAuth: true,
        requiresPermission: false,
        title: "Dashboard",
      },
    },
    // ── Setting Printer ─────────────────────────────────────────────────
    {
      path: "/settings/printer",
      name: "settingPrinter",
      component: () => import("@/views/tools/SettingPrinterView.vue"),
      meta: {
        layout: "DefaultLayout",
        requiresAuth: true,
        requiresPermission: false,
        title: "Setting Printer",
      },
    },
    {
      path: "/403",
      name: "Unauthorized",
      component: () => import("@/views/errors/UnauthorizedView.vue"),
      meta: {
        layout: "BlankLayout",
        requiresAuth: false,
        title: "Akses Ditolak",
      },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "NotFound",
      component: () => import("@/views/errors/NotFoundView.vue"),
      meta: {
        layout: "BlankLayout",
        requiresAuth: false,
        title: "Halaman Tidak Ditemukan",
      },
    },
    // ── Sales Order ─────────────────────────────────────────────────────
{
  path: "/penjualan/so",
  name: "soBrowse",
  component: () => import("@/views/penjualan/SOBrowseView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Sales Order",
  },
},
{
  path: "/penjualan/so/create",
  name: "soCreate",
  component: () => import("@/views/penjualan/SOFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah SO",
    browseRoute: "soBrowse",
  },
},
{
  path: "/penjualan/so/edit/:nomor",
  name: "soEdit",
  component: () => import("@/views/penjualan/SOFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah SO",
    browseRoute: "soBrowse",
  },
},

// ── Delivery Order ──────────────────────────────────────────────────
{
  path: "/penjualan/do",
  name: "doBrowse",
  component: () => import("@/views/penjualan/DOBrowseView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Delivery Order",
  },
},
{
  path: "/penjualan/do/create",
  name: "doCreate",
  component: () => import("@/views/penjualan/DOFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah DO",
    browseRoute: "doBrowse",
  },
},
{
  path: "/penjualan/do/edit/:nomor",
  name: "doEdit",
  component: () => import("@/views/penjualan/DOFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah DO",
    browseRoute: "doBrowse",
  },
},
// router/index.ts
{
  path: "/penjualan/fp",
  name: "fpBrowse",
  component: () => import("@/views/penjualan/FPBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Faktur Penjualan" },
},
{
  path: "/penjualan/fp/create",
  name: "fpCreate",
  component: () => import("@/views/penjualan/FPFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah FP", browseRoute: "fpBrowse" },
},
{
  path: "/penjualan/fp/edit/:nomor",
  name: "fpEdit",
  component: () => import("@/views/penjualan/FPFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah FP", browseRoute: "fpBrowse" },
},
// router/index.ts
{
  path: "/penjualan/bayar-customer",
  name: "bayarCustomerBrowse",
  component: () => import("@/views/penjualan/BayarCustomerBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Bayar Customer" },
},
{
  path: "/penjualan/bayar-customer/create",
  name: "bayarCustomerCreate",
  component: () => import("@/views/penjualan/BayarCustomerFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Bayar Customer", browseRoute: "bayarCustomerBrowse" },
},
{
  path: "/penjualan/bayar-customer/edit/:nomor",
  name: "bayarCustomerEdit",
  component: () => import("@/views/penjualan/BayarCustomerFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Bayar Customer", browseRoute: "bayarCustomerBrowse" },
},
// ── Cetak Penerimaan Customer (browser print, paritas BYC.fr3) ──────
{
  path: "/penjualan/bayar-customer/print/:nomor",
  name: "bayarCustomerPrint",
  component: () => import("@/views/penjualan/BayarCustomerPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Penerimaan Customer" },
},
// router/index.ts
{
  path: "/penjualan/bayar-biaya-promosi",
  name: "bayarBiayaPromosiBrowse",
  component: () => import("@/views/penjualan/BayarBiayaPromosiBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Bayar Biaya Promosi" },
},
{
  path: "/penjualan/bayar-biaya-promosi/create",
  name: "bayarBiayaPromosiCreate",
  component: () => import("@/views/penjualan/BayarBiayaPromosiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Bayar Biaya Promosi", browseRoute: "bayarBiayaPromosiBrowse" },
},
{
  path: "/penjualan/bayar-biaya-promosi/edit/:nomor",
  name: "bayarBiayaPromosiEdit",
  component: () => import("@/views/penjualan/BayarBiayaPromosiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Bayar Biaya Promosi", browseRoute: "bayarBiayaPromosiBrowse" },
},
// ── Cetak Bukti Penerimaan Kas/Bank (browser print, paritas BYB.fr3) ──
{
  path: "/penjualan/bayar-biaya-promosi/print/:nomor",
  name: "bayarBiayaPromosiPrint",
  component: () => import("@/views/penjualan/BayarBiayaPromosiPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Bukti Penerimaan Kas/Bank" },
},
// router/index.ts
{
  path: "/penjualan/bayar-fee-marketing",
  name: "bayarFeeMarketingBrowse",
  component: () => import("@/views/penjualan/BayarFeeMarketingBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Bayar Fee Marketing" },
},
{
  path: "/penjualan/bayar-fee-marketing/create",
  name: "bayarFeeMarketingCreate",
  component: () => import("@/views/penjualan/BayarFeeMarketingFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Bayar Fee Marketing", browseRoute: "bayarFeeMarketingBrowse" },
},
{
  path: "/penjualan/bayar-fee-marketing/edit/:nomor",
  name: "bayarFeeMarketingEdit",
  component: () => import("@/views/penjualan/BayarFeeMarketingFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Bayar Fee Marketing", browseRoute: "bayarFeeMarketingBrowse" },
},
// ── Cetak Bukti Penerimaan Kas/Bank (browser print, paritas BYF.fr3) ──
{
  path: "/penjualan/bayar-fee-marketing/print/:nomor",
  name: "bayarFeeMarketingPrint",
  component: () => import("@/views/penjualan/BayarFeeMarketingPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Bukti Penerimaan Kas/Bank" },
},
// router/index.ts
{
  path: "/penjualan/retur-penjualan",
  name: "returPenjualanBrowse",
  component: () => import("@/views/penjualan/ReturPenjualanBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Retur Penjualan" },
},
{
  path: "/penjualan/retur-penjualan/create",
  name: "returPenjualanCreate",
  component: () => import("@/views/penjualan/ReturPenjualanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Retur Penjualan", browseRoute: "returPenjualanBrowse" },
},
{
  path: "/penjualan/retur-penjualan/edit/:nomor",
  name: "returPenjualanEdit",
  component: () => import("@/views/penjualan/ReturPenjualanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Retur Penjualan", browseRoute: "returPenjualanBrowse" },
},
// router/index.ts
{
  path: "/penjualan/faktur-manual",
  name: "fakturManualBrowse",
  component: () => import("@/views/penjualan/FakturManualBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Faktur Manual" },
},
{
  path: "/penjualan/faktur-manual/create",
  name: "fakturManualCreate",
  component: () => import("@/views/penjualan/FakturManualFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Faktur Manual", browseRoute: "fakturManualBrowse" },
},
{
  path: "/penjualan/faktur-manual/edit/:nomor",
  name: "fakturManualEdit",
  component: () => import("@/views/penjualan/FakturManualFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Faktur Manual", browseRoute: "fakturManualBrowse" },
},
// router/index.ts
{
  path: "/penjualan/faktur-pajak",
  name: "fakturPajakBrowse",
  component: () => import("@/views/penjualan/FakturPajakBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Faktur Pajak" },
},
{
  path: "/penjualan/faktur-pajak/create",
  name: "fakturPajakCreate",
  component: () => import("@/views/penjualan/FakturPajakFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Faktur Pajak", browseRoute: "fakturPajakBrowse" },
},
{
  path: "/penjualan/faktur-pajak/edit/:nomor",
  name: "fakturPajakEdit",
  component: () => import("@/views/penjualan/FakturPajakFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Faktur Pajak", browseRoute: "fakturPajakBrowse" },
},
// router/index.ts
// Faktur Pajak V3 removed
// router/index.ts
{
  path: "/penjualan/serah-terima-faktur-salesman",
  name: "serahTerimaFakturSalesmanBrowse",
  component: () => import("@/views/penjualan/SerahTerimaFakturSalesmanBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Serah Terima Faktur Salesman" },
},
{
  path: "/penjualan/serah-terima-faktur-salesman/create",
  name: "serahTerimaFakturSalesmanCreate",
  component: () => import("@/views/penjualan/SerahTerimaFakturSalesmanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Serah Terima Faktur Salesman", browseRoute: "serahTerimaFakturSalesmanBrowse" },
},
{
  path: "/penjualan/serah-terima-faktur-salesman/edit/:nomor",
  name: "serahTerimaFakturSalesmanEdit",
  component: () => import("@/views/penjualan/SerahTerimaFakturSalesmanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Serah Terima Faktur Salesman", browseRoute: "serahTerimaFakturSalesmanBrowse" },
},
// ── Serah Terima Faktur (tabel tserahterimafaktur_hdr/_dtl, menu Utility) ──
{
  path: "/penjualan/serah-terima-faktur",
  name: "serahTerimaFakturBrowse",
  component: () => import("@/views/penjualan/SerahTerimaFakturBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Serah Terima Faktur" },
},
{
  path: "/penjualan/serah-terima-faktur/create",
  name: "serahTerimaFakturCreate",
  component: () => import("@/views/penjualan/SerahTerimaFakturFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Serah Terima Faktur", browseRoute: "serahTerimaFakturBrowse" },
},
{
  path: "/penjualan/serah-terima-faktur/edit/:nomor",
  name: "serahTerimaFakturEdit",
  component: () => import("@/views/penjualan/SerahTerimaFakturFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Serah Terima Faktur", browseRoute: "serahTerimaFakturBrowse" },
},
// ── Cetak Serah Terima Faktur: mode st (ST.fr3) & mode slip (dot-matrix) ──
{
  path: "/penjualan/serah-terima-faktur/print/:nomor",
  name: "serahTerimaFakturPrint",
  component: () => import("@/views/penjualan/SerahTerimaFakturPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Serah Terima Faktur" },
},
// router/index.ts
{
  path: "/penjualan/tt-faktur",
  name: "ttFakturBrowse",
  component: () => import("@/views/penjualan/TTFakturBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "TT Faktur" },
},
{
  path: "/penjualan/tt-faktur/create",
  name: "ttFakturCreate",
  component: () => import("@/views/penjualan/TTFakturFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah TT Faktur", browseRoute: "ttFakturBrowse" },
},
{
  path: "/penjualan/tt-faktur/edit/:nomor",
  name: "ttFakturEdit",
  component: () => import("@/views/penjualan/TTFakturFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah TT Faktur", browseRoute: "ttFakturBrowse" },
},
// ── Pembelian ───────────────────────────────────────────────────────
{
  path: "/pembelian/po",
  name: "poBrowse",
  component: () => import("@/views/pembelian/POBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Purchase Order" },
},
{
  path: "/pembelian/po/create",
  name: "poCreate",
  component: () => import("@/views/pembelian/POFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah PO", browseRoute: "poBrowse" },
},
{
  path: "/pembelian/po/edit/:nomor",
  name: "poEdit",
  component: () => import("@/views/pembelian/POFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah PO", browseRoute: "poBrowse" },
},
{
  path: "/pembelian/bpb",
  name: "bpbBrowse",
  component: () => import("@/views/pembelian/BPBBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "BPB" },
},
{
  path: "/pembelian/bpb/create",
  name: "bpbCreate",
  component: () => import("@/views/pembelian/BPBFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah BPB", browseRoute: "bpbBrowse" },
},
{
  path: "/pembelian/bpb/edit/:nomor",
  name: "bpbEdit",
  component: () => import("@/views/pembelian/BPBFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah BPB", browseRoute: "bpbBrowse" },
},
{
  path: "/pembelian/invoice",
  name: "invoiceBrowse",
  component: () => import("@/views/pembelian/InvoiceBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Invoice Supplier" },
},
{
  path: "/pembelian/invoice/create",
  name: "invoiceCreate",
  component: () => import("@/views/pembelian/InvoiceFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Invoice", browseRoute: "invoiceBrowse" },
},
{
  path: "/pembelian/invoice/edit/:nomor",
  name: "invoiceEdit",
  component: () => import("@/views/pembelian/InvoiceFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Invoice", browseRoute: "invoiceBrowse" },
},
{
  path: "/pembelian/bayar-supplier",
  name: "bayarSupplierBrowse",
  component: () => import("@/views/pembelian/BayarSupplierBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Pembayaran Supplier" },
},
{
  path: "/pembelian/bayar-supplier/create",
  name: "bayarSupplierCreate",
  component: () => import("@/views/pembelian/BayarSupplierFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Pembayaran Supplier", browseRoute: "bayarSupplierBrowse" },
},
{
  path: "/pembelian/bayar-supplier/edit/:nomor",
  name: "bayarSupplierEdit",
  component: () => import("@/views/pembelian/BayarSupplierFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Pembayaran Supplier", browseRoute: "bayarSupplierBrowse" },
},
{
  path: "/pembelian/retur-beli",
  name: "returBeliBrowse",
  component: () => import("@/views/pembelian/ReturBeliBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Retur Pembelian" },
},
{
  path: "/pembelian/retur-beli/create",
  name: "returBeliCreate",
  component: () => import("@/views/pembelian/ReturBeliFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Retur Pembelian", browseRoute: "returBeliBrowse" },
},
{
  path: "/pembelian/retur-beli/edit/:nomor",
  name: "returBeliEdit",
  component: () => import("@/views/pembelian/ReturBeliFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Retur Pembelian", browseRoute: "returBeliBrowse" },
},
// router/index.ts
{
  path: "/penjualan/list-jual-per-item",
  name: "listJualPerItemBrowse",
  component: () => import("@/views/penjualan/ListJualPerItemBrowseView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Jual Per Item" },
},
{
  path: "/penjualan/list-jual-per-faktur",
  name: "listJualPerFakturBrowse",
  component: () => import("@/views/penjualan/ListJualPerFakturView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Penjualan Per Faktur" },
},
{
  path: "/penjualan/list-jual-per-outlet",
  name: "listJualPerOutletBrowse",
  component: () => import("@/views/penjualan/ListJualPerOutletView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Penjualan Per Outlet" },
},
{
  path: "/penjualan/list-jual-per-item-akumulatif",
  name: "listJualPerItemAkumulatifBrowse",
  component: () => import("@/views/penjualan/ListJualPerItemAkumulatifView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Penjualan Per Item Akumulatif" },
},
{
  path: "/laporan/list-jual-per-faktur-margin",
  name: "listJualPerFakturMarginBrowse",
  component: () => import("@/views/laporan/ListJualPerFakturMarginView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Penjualan per Faktur (Margin)" },
},
{
  path: "/laporan/list-faktur-outstanding",
  name: "listFakturOutstandingBrowse",
  component: () => import("@/views/laporan/ListFakturOutstandingView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Faktur Outstanding" },
},
// ── Cetak FOS (browser print, paritas FOS.fr3) ──────────────────────
{
  path: "/laporan/list-faktur-outstanding/print",
  name: "listFakturOutstandingPrint",
  component: () => import("@/views/laporan/ListFakturOutstandingPrintView.vue"),
  meta: {
    layout: "BlankLayout",
    requiresAuth: true,
    requiresPermission: false,
    title: "Cetak Faktur Outstanding",
  },
},
{
  path: "/laporan/list-inkaso",
  name: "listInkasoBrowse",
  component: () => import("@/views/laporan/ListInkasoView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Inkaso" },
},
{
  path: "/laporan/list-mutasi-stok",
  name: "listMutasiStokBrowse",
  component: () => import("@/views/laporan/ListMutasiStokView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Mutasi Stok" },
},
{
  path: "/laporan/list-history-stok",
  name: "listHistoryStokBrowse",
  component: () => import("@/views/laporan/ListHistoryStokView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "History Stok" },
},
{
  path: "/laporan/stok-expired",
  name: "stokExpiredBrowse",
  component: () => import("@/views/laporan/StokExpiredView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Stok Expired" },
},
{
  path: "/laporan/kartu-stok",
  name: "kartuStokBrowse",
  component: () => import("@/views/laporan/KartuStokView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Kartu Stok" },
},
{
  path: "/laporan/barang-realisasi",
  name: "barangRealisasiBrowse",
  component: () => import("@/views/laporan/BarangRealisasiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Permintaan Barang vs Realisasi" },
},
{
  path: "/laporan/do-realisasi",
  name: "doRealisasiBrowse",
  component: () => import("@/views/laporan/DoRealisasiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan DO vs Realisasi" },
},
{
  path: "/laporan/lap-bulanan4",
  name: "lapBulanan4Browse",
  component: () => import("@/views/laporan/LapBulanan4View.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Sales Bulanan New" },
},
{
  path: "/laporan/lap-bulanan5",
  name: "lapBulanan5Browse",
  component: () => import("@/views/laporan/LapBulanan5View.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Sales Departemen" },
},
{
  path: "/laporan/lap-ytd",
  name: "lapYtdBrowse",
  component: () => import("@/views/laporan/LapYtdView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Year to Date" },
},
{
  path: "/laporan/lap-neraca",
  name: "lapNeracaBrowse",
  component: () => import("@/views/laporan/LapNeracaView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Neraca" },
},
{
  path: "/laporan/lap-laba-rugi",
  name: "lapLabaRugiBrowse",
  component: () => import("@/views/laporan/LapLabaRugiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Laporan Laba Rugi" },
},
{
  path: "/laporan/history-harga-jual",
  name: "historyHargaJualBrowse",
  component: () => import("@/views/laporan/HistoryHargaJualView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Browse History Harga Jual" },
},
{
  path: "/laporan/transaksi-harian",
  name: "transaksiHarianBrowse",
  component: () => import("@/views/laporan/TransaksiHarianView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Transaksi Harian" },
},
{
  path: "/laporan/transaksi-harian2",
  name: "transaksiHarian2Browse",
  component: () => import("@/views/laporan/TransaksiHarian2View.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Transaksi Harian by Customer" },
},
{
  path: "/laporan/saldo-piutang",
  name: "saldoPiutangBrowse",
  component: () => import("@/views/laporan/SaldoPiutangView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Saldo Piutang" },
},
{
  path: "/laporan/item-margin-minus",
  name: "itemMarginMinusBrowse",
  component: () => import("@/views/laporan/ListItemMinusView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "List Item Margin Minus (Lastcost)" },
},
{
  path: "/komisi/salesman",
  name: "komisiSalesmanBrowse",
  component: () => import("@/views/komisi/KomisiSalesmanView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Komisi Salesman" },
},
{
  path: "/laporan/estimasi-sales",
  name: "estimasiSalesBrowse",
  component: () => import("@/views/laporan/EstimasiSalesView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Estimasi Salesman vs Realisasi" },
},
{
  path: "/laporan/inkaso-bawah-het",
  name: "inkasoBawahHetBrowse",
  component: () => import("@/views/laporan/InkasoBawahHetView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Inkaso Bawah HET" },
},
{
  path: "/laporan/omset-vs-kategori",
  name: "omsetVsKategoriBrowse",
  component: () => import("@/views/laporan/OmsetvsOmsetKategoriView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Omset Penjualan vs Omset Kategori" },
},
{
  path: "/setting/perusahaan",
  name: "perusahaanSetting",
  component: () => import("@/views/setting/PerusahaanView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Identitas Perusahaan" },
},
{
  path: "/utility/tutup-periode",
  name: "tutupPeriode",
  component: () => import("@/views/utility/TutupPeriodeView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tutup Periode" },
},
{
  path: "/utility/proses-biaya-promosi",
  name: "prosesBiayaPromosi",
  component: () => import("@/views/utility/ProsesBiayaPromosiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Proses Biaya Promosi" },
},  {
    path: "/utility/proses-fee-marketing",
    name: "prosesFeeMarketing",
    component: () => import("@/views/utility/ProsesFeeMarketingView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Proses Fee Marketing" },
  },
  {
    path: "/utility/setting-estimasi-salesman",
    name: "settingEstimasiSalesman",
    component: () => import("@/views/utility/SettingEstimasiSalesmanView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Setting Estimasi Salesman" },
  },
  {
    path: "/utility/setting-jadwal-sales",
    name: "settingJadwalSales",
    component: () => import("@/views/utility/SettingJadwalSalesBrowseView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Setting Jadwal Sales" },
  },
  {
    path: "/utility/setting-jadwal-sales/create",
    name: "settingJadwalSalesCreate",
    component: () => import("@/views/utility/SettingJadwalSalesFormView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Setting Jadwal Sales" },
  },
  {
    path: "/utility/setting-jadwal-sales/edit/:salesman",
    name: "settingJadwalSalesEdit",
    component: () => import("@/views/utility/SettingJadwalSalesFormView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Setting Jadwal Sales" },
  },
  {
    path: "/utility/cetak-kunjungan",
    name: "cetakKunjungan",
    component: () => import("@/views/utility/CetakKunjunganView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Cetak Kunjungan" },
  },
  {
    path: "/utility/cetak-kunjungan/print",
    name: "cetakKunjunganPrint",
    component: () => import("@/views/utility/CetakKunjunganPrintView.vue"),
    meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Kunjungan" },
  },
  {
    path: "/utility/penugasan-driver",
    name: "penugasanDriver",
    component: () => import("@/views/utility/PenugasanDriverView.vue"),
    meta: { layout: "DefaultLayout", requiresAuth: true, title: "Penugasan Driver" },
  },
// ── Daftar Salesman ──────────────────────────────────────────────
{
  path: "/daftar/salesman",
  name: "salesmanBrowse",
  component: () => import("@/views/daftar/SalesmanView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Salesman",
  },
},
{
  path: "/daftar/salesman/create",
  name: "salesmanCreate",
  component: () => import("@/views/daftar/SalesmanFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah Salesman",
    browseRoute: "salesmanBrowse",
  },
},
{
  path: "/daftar/salesman/edit/:kode",
  name: "salesmanEdit",
  component: () => import("@/views/daftar/SalesmanFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah Salesman",
    browseRoute: "salesmanBrowse",
  },
},
// ── Daftar Customer ──────────────────────────────────────────────
// ── Daftar Customer ──────────────────────────────────────────────
{
  path: "/daftar/customer",
  name: "customerBrowse",
  component: () => import("@/views/daftar/CustomerView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Customer",
  },
},
{
  path: "/daftar/customer/create",
  name: "customerCreate",
  component: () => import("@/views/daftar/CustomerFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah Customer",
    browseRoute: "customerBrowse",
  },
},
{
  path: "/daftar/customer/edit/:kode",
  name: "customerEdit",
  component: () => import("@/views/daftar/CustomerFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah Customer",
    browseRoute: "customerBrowse",
  },
},
// ── Daftar Jenis Customer ─────────────────────────────────────────
{
  path: "/daftar/jenis-customer",
  name: "jenisCustomerBrowse",
  component: () => import("@/views/daftar/JenisCustomerView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Jenis Customer",
  },
},
// ── Daftar Cost Center ─────────────────────────────────────────
{
  path: "/daftar/cost-center",
  name: "costCenterBrowse",
  component: () => import("@/views/daftar/CostCenterView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Cost Center",
  },
},
// ── Daftar Setting Packing ────────────────────────────────────────
{
  path: "/daftar/setting-packing",
  name: "settingPackingBrowse",
  component: () => import("@/views/daftar/SettingPackingView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Setting Packing",
  },
},
{
  path: "/daftar/setting-packing/create",
  name: "settingPackingCreate",
  component: () => import("@/views/daftar/SettingPackingFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah Setting Packing",
    browseRoute: "settingPackingBrowse",
  },
},
{
  path: "/daftar/setting-packing/edit/:nomor",
  name: "settingPackingEdit",
  component: () => import("@/views/daftar/SettingPackingFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah Setting Packing",
    browseRoute: "settingPackingBrowse",
  },
},
// ── Daftar Setting Biaya Promosi ──────────────────────────────────
{
  path: "/daftar/setting-biaya-promosi",
  name: "settingBiayaPromosiBrowse",
  component: () => import("@/views/daftar/SettingBiayaPromosiView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Setting Biaya Promosi",
  },
},
{
  path: "/daftar/setting-biaya-promosi/create",
  name: "settingBiayaPromosiCreate",
  component: () => import("@/views/daftar/SettingBiayaPromosiFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah Setting Biaya Promosi",
    browseRoute: "settingBiayaPromosiBrowse",
  },
},
{
  path: "/daftar/setting-biaya-promosi/edit/:nomor",
  name: "settingBiayaPromosiEdit",
  component: () => import("@/views/daftar/SettingBiayaPromosiFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah Setting Biaya Promosi",
    browseRoute: "settingBiayaPromosiBrowse",
  },
},
// ── Daftar Setting Fee Marketing ───────────────────────────────────
{
  path: "/daftar/setting-fee-marketing",
  name: "settingFeeMarketingBrowse",
  component: () => import("@/views/daftar/SettingFeeMarketingView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Setting Fee Marketing",
  },
},
{
  path: "/daftar/setting-fee-marketing/create",
  name: "settingFeeMarketingCreate",
  component: () => import("@/views/daftar/SettingFeeMarketingFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Tambah Setting Fee Marketing",
    browseRoute: "settingFeeMarketingBrowse",
  },
},
{
  path: "/daftar/setting-fee-marketing/edit/:nomor",
  name: "settingFeeMarketingEdit",
  component: () => import("@/views/daftar/SettingFeeMarketingFormView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Ubah Setting Fee Marketing",
    browseRoute: "settingFeeMarketingBrowse",
  },
},
// ── Daftar Group Produk Fokus ──────────────────────────────────────
{
  path: "/daftar/group-produk-fokus",
  name: "groupProdukFokusBrowse",
  component: () => import("@/views/daftar/GroupProdukFokusView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Group Produk Fokus",
  },
},
// ── Daftar Kendaraan ───────────────────────────────────────────────
{
  path: "/daftar/kendaraan",
  name: "kendaraanBrowse",
  component: () => import("@/views/daftar/KendaraanView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Kendaraan",
  },
},
// ── Daftar Ekspedisi ───────────────────────────────────────────────
{
  path: "/daftar/ekspedisi",
  name: "ekspedisiBrowse",
  component: () => import("@/views/daftar/EkspedisiView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Ekspedisi",  },
},

{
  path: "/daftar/rekening",
  name: "rekeningBrowse",
  component: () => import("@/views/daftar/RekeningView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Daftar Rekening" },
},
{
  path: "/daftar/rekening/create",
  name: "rekeningCreate",
  component: () => import("@/views/daftar/RekeningFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Rekening", browseRoute: "rekeningBrowse" },
},
{
  path: "/daftar/rekening/edit/:kode",
  name: "rekeningEdit",
  component: () => import("@/views/daftar/RekeningFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Rekening", browseRoute: "rekeningBrowse" },
},

// ── Persediaan Sub Barang ──────────────────────────────────────────
{
  path: "/persediaan/sub-barang",
  name: "subBarangBrowse",
  component: () => import("@/views/persediaan/SubBarangView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Sub Barang",
  },
},
// ── Persediaan Barang ──────────────────────────────────────────────
{
  path: "/persediaan/barang",
  name: "barangBrowse",
  component: () => import("@/views/persediaan/BarangView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Daftar Barang" },
},
{
  path: "/persediaan/barang/create",
  name: "barangCreate",
  component: () => import("@/views/persediaan/BarangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Barang", browseRoute: "barangBrowse" },
},
{
  path: "/persediaan/barang/edit/:kode",
  name: "barangEdit",
  component: () => import("@/views/persediaan/BarangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Barang", browseRoute: "barangBrowse" },
},
// ── Persediaan Gudang ──────────────────────────────────────────────
{
  path: "/persediaan/gudang",
  name: "gudangBrowse",
  component: () => import("@/views/persediaan/GudangView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Daftar Gudang",
  },
},
// ── Persediaan Penyesuaian Stok ──────────────────────────────────
{
  path: "/persediaan/penyesuaian-stok",
  name: "penyesuaianStokBrowse",
  component: () => import("@/views/persediaan/PenyesuaianStokView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Penyesuaian Stok" },
},
{
  path: "/persediaan/penyesuaian-stok/create",
  name: "penyesuaianStokCreate",
  component: () => import("@/views/persediaan/PenyesuaianStokFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Penyesuaian Stok", browseRoute: "penyesuaianStokBrowse" },
},
{
  path: "/persediaan/penyesuaian-stok/edit/:nomor",
  name: "penyesuaianStokEdit",
  component: () => import("@/views/persediaan/PenyesuaianStokFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Penyesuaian Stok", browseRoute: "penyesuaianStokBrowse" },
},

// ── Persediaan Pemusnahan ──────────────────────────────────────────
{
  path: "/persediaan/pemusnahan",
  name: "pemusnahanBrowse",
  component: () => import("@/views/persediaan/PemusnahanView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Pemusnahan" },
},
{
  path: "/persediaan/pemusnahan/create",
  name: "pemusnahanCreate",
  component: () => import("@/views/persediaan/PemusnahanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Pemusnahan", browseRoute: "pemusnahanBrowse" },
},
{
  path: "/persediaan/pemusnahan/edit/:nomor",
  name: "pemusnahanEdit",
  component: () => import("@/views/persediaan/PemusnahanFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Pemusnahan", browseRoute: "pemusnahanBrowse" },
},
// ── Persediaan Mutasi Gudang ───────────────────────────────────────
{
  path: "/persediaan/mutasi-gudang",
  name: "mutasiGudangBrowse",
  component: () => import("@/views/persediaan/MutasiGudangView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Mutasi Gudang" },
},
{
  path: "/persediaan/mutasi-gudang/create",
  name: "mutasiGudangCreate",
  component: () => import("@/views/persediaan/MutasiGudangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Mutasi Gudang", browseRoute: "mutasiGudangBrowse" },
},
{
  path: "/persediaan/mutasi-gudang/edit/:nomor",
  name: "mutasiGudangEdit",
  component: () => import("@/views/persediaan/MutasiGudangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Mutasi Gudang", browseRoute: "mutasiGudangBrowse" },
},
// ── Persediaan Hitung Stok ─────────────────────────────────────────
{
  path: "/persediaan/hitung-stok",
  name: "hitungStokBrowse",
  component: () => import("@/views/persediaan/HitungStokView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Hitung Stok" },
},
{
  path: "/persediaan/hitung-stok/create",
  name: "hitungStokCreate",
  component: () => import("@/views/persediaan/HitungStokFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Hitung Stok", browseRoute: "hitungStokBrowse" },
},
{
  path: "/persediaan/hitung-stok/edit/:nomor",
  name: "hitungStokEdit",
  component: () => import("@/views/persediaan/HitungStokFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Hitung Stok", browseRoute: "hitungStokBrowse" },
},
// list persediaan
{
  path: "/persediaan/list-persediaan",
  name: "listPersediaanBrowse",
  component: () => import("@/views/persediaan/ListPersediaanView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "List Persediaan",
  },
},
// serah terima ekspedisi
{
  path: "/persediaan/serah-terima-ekspedisi",
  name: "serahTerimaEkspedisiBrowse",
  component: () => import("@/views/persediaan/SerahTerimaEkspedisiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Serah Terima Ekspedisi" },
},
{
  path: "/persediaan/serah-terima-ekspedisi/create",
  name: "serahTerimaEkspedisiCreate",
  component: () => import("@/views/persediaan/SerahTerimaEkspedisiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Serah Terima Ekspedisi", browseRoute: "serahTerimaEkspedisiBrowse" },
},
{
  path: "/persediaan/serah-terima-ekspedisi/edit/:nomor",
  name: "serahTerimaEkspedisiEdit",
  component: () => import("@/views/persediaan/SerahTerimaEkspedisiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Serah Terima Ekspedisi", browseRoute: "serahTerimaEkspedisiBrowse" },
},
{
  path: "/persediaan/serah-terima-ekspedisi/print/:nomor",
  name: "serahTerimaEkspedisiPrint",
  component: () => import("@/views/persediaan/SerahTerimaEkspedisiPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Serah Terima Ekspedisi" },
},
// tagihan ekspedisi
{
  path: "/persediaan/tagihan-ekspedisi",
  name: "tagihanEkspedisiBrowse",
  component: () => import("@/views/persediaan/TagihanEkspedisiView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tagihan Ekspedisi" },
},
{
  path: "/persediaan/tagihan-ekspedisi/create",
  name: "tagihanEkspedisiCreate",
  component: () => import("@/views/persediaan/TagihanEkspedisiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Tagihan Ekspedisi", browseRoute: "tagihanEkspedisiBrowse" },
},
{
  path: "/persediaan/tagihan-ekspedisi/edit/:nomor",
  name: "tagihanEkspedisiEdit",
  component: () => import("@/views/persediaan/TagihanEkspedisiFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Tagihan Ekspedisi", browseRoute: "tagihanEkspedisiBrowse" },
},
{
  path: "/persediaan/tagihan-ekspedisi/v2/create",
  name: "tagihanEkspedisi2Create",
  component: () => import("@/views/persediaan/TagihanEkspedisi2FormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Tagihan Ekspedisi V2", browseRoute: "tagihanEkspedisiBrowse" },
},
{
  path: "/persediaan/tagihan-ekspedisi/v2/edit/:nomor",
  name: "tagihanEkspedisi2Edit",
  component: () => import("@/views/persediaan/TagihanEkspedisi2FormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Tagihan Ekspedisi V2", browseRoute: "tagihanEkspedisiBrowse" },
},
{
  path: "/persediaan/tagihan-ekspedisi/print/:nomor",
  name: "tagihanEkspedisiPrint",
  component: () => import("@/views/persediaan/TagihanEkspedisiPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Tagihan Ekspedisi" },
},
{
  path: "/persediaan/permintaan-barang",
  name: "permintaanBarangBrowse",
  component: () => import("@/views/persediaan/PermintaanBarangView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Permintaan Barang" },
},
{
  path: "/persediaan/permintaan-barang/create",
  name: "permintaanBarangCreate",
  component: () => import("@/views/persediaan/PermintaanBarangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Permintaan Barang", browseRoute: "permintaanBarangBrowse" },
},
{
  path: "/persediaan/permintaan-barang/edit/:nomor",
  name: "permintaanBarangEdit",
  component: () => import("@/views/persediaan/PermintaanBarangFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Permintaan Barang", browseRoute: "permintaanBarangBrowse" },
},
// KAS BANK - PENERIMAAN LAIN
{
  path: "/kasbank/penerimaan-lain",
  name: "penerimaanLainBrowse",
  component: () => import("@/views/kasbank/PenerimaanLainView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Penerimaan Lain-Lain" },
},
{
  path: "/kasbank/penerimaan-lain/create",
  name: "penerimaanLainCreate",
  component: () => import("@/views/kasbank/PenerimaanLainFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Penerimaan Lain", browseRoute: "penerimaanLainBrowse" },
},
{
  path: "/kasbank/penerimaan-lain/edit/:nomor",
  name: "penerimaanLainEdit",
  component: () => import("@/views/kasbank/PenerimaanLainFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Penerimaan Lain", browseRoute: "penerimaanLainBrowse" },
},
// ── Cetak Penerimaan Lain (browser print, paritas penerimaanlain.fr3) ──
{
  path: "/kasbank/penerimaan-lain/print/:nomor",
  name: "penerimaanLainPrint",
  component: () => import("@/views/kasbank/PenerimaanLainPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Penerimaan Lain" },
},
// PEMBAYARAN LAIN
{
  path: "/kasbank/pembayaran-lain",
  name: "pembayaranLainBrowse",
  component: () => import("@/views/kasbank/PembayaranLainView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Pembayaran Lain-Lain" },
},
{
  path: "/kasbank/pembayaran-lain/create",
  name: "pembayaranLainCreate",
  component: () => import("@/views/kasbank/PembayaranLainFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Pembayaran Lain", browseRoute: "pembayaranLainBrowse" },
},
{
  path: "/kasbank/pembayaran-lain/edit/:nomor",
  name: "pembayaranLainEdit",
  component: () => import("@/views/kasbank/PembayaranLainFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Pembayaran Lain", browseRoute: "pembayaranLainBrowse" },
},
// ── Cetak Pembayaran Lain (browser print, paritas pembayaranlain.fr3) ──
{
  path: "/kasbank/pembayaran-lain/print/:nomor",
  name: "pembayaranLainPrint",
  component: () => import("@/views/kasbank/PembayaranLainPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Pembayaran Lain" },
},
// BUKU BANK
{
  path: "/kasbank/buku-bank",
  name: "bukuBankBrowse",
  component: () => import("@/views/kasbank/BukuBankView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Buku Bank",
  },
},
// KAS HARIAN
{
  path: "/kasbank/kas-harian",
  name: "kasHarianBrowse",
  component: () => import("@/views/kasbank/KasHarianView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "Kas Harian",
  },
},
{
  path: "/kasbank/pencairan-giro",
  name: "pencairanGiroBrowse",
  component: () => import("@/views/kasbank/PencairanGiroView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Pencairan Giro" },
},
{
  path: "/kasbank/pencairan-giro/create",
  name: "pencairanGiroCreate",
  component: () => import("@/views/kasbank/PencairanGiroFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Pencairan Giro", browseRoute: "pencairanGiroBrowse" },
},
{
  path: "/kasbank/pencairan-giro/edit/:nomor",
  name: "pencairanGiroEdit",
  component: () => import("@/views/kasbank/PencairanGiroFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Pencairan Giro", browseRoute: "pencairanGiroBrowse" },
},
// JURNAL UMUM
{
  path: "/bukubesar/jurnal-umum",
  name: "jurnalUmumBrowse",
  component: () => import("@/views/bukubesar/JurnalUmumView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Jurnal Umum" },
},
{
  path: "/bukubesar/jurnal-umum/create",
  name: "jurnalUmumCreate",
  component: () => import("@/views/bukubesar/JurnalUmumFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Tambah Jurnal Umum", browseRoute: "jurnalUmumBrowse" },
},
{
  path: "/bukubesar/jurnal-umum/edit/:nomor",
  name: "jurnalUmumEdit",
  component: () => import("@/views/bukubesar/JurnalUmumFormView.vue"),
  meta: { layout: "DefaultLayout", requiresAuth: true, title: "Ubah Jurnal Umum", browseRoute: "jurnalUmumBrowse" },
},
// ── Cetak Jurnal Umum (browser print, paritas JURNALUMUM.fr3) ──
{
  path: "/bukubesar/jurnal-umum/print/:nomor",
  name: "jurnalUmumPrint",
  component: () => import("@/views/bukubesar/JurnalUmumPrintView.vue"),
  meta: { layout: "BlankLayout", requiresAuth: true, requiresPermission: false, title: "Cetak Jurnal Umum" },
},
{
  path: "/bukubesar/list-jurnal",
  name: "listJurnalBrowse",
  component: () => import("@/views/bukubesar/ListJurnalView.vue"),
  meta: {
    layout: "DefaultLayout",
    requiresAuth: true,
    title: "List Jurnal",
  },
},

  ],
});

// ── Navigation Guard ──────────────────────────────────────────────────
router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const permissionStore = usePermissionStore();
  const { loadRoutes, resetRoutes, isRoutesLoaded } = useDynamicRoutes();

  document.title = `${String(to.meta?.title || to.name || "Retail")} — krm`;

  // 1. Cek autentikasi
  if (to.meta.requiresAuth && !authStore.isAuthenticated)
    return { name: "Login" };

  // 2. Kalau sudah login dan ke /login, redirect ke dashboard
  if (to.name === "Login" && authStore.isAuthenticated)
    return { name: "Dashboard" };

  // 3. Saat logout, bersihkan dynamic routes user sebelumnya
  if (to.name === "Login") resetRoutes(router);

  // 4. Load dynamic routes dari DB (sekali per user)
  if (to.meta.requiresAuth && !isRoutesLoaded.value) {
    await loadRoutes(router);
    if (isRoutesLoaded.value) return to.fullPath;
  }

  // 5. Cek permission akses route
  if (
    to.meta.requiresAuth &&
    to.meta.requiresPermission !== false &&
    to.meta.layout !== "BlankLayout" &&
    !permissionStore.canAccessRoute(to.path)
  )
    return { name: "Unauthorized", query: { from: to.fullPath } };
});

// ── Auto-open Tab Bar ─────────────────────────────────────────────────
const browseFallbackTitle: Record<string, string> = {
  "/transaksi/bpb": "Penerimaan Barang",
  "/transaksi/retur": "Retur Pembelian",
  "/transaksi/bayarSupplier": "Pembayaran Supplier",
  "/transaksi/terima-setoran": "Terima Setoran",
};

const prettyRouteName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

router.afterEach((to) => {
  // BlankLayout (login/cetak/error) tidak punya tab
  if (to.meta.layout === "BlankLayout") return;

  const tabsStore = useTabsStore();
  if (!tabsStore.isReady) tabsStore.initDefaultTabs();

  const title = String(
    to.meta?.title ||
      browseFallbackTitle[to.path] ||
      (to.name ? prettyRouteName(String(to.name)) : "Halaman"),
  );

  tabsStore.openTab({
    title,
    path: to.path,
    query: to.query,
    closable: to.path !== "/",
  });
});

export default router;