const express = require("express");
const router = express.Router();

// ── Core Routes ──
const authRoutes = require("./authRoutes");
const menuRoutes = require("./menuRoutes");
const lookupRoutes = require("./lookupRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const masterUserRoutes = require("./tools/masterUserRoutes");
const masterUserFormRoutes = require("./tools/masterUserFormRoutes");

// ── Utility Routes ──
const tutupPeriodeRoutes = require("./utility/tutupPeriodeRoutes");
const prosesBiayaPromosiRoutes = require("./utility/prosesBiayaPromosiRoutes");
const prosesFeeMarketingRoutes = require("./utility/prosesFeeMarketingRoutes");
const settingEstimasiSalesmanRoutes = require("./utility/settingEstimasiSalesmanRoutes");
const settingJadwalSalesRoutes = require("./utility/settingJadwalSalesRoutes");
const cetakKunjunganRoutes = require("./utility/cetakKunjunganRoutes");
const penugasanDriverRoutes = require("./utility/penugasanDriverRoutes");

// ── Pembelian Routes ──
const poRoutes = require("./pembelian/poRoutes");
const poFormRoutes = require("./pembelian/poFormRoutes");
const bpbRoutes = require("./pembelian/bpbRoutes");
const bpbFormRoutes = require("./pembelian/bpbFormRoutes");
const invoiceRoutes = require("./pembelian/invoiceRoutes");
const invoiceFormRoutes = require("./pembelian/invoiceFormRoutes");
const bayarSupplierRoutes = require("./pembelian/bayarSupplierRoutes");
const bayarSupplierFormRoutes = require("./pembelian/bayarSupplierFormRoutes");
const returBeliRoutes = require("./pembelian/returBeliRoutes");
const returBeliFormRoutes = require("./pembelian/returBeliFormRoutes");

// ── Daftar Routes ──
const costCenterRoutes = require("./daftar/costCenterRoutes");

// ── Transaksi Routes ──
const soRoutes = require("./penjualan/soRoutes");
const soFormRoutes = require("./penjualan/soFormRoutes");

const doRoutes = require("./penjualan/doRoutes");
const doFormRoutes = require("./penjualan/doFormRoutes");

const fpRoutes = require("./penjualan/fpRoutes");
const fpFormRoutes = require("./penjualan/fpFormRoutes");

const bayarCustomerRoutes = require("./penjualan/bayarCustomerRoutes");
const bayarCustomerFormRoutes = require("./penjualan/bayarCustomerFormRoutes");

const bayarBiayaPromosiRoutes = require("./penjualan/bayarBiayaPromosiRoutes");
const bayarBiayaPromosiFormRoutes = require("./penjualan/bayarBiayaPromosiFormRoutes");

const bayarFeeMarketingRoutes = require("./penjualan/bayarFeeMarketingRoutes");
const bayarFeeMarketingFormRoutes = require("./penjualan/bayarFeeMarketingFormRoutes");

const returPenjualanRoutes = require("./penjualan/returPenjualanRoutes");
const returPenjualanFormRoutes = require("./penjualan/returPenjualanFormRoutes");

const fakturManualRoutes = require("./penjualan/fakturManualRoutes");
const fakturManualFormRoutes = require("./penjualan/fakturManualFormRoutes");

const fakturPajakRoutes = require("./penjualan/fakturPajakRoutes");
const fakturPajakFormRoutes = require("./penjualan/fakturPajakFormRoutes");
const fakturPajakV3Routes = require("./penjualan/fakturPajakV3Routes");

const serahTerimaFakturSalesmanRoutes = require("./penjualan/serahTerimaFakturSalesmanRoutes");
const serahTerimaFakturSalesmanFormRoutes = require("./penjualan/serahTerimaFakturSalesmanFormRoutes");
const serahTerimaFakturRoutes = require("./penjualan/serahTerimaFakturRoutes");
const serahTerimaFakturFormRoutes = require("./penjualan/serahTerimaFakturFormRoutes");

const ttFakturRoutes = require("./penjualan/ttFakturRoutes");
const ttFakturFormRoutes = require("./penjualan/ttFakturFormRoutes");
const listJualPerItemRoutes = require("./penjualan/listJualPerItemRoutes");
const listJualPerFakturRoutes = require("./penjualan/listJualPerFakturRoutes");
const listJualPerOutletRoutes = require("./penjualan/listJualPerOutletRoutes");
const listJualPerItemAkumulatifRoutes = require("./penjualan/listJualPerItemAkumulatifRoutes");
const listJualPerFakturMarginRoutes = require("./laporan/listJualPerFakturMarginRoutes");
const listFakturOutstandingRoutes = require("./laporan/listFakturOutstandingRoutes");
const listInkasoRoutes = require("./laporan/listInkasoRoutes");
const listMutasiStokRoutes = require("./laporan/listMutasiStokRoutes");
const listHistoryStokRoutes = require("./laporan/listHistoryStokRoutes");
const stokExpiredRoutes = require("./laporan/stokExpiredRoutes");
const kartuStokRoutes = require("./laporan/kartuStokRoutes");
const barangRealisasiRoutes = require("./laporan/barangRealisasiRoutes");
const doRealisasiRoutes = require("./laporan/doRealisasiRoutes");
const lapBulanan4Routes = require("./laporan/lapBulanan4Routes");
const lapBulanan5Routes = require("./laporan/lapBulanan5Routes");
const lapYTDRoutes = require("./laporan/lapYTDRoutes");
const lapNeracaRoutes = require("./laporan/lapNeracaRoutes");
const lapLabaRugiRoutes = require("./laporan/lapLabaRugiRoutes");
const historyHargaJualRoutes = require("./laporan/historyHargaJualRoutes");
const transaksiHarianRoutes = require("./laporan/transaksiHarianRoutes");
const transaksiHarian2Routes = require("./laporan/transaksiHarian2Routes");
const saldoPiutangRoutes = require("./laporan/saldoPiutangRoutes");
const itemMarginMinusRoutes = require("./laporan/itemMarginMinusRoutes");
const komisiSalesmanRoutes = require("./komisi/komisiSalesmanRoutes");
const perusahaanRoutes = require("./setting/perusahaanRoutes");

const estimasiSalesRoutes = require("./laporan/estimasiSalesRoutes");
const omsetVsKategoriRoutes = require("./laporan/omsetVsKategoriRoutes");
const inkasoBawahHetRoutes = require("./laporan/inkasoBawahHetRoutes");

const aiRoutes = require("./aiRoutes");

const otorisasiRoutes = require("./otorisasiRoutes");

const rekeningRoutes = require("./daftar/rekeningRoutes");
const rekeningFormRoutes = require("./daftar/rekeningFormRoutes");


// DAFTAR
const salesmanRoutes = require("./daftar/salesmanRoutes");
const salesmanFormRoutes = require("./daftar/salesmanFormRoutes");

const salesmanAktifRoutes = require("./daftar/salesmanAktifRoutes");
const salesmanAktifFormRoutes = require("./daftar/salesmanAktifFormRoutes");

const supplierRoutes = require("./daftar/supplierRoutes");
const supplierFormRoutes = require("./daftar/supplierFormRoutes");

const customerRoutes = require("./daftar/customerRoutes");
const customerFormRoutes = require("./daftar/customerFormRoutes");

const jenisCustomerRoutes = require("./daftar/jenisCustomerRoutes");
const jenisCustomerFormRoutes = require("./daftar/jenisCustomerFormRoutes");

const settingPackingRoutes = require("./daftar/settingPackingRoutes");
const settingPackingFormRoutes = require("./daftar/settingPackingFormRoutes");

const settingBiayaPromosiRoutes = require("./daftar/settingBiayaPromosiRoutes");
const settingBiayaPromosiFormRoutes = require("./daftar/settingBiayaPromosiFormRoutes");

const settingFeeMarketingRoutes = require("./daftar/settingFeeMarketingRoutes");
const settingFeeMarketingFormRoutes = require("./daftar/settingFeeMarketingFormRoutes");

const groupProdukFokusRoutes = require("./daftar/groupProdukFokusRoutes");

const kendaraanRoutes = require("./daftar/kendaraanRoutes");
const kendaraanFormRoutes = require("./daftar/kendaraanFormRoutes");

const ekspedisiRoutes = require("./daftar/ekspedisiRoutes");
const ekspedisiFormRoutes = require("./daftar/ekspedisiFormRoutes");

const divisiRoutes = require("./daftar/divisiRoutes");
const divisiFormRoutes = require("./daftar/divisiFormRoutes");

// PERSEDIAAN 

const subBarangRoutes = require("./persediaan/subBarangRoutes");
const subBarangFormRoutes = require("./persediaan/subBarangFormRoutes");

const barangRoutes = require("./persediaan/barangRoutes");
const barangFormRoutes = require("./persediaan/barangFormRoutes");

const gudangRoutes = require("./persediaan/gudangRoutes");
const gudangFormRoutes = require("./persediaan/gudangFormRoutes");

const penyesuaianStokRoutes = require("./persediaan/penyesuaianStokRoutes");
const koreksiStokFormRoutes = require("./persediaan/koreksiStokFormRoutes");

const pemusnahanRoutes = require("./persediaan/pemusnahanRoutes");
const pemusnahanFormRoutes = require("./persediaan/pemusnahanFormRoutes");

const mutasiGudangRoutes = require("./persediaan/mutasiGudangRoutes");
const mutasiGudangFormRoutes = require("./persediaan/mutasiGudangFormRoutes");

const hitungStokRoutes = require("./persediaan/hitungStokRoutes");
const hitungStokFormRoutes = require("./persediaan/hitungStokFormRoutes");

const listPersediaanRoutes = require("./persediaan/listPersediaanRoutes");

const serahTerimaEkspedisiRoutes = require("./persediaan/serahTerimaEkspedisiRoutes");
const serahTerimaEkspedisiFormRoutes = require("./persediaan/serahTerimaEkspedisiFormRoutes");

const tagihanEkspedisiRoutes = require("./persediaan/tagihanEkspedisiRoutes");
const tagihanEkspedisiFormRoutes = require("./persediaan/tagihanEkspedisiFormRoutes");

const permintaanBarangRoutes = require("./persediaan/permintaanBarangRoutes");
const permintaanBarangFormRoutes = require("./persediaan/permintaanBarangFormRoutes");

const penerimaanLainRoutes = require("./kasbank/penerimaanLainRoutes");
const penerimaanLainFormRoutes = require("./kasbank/penerimaanLainFormRoutes");

const pembayaranLainRoutes = require("./kasbank/pembayaranLainRoutes");
const pembayaranLainFormRoutes = require("./kasbank/pembayaranLainFormRoutes");

const bukuBankRoutes = require("./kasbank/bukuBankRoutes");

const kasHarianRoutes = require("./kasbank/kasHarianRoutes");

const pencairanGiroRoutes = require("./kasbank/pencairanGiroRoutes");
const pencairanGiroFormRoutes = require("./kasbank/pencairanGiroFormRoutes");

const jurnalUmumRoutes = require("./bukubesar/jurnalUmumRoutes");
const jurnalUmumFormRoutes = require("./bukubesar/jurnalUmumFormRoutes");

const listJurnalRoutes = require("./bukubesar/listJurnalRoutes");

// ── Core ──
router.use("/auth", authRoutes);
router.use("/menu", menuRoutes);
router.use("/lookups", lookupRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/tools/master-user", masterUserRoutes);
router.use("/tools/master-user/form", masterUserFormRoutes);

// ── Utility ──
router.use("/utility/tutup-periode", tutupPeriodeRoutes);
router.use("/utility/proses-biaya-promosi", prosesBiayaPromosiRoutes);
router.use("/utility/proses-fee-marketing", prosesFeeMarketingRoutes);
router.use("/utility/setting-estimasi-salesman", settingEstimasiSalesmanRoutes);
router.use("/utility/setting-jadwal-sales", settingJadwalSalesRoutes);
router.use("/utility/cetak-kunjungan", cetakKunjunganRoutes);
router.use("/utility/penugasan-driver", penugasanDriverRoutes);

// ── Daftar ──
router.use("/daftar/cost-center", costCenterRoutes);

// ── Pembelian ──
router.use("/pembelian/po", poRoutes);
router.use("/pembelian/po/form", poFormRoutes);
router.use("/pembelian/bpb", bpbRoutes);
router.use("/pembelian/bpb/form", bpbFormRoutes);
router.use("/pembelian/invoice", invoiceRoutes);
router.use("/pembelian/invoice/form", invoiceFormRoutes);
router.use("/pembelian/bayar-supplier", bayarSupplierRoutes);
router.use("/pembelian/bayar-supplier/form", bayarSupplierFormRoutes);
router.use("/pembelian/retur-beli", returBeliRoutes);
router.use("/pembelian/retur-beli/form", returBeliFormRoutes);

// ── Transaksi ──
router.use("/penjualan/so", soRoutes);
router.use("/penjualan/so/form", soFormRoutes);

router.use("/penjualan/do", doRoutes);
router.use("/penjualan/do/form", doFormRoutes);

router.use("/penjualan/fp", fpRoutes);
router.use("/penjualan/fp/form", fpFormRoutes);

router.use("/penjualan/bayar-customer", bayarCustomerRoutes);
router.use("/penjualan/bayar-customer/form", bayarCustomerFormRoutes);

router.use("/penjualan/bayar-biaya-promosi", bayarBiayaPromosiRoutes);
router.use("/penjualan/bayar-biaya-promosi/form", bayarBiayaPromosiFormRoutes);

router.use("/penjualan/bayar-fee-marketing", bayarFeeMarketingRoutes);
router.use("/penjualan/bayar-fee-marketing/form", bayarFeeMarketingFormRoutes);

router.use("/penjualan/retur-penjualan", returPenjualanRoutes);
router.use("/penjualan/retur-penjualan/form", returPenjualanFormRoutes);

router.use("/penjualan/faktur-manual", fakturManualRoutes);
router.use("/penjualan/faktur-manual/form", fakturManualFormRoutes);

router.use("/penjualan/faktur-pajak", fakturPajakRoutes);
router.use("/penjualan/faktur-pajak/form", fakturPajakFormRoutes);
router.use("/penjualan/faktur-pajak-v3", fakturPajakV3Routes);

router.use("/penjualan/serah-terima-faktur-salesman", serahTerimaFakturSalesmanRoutes);
router.use("/penjualan/serah-terima-faktur-salesman/form", serahTerimaFakturSalesmanFormRoutes);

router.use("/penjualan/serah-terima-faktur", serahTerimaFakturRoutes);
router.use("/penjualan/serah-terima-faktur/form", serahTerimaFakturFormRoutes);

router.use("/penjualan/tt-faktur", ttFakturRoutes);
router.use("/penjualan/tt-faktur/form", ttFakturFormRoutes);
router.use("/penjualan/list-jual-per-item", listJualPerItemRoutes);
router.use("/penjualan/list-jual-per-faktur", listJualPerFakturRoutes);
router.use("/penjualan/list-jual-per-outlet", listJualPerOutletRoutes);
router.use("/penjualan/list-jual-per-item-akumulatif", listJualPerItemAkumulatifRoutes);

// laporan
router.use("/laporan/list-jual-per-faktur-margin", listJualPerFakturMarginRoutes);
router.use("/laporan/list-faktur-outstanding", listFakturOutstandingRoutes);
router.use("/laporan/list-inkaso", listInkasoRoutes);
router.use("/laporan/list-mutasi-stok", listMutasiStokRoutes);
router.use("/laporan/list-history-stok", listHistoryStokRoutes);
router.use("/laporan/stok-expired", stokExpiredRoutes);
router.use("/laporan/kartu-stok", kartuStokRoutes);
router.use("/laporan/barang-realisasi", barangRealisasiRoutes);
router.use("/laporan/do-realisasi", doRealisasiRoutes);
router.use("/laporan/lap-bulanan4", lapBulanan4Routes);
router.use("/laporan/lap-bulanan5", lapBulanan5Routes);
router.use("/laporan/lap-ytd", lapYTDRoutes);
router.use("/laporan/lap-neraca", lapNeracaRoutes);
router.use("/laporan/lap-laba-rugi", lapLabaRugiRoutes);
router.use("/laporan/history-harga-jual", historyHargaJualRoutes);
router.use("/laporan/transaksi-harian", transaksiHarianRoutes);
router.use("/laporan/transaksi-harian2", transaksiHarian2Routes);
router.use("/laporan/saldo-piutang", saldoPiutangRoutes);
router.use("/laporan/item-margin-minus", itemMarginMinusRoutes);
router.use("/laporan/estimasi-sales", estimasiSalesRoutes);
router.use("/laporan/omset-vs-kategori", omsetVsKategoriRoutes);
router.use("/laporan/inkaso-bawah-het", inkasoBawahHetRoutes);

// daftar
router.use("/daftar/salesman", salesmanRoutes);
router.use("/daftar/salesman/form", salesmanFormRoutes);

router.use("/daftar/salesman-aktif", salesmanAktifRoutes);
router.use("/daftar/salesman-aktif/form", salesmanAktifFormRoutes);

router.use("/daftar/supplier", supplierRoutes);
router.use("/daftar/supplier/form", supplierFormRoutes);

router.use("/daftar/customer", customerRoutes);
router.use("/daftar/customer/form", customerFormRoutes);

router.use("/daftar/jenis-customer", jenisCustomerRoutes);
router.use("/daftar/jenis-customer/form", jenisCustomerFormRoutes);

router.use("/daftar/setting-packing", settingPackingRoutes);
router.use("/daftar/setting-packing/form", settingPackingFormRoutes);

router.use("/daftar/setting-biaya-promosi", settingBiayaPromosiRoutes);
router.use("/daftar/setting-biaya-promosi/form", settingBiayaPromosiFormRoutes);

router.use("/daftar/setting-fee-marketing", settingFeeMarketingRoutes);
router.use("/daftar/setting-fee-marketing/form", settingFeeMarketingFormRoutes);

router.use("/daftar/group-produk-fokus", groupProdukFokusRoutes);

router.use("/daftar/kendaraan", kendaraanRoutes);
router.use("/daftar/kendaraan/form", kendaraanFormRoutes);

router.use("/daftar/ekspedisi", ekspedisiRoutes);
router.use("/daftar/ekspedisi/form", ekspedisiFormRoutes);

router.use("/daftar/divisi", divisiRoutes);
router.use("/daftar/divisi/form", divisiFormRoutes);

router.use("/daftar/rekening", rekeningRoutes);
router.use("/daftar/rekening/form", rekeningFormRoutes);


// PERSEDIAAN 
router.use("/persediaan/sub-barang", subBarangRoutes);
router.use("/persediaan/sub-barang/form", subBarangFormRoutes);

router.use("/persediaan/barang", barangRoutes);
router.use("/persediaan/barang/form", barangFormRoutes);

router.use("/persediaan/gudang", gudangRoutes);
router.use("/persediaan/gudang/form", gudangFormRoutes);

router.use("/persediaan/penyesuaian-stok", penyesuaianStokRoutes);
router.use("/persediaan/koreksi-stok/form", koreksiStokFormRoutes);

router.use("/persediaan/pemusnahan", pemusnahanRoutes);
router.use("/persediaan/pemusnahan/form", pemusnahanFormRoutes);

router.use("/persediaan/mutasi-gudang", mutasiGudangRoutes);
router.use("/persediaan/mutasi-gudang/form", mutasiGudangFormRoutes);

router.use("/persediaan/hitung-stok", hitungStokRoutes);
router.use("/persediaan/hitung-stok/form", hitungStokFormRoutes);

router.use("/persediaan/list-persediaan", listPersediaanRoutes);

router.use("/persediaan/serah-terima-ekspedisi", serahTerimaEkspedisiRoutes);
router.use("/persediaan/serah-terima-ekspedisi/form", serahTerimaEkspedisiFormRoutes);

router.use("/persediaan/tagihan-ekspedisi", tagihanEkspedisiRoutes);
router.use("/persediaan/tagihan-ekspedisi/form", tagihanEkspedisiFormRoutes);

router.use("/persediaan/permintaan-barang", permintaanBarangRoutes);
router.use("/persediaan/permintaan-barang/form", permintaanBarangFormRoutes);

// TITIP BARANG KONSINYASI

const titipRoutes = require("./persediaan/titipRoutes");
router.use("/persediaan/titip", titipRoutes);

// KAS BANK

router.use("/kasbank/penerimaan-lain", penerimaanLainRoutes);
router.use("/kasbank/penerimaan-lain/form", penerimaanLainFormRoutes);

router.use("/kasbank/pembayaran-lain", pembayaranLainRoutes);
router.use("/kasbank/pembayaran-lain/form", pembayaranLainFormRoutes);

router.use("/kasbank/buku-bank", bukuBankRoutes);

router.use("/kasbank/kas-harian", kasHarianRoutes);

router.use("/kasbank/pencairan-giro", pencairanGiroRoutes);
router.use("/kasbank/pencairan-giro/form", pencairanGiroFormRoutes);

// BUKU BESAR
router.use("/bukubesar/jurnal-umum", jurnalUmumRoutes);
router.use("/bukubesar/jurnal-umum/form", jurnalUmumFormRoutes);

router.use("/bukubesar/list-jurnal", listJurnalRoutes);

// SETTING
router.use("/setting/perusahaan", perusahaanRoutes);

// KOMISI
router.use("/komisi/salesman", komisiSalesmanRoutes);

// AI ASSISTANT
router.use("/ai", aiRoutes);

// OTORISASI (catatan + verifikasi terikat transaksi)
router.use("/otorisasi", otorisasiRoutes);

module.exports = router;

