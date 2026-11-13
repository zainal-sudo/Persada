<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SearchModal from "@/components/SearchModal.vue";
import OtorisasiDialog from "@/components/OtorisasiDialog.vue";
import {
  IconFileInvoice,
  IconSearch,
  IconPlus,
  IconTrash,
  IconHistory,
  IconArchive,
} from "@tabler/icons-vue";
import { fpFormApi, type FPForm, type FPDetail } from "@/api/penjualan/fpFormApi";
import { type OtorisasiKonteks } from "@/api/otorisasiApi";
import { useAfterSave } from "@/composables/useAfterSave";
import {
  useFpDrafts,
  isFormDirty,
  draftRingkas,
  type FpDraft,
} from "@/composables/useFpDrafts";
import { useFpPrint } from "@/composables/useFpPrint";
import { useDetailGrid } from "@/composables/useDetailGrid";

import DsDatePicker from "@/components/DsDatePicker.vue";
const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  showRecetakDialog,
  recetakNomor,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  confirmRecetak,
  cancelRecetak,
  PrinterDialog,
  PrintPreviewDialog,
} = useFpPrint();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<FPForm>({
  isEdit: false,
  nomor: "",
  nomorSO: "",
  tanggal: today,
  jthTempo: today,
  memo: "",
  cusKode: "",
  cusNama: "",
  alamat: "",
  telp: "",
  salesman: "",
  isTax: 1,
  isEcer: 0,
  isCatalog: 0,
  tipecash: 0,
  isDTP: 0,
  discFakturPr: 0,
  discFaktur: 0,
  biayaPr: 0,
  biayaRp: 0,
  freight: 0,
  amount: 0,
  taxAmount: 0,
  dp: 0,
  cn: 0,
  totalSetelahRetur: 0,
  detail: [],
});

// ── Modal State ──────────────────────────────────────────────────────
const showDOModal = ref(false);
const doOptions = ref<any[]>([]);
const doLoading = ref(false);

// ── Riwayat Harga State ────────────────────────────────────────────
const showRiwayatHargaModal = ref(false);
const riwayatHargaItems = ref<any[]>([]);
const riwayatHargaLoading = ref(false);
const riwayatHargaIndex = ref(-1);

const openRiwayatHargaModal = async (idx: number) => {
  const d = form.value.detail[idx];
  if (!d.brgKode || !form.value.cusKode) {
    toast.warning("Customer dan barang harus dipilih dulu.");
    return;
  }
  riwayatHargaIndex.value = idx;
  showRiwayatHargaModal.value = true;
  riwayatHargaLoading.value = true;
  try {
    riwayatHargaItems.value = await fpFormApi.getRiwayatHarga(
      d.brgKode,
      form.value.cusKode,
      form.value.nomor
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat riwayat harga.");
  } finally {
    riwayatHargaLoading.value = false;
  }
};

const selectRiwayatHarga = (item: any) => {
  const idx = riwayatHargaIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  const d = form.value.detail[idx];
  d.harga = Number(item.Harga);
  d.discPr = Number(item.Disc) || 0;
  updateRowTotal(d);
  showRiwayatHargaModal.value = false;
};

// ── Dialog konfirmasi generik (MessageDlg paritas) ───────────────────
const confirmState = ref<{
  visible: boolean;
  title: string;
  message: string;
  onYes: () => void;
  onNo: () => void;
}>({ visible: false, title: "", message: "", onYes: () => {}, onNo: () => {} });

const askConfirmDialog = (message: string, title = "Konfirmasi"): Promise<boolean> => {
  return new Promise((resolve) => {
    confirmState.value = {
      visible: true,
      title,
      message,
      onYes: () => { confirmState.value.visible = false; resolve(true); },
      onNo: () => { confirmState.value.visible = false; resolve(false); },
    };
  });
};

// ── Otorisasi (paritas TfrmOtorisasi / TfrmOtorisasi2) ───────────────
const showOtorisasi = ref(false);
const otorisasiVariant = ref<1 | 2>(1);
const otorisasiKonteks = ref<OtorisasiKonteks | null>(null);
const otorisasiKodeCache = ref<string | null>(null);
const otorisasiResolve = ref<((kode: string | null) => void) | null>(null);
// Baris detail yang sedang dimintai otorisasi — dipakai untuk menyimpan
// kembali kode yang di-request (belum terverifikasi) ke baris itu, supaya
// draft menyimpan kode yang sama saat dialog dibuka ulang.
const validatingDetail = ref<FPDetail | null>(null);

// Keterangan dialog otorisasi: customer - nama barang - harga (harga kolom).
const otorisasiKeterangan = computed(() => {
  const d = validatingDetail.value;
  if (!d) return "";
  const cus = form.value.cusNama || form.value.cusKode || "";
  return `${cus} - ${d.brgNama} - ${fmt(Number(d.harga || 0))}`;
});

const askOtorisasi = (
  variant: 1 | 2,
  konteks: OtorisasiKonteks,
  kodeCache: string | null = null
): Promise<string | null> => {
  otorisasiVariant.value = variant;
  otorisasiKonteks.value = konteks;
  otorisasiKodeCache.value = kodeCache;
  showOtorisasi.value = true;
  return new Promise((resolve) => {
    otorisasiResolve.value = resolve;
  });
};

const onOtorisasiSuccess = (kode: string) => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(kode);
  otorisasiResolve.value = null;
};

const onOtorisasiFail = (/* kode */) => {
  // Password salah: jangan simpan kode ke baris (hanya "Simpan Draft" yang
  // mempertahankan kode). Dengan begitu dialog berikutnya memakai kode baru.
  showOtorisasi.value = false;
  otorisasiResolve.value?.(null);
  otorisasiResolve.value = null;
  toast.error("Otorisasi salah");
};

// Batal: tutup tanpa notif & tanpa menyimpan kode.
const onOtorisasiCancel = () => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(null);
  otorisasiResolve.value = null;
};

// Tombol "Simpan Draft" dari dalam dialog otorisasi — snapshot form saat ini
// (termasuk kode otorisasi yang masih pending ke baris terkait), lalu tutup
// dialog otorisasi & hentikan alur validasi baris.
const onOtorisasiDraft = (kode?: string) => {
  if (kode && validatingDetail.value) {
    validatingDetail.value.otorisasiKode = kode;
  }
  const dSnapshot = simpanDraft(true);
  if (dSnapshot) {
    toast.success(`Draft disimpan: ${dSnapshot.nama}`);
  }
  showOtorisasi.value = false;
  otorisasiResolve.value?.(null);
  otorisasiResolve.value = null;
};

// ── Guard tanggal (paritas dtTanggalChange + hitung jthTempo) ────────
// Nomor FP mengandung yymm (CABANG-FP.yymm.NNNN) — di mode edit tanggal
// tidak boleh pindah bulan/tahun. Jth tempo selalu = tanggal + top.
// Server memvalidasi ulang guard nomor saat save.
const tanggalOld = ref("");
const onTanggalChange = () => {
  const nv = form.value.tanggal;
  if (!nv) return;

  // Paritas Delphi: dtTglJT.DateTime := dtTanggal.DateTime + getTop(customer)
  if (form.value.cusKode) {
    const top = Number(form.value.top || 0);
    const tgl = new Date(nv);
    tgl.setDate(tgl.getDate() + top);
    form.value.jthTempo = tgl.toISOString().split("T")[0];
  }

  if (!isEdit.value || !form.value.nomor) {
    tanggalOld.value = nv;
    return;
  }
  const yy = nv.slice(2, 4);
  const mm = nv.slice(5, 7);
  const prefix = form.value.nomor.slice(0, 6) + yy + mm + ".";
  if (prefix !== form.value.nomor.slice(0, 11)) {
    toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun.");
    form.value.tanggal = tanggalOld.value || nv;
  } else {
    tanggalOld.value = nv;
  }
};

// ── PPN Helper (paritas getangkappn Ulib: 1.11 sejak 01/04/2022, 1.1 sebelumnya) ──
const getAngkaPPN = (tanggal: string) => {
  const t = new Date(tanggal);
  const cutoff = new Date(2022, 3, 1); // 1 April 2022
  return t >= cutoff ? 1.11 : 1.1;
};

// ── Hitung ───────────────────────────────────────────────────────────
const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum, d) => sum + Number(d.total || 0), 0);
});

const totalCN = computed(() => {
  return form.value.detail.reduce((sum, d) => sum + Number(d.nilaiCN || 0), 0);
});

const hitung = async () => {
  const subtotal = subtotalBruto.value;
  const discPrValue = Number(form.value.discFakturPr) || 0;
  const discValue = Number(form.value.discFaktur) || 0;

  const totalDiscFaktur = (discPrValue / 100 * subtotal) + discValue;
  const setelahDisc = subtotal - totalDiscFaktur;

  if (form.value.isTax === 1) {
    form.value.taxAmount = setelahDisc * (getAngkaPPN(form.value.tanggal) - 1);
    form.value.amount = setelahDisc * getAngkaPPN(form.value.tanggal) + Number(form.value.freight);
  } else {
    form.value.taxAmount = 0;
    form.value.amount = setelahDisc + Number(form.value.freight);
  }

  form.value.cn = totalCN.value;

  // Total setelah retur
  try {
    const res = await fpFormApi.getNilaiRetur(form.value.nomor || "");
    form.value.totalSetelahRetur = form.value.amount - Number(res.retur || 0);
  } catch {
    form.value.totalSetelahRetur = form.value.amount;
  }
};

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await fpFormApi.getNomor(form.value.tanggal, form.value.isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor FP.");
  }
};

// ── Search SO ────────────────────────────────────────────────────────
const searchSO = async (query: string) => {
  doLoading.value = true;
  try {
    doOptions.value = await fpFormApi.searchSO(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SO.");
  } finally {
    doLoading.value = false;
  }
};

const selectSO = async (soItem: any) => {
  try {
    const data = await fpFormApi.loadSO(soItem.nomor);
    
    form.value.nomorSO = data.nomorSO;
    form.value.cusKode = data.cusKode;
    form.value.cusNama = data.cusNama;
    form.value.alamat = data.alamat;
    form.value.telp = data.telp;
    form.value.salesman = data.salesman;
    form.value.isTax = data.isTax;
    form.value.isEcer = data.isEcer;
    form.value.discFakturPr = data.discFakturPr;
    form.value.discFaktur = data.discFaktur;

    // Jth Tempo = tanggal + top
    const topRes = await fpFormApi.getTop(data.cusKode);
    const top = Number(topRes.top || 0);
    form.value.top = top;
    const tgl = new Date(form.value.tanggal);
    tgl.setDate(tgl.getDate() + top);
    form.value.jthTempo = tgl.toISOString().split("T")[0];

    // Generate nomor
    await loadNomor();

    // Isi detail
    form.value.detail = data.detail.map((d: any, i: number) => ({
      no: i + 1,
      brgKode: Number(d.brgKode),
      brgNama: d.brgNama,
      idBatch: d.idBatch || "",
      qty: Number(d.qty),
      satuan: d.satuan,
      harga: Number(d.harga),
      discPr: Number(d.discPr),
      total: Number(d.total),
      expired: d.expired ? d.expired.split("T")[0] : "",
      kurang: Number(d.kurang),
      cn: Number(d.cn),
      nilaiCN: Number(d.nilaiCN),
      gudang: d.gudang || "",
      hrgMin: Number(d.hrgMin),
      net: Number(d.net || 0),
      otorisasi: 0,
      promosiRp: Number(d.promosiRp),
      promosiPr: Number(d.promosiPr),
      feeRp: Number(d.feeRp),
      feePr: Number(d.feePr),
    }));

    // Net per baris dihitung di sini: loadSO dari BE tidak membawa `net`,
    // jadi tampilkan langsung dari harga SO tanpa menunggu user mengisi harga.
    form.value.detail.forEach(hitungRowValues);

    showDOModal.value = false;
    await hitung();

    // Pola DOFormView: setelah detail terisi dari SO, fokus langsung ke
    // QTY baris pertama — user bisa langsung mengetik tanpa klik.
    if (form.value.detail.length > 0) {
      nextTick(() => fpEnterEdit(0, "qty"));
    }

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat SO.");
  }
};

// ── Update Row Total ─────────────────────────────────────────────────
// Hitung nilai per baris (mutasi total/nilaiCN/net), TANPA rekalkulasi
// header. Dipakai saat load SO supaya `total` & `net` langsung tampil
// sebelum user menyentuh harga (hitung() = async + hit retur, jangan
// dipanggil per baris).
const hitungRowValues = (d: FPDetail) => {
  d.total = d.qty * d.harga * (100 - d.discPr) / 100;
  d.nilaiCN = d.cn * d.total / 100;
  // Net per unit (paritas Delphi): cn/biaya promosi/fee dihitung terhadap harga
  // net unit, BUKAN terhadap total baris — kalau tidak, qty besar membuat net
  // negatif (cn×total baris ≫ hargaNet unit).
  const hargaNet = d.harga * (100 - d.discPr) / 100;
  d.net = hargaNet - (d.cn * hargaNet) / 100
    - d.promosiRp - (d.promosiPr * hargaNet) / 100
    - d.feeRp - (d.feePr * hargaNet) / 100;
};

const updateRowTotal = (d: FPDetail) => {
  hitungRowValues(d);
  hitung();
};

// ── Validasi Qty (paritas clQTYPropertiesValidate) ───────────────────
// Qty total semua baris SKU yang sama tidak boleh melebihi jumlah "kurang"
// baris-baris SKU yang sama.
const validateQty = (d: FPDetail): boolean => {
  if (Number(d.qty) <= 0) return true;
  const rows = form.value.detail.filter((x) => x.brgKode === d.brgKode);
  const totalQty = rows.reduce((s, x) => s + Number(x.qty), 0);
  const totalKurang = rows.reduce((s, x) => s + Number(x.kurang), 0);
  if (totalQty > totalKurang) {
    toast.warning("Qty melebihi qty kurang.");
    return false;
  }
  return true;
};

// ── Validasi Disc Sales (paritas clDiscPropertiesValidate: cek saat edit cell) ──
const discPreviousValue = ref(0);

const startDiscEdit = (idx: number, e: Event, d: FPDetail) => {
  discPreviousValue.value = d.discPr;
  startEdit('discPr-' + idx, e, d.discPr);
};

const onDiscPrBlur = async (e: Event, d: FPDetail, idx: number) => {
  endEdit('discPr-' + idx, e, d.discPr);
  if (!d.brgKode || d.discPr === discPreviousValue.value) return;
  try {
    const res = await fpFormApi.getDiscSales(d.brgKode);
    if (Number(d.discPr) > Number(res.discSales)) {
      const lanjut = await askConfirmDialog(
        "Disc Melebihi batas Yakin ingin Lanjut ?",
        "Disc"
      );
      if (!lanjut) {
        d.discPr = discPreviousValue.value;
        updateRowTotal(d);
      }
    }
  } catch (e2: any) {
    if (isAuthExpiredError(e2)) return;
  }
};

// ── Validasi margin/HET (paritas cekdata) ────────────────────────────
// Per baris (kecuali sudah berotorisasi, salesman INTERNAL/N3, customer sample):
// net < lastcost ATAU margin < minMargin ATAU harga net < HET → dialog;
// lanjut → dialog otorisasi (variant 2 bila di bawah lastcost, selain itu 1).
const validateMarginHET = async (d: FPDetail): Promise<boolean> => {
  if (d.otorisasi === 1) return true;
  const sls = (form.value.salesman || "").toUpperCase();
  if (sls === "INTERNAL" || sls === "N3") return true;

  try {
    const m = await fpFormApi.getMarginData(
      d.brgKode,
      d.expired || "",
      form.value.nomorSO,
      form.value.cusKode
    );
    if (m.isSample) return true;

    const hargaNet = (d.harga * (100 - d.discPr)) / 100;
    const anet = hargaNet - (d.cn * hargaNet) / 100 - d.promosiRp - (d.promosiPr * hargaNet) / 100 - d.feeRp - (d.feePr * hargaNet) / 100;
    // Paritas Delphi: margin% dibagi lastcost (Infinity bila lastcost 0 → tidak trigger)
    const marginPct = m.lastcost > 0 ? ((anet - m.lastcost) / m.lastcost) * 100 : 999;
    const minMargin = m.minMargin ?? 0;

    const belowLastcost = anet < m.lastcost;
    const belowMargin = m.lastcost > 0 && marginPct < minMargin;
    const belowHET = anet < m.hET && m.hET > 0;

    if (!belowLastcost && !belowMargin && !belowHET) return true;

    // "Terlalu Kecil / Dibawah HET" — Yes = lanjut ke otorisasi, No = batal
    const lanjut = await askConfirmDialog(
      `Harga Jual ${d.brgNama} Terlalu Kecil /Dibawah HET. Lanjutkan?`
    );
    if (!lanjut) return false;

    const variant: 1 | 2 = belowLastcost ? 2 : 1;
    const konteks: OtorisasiKonteks = {
      jenis: "FP",
      variant,
      form: {
        nomorSO: form.value.nomorSO || "",
        cusKode: form.value.cusKode || "",
      },
      detail: [
        {
          brgKode: d.brgKode,
          expired: d.expired || "",
          qty: d.qty,
          satuan: d.satuan,
          harga: d.harga,
          discPr: d.discPr,
          promosiRp: d.promosiRp,
          promosiPr: d.promosiPr,
          feeRp: d.feeRp,
          feePr: d.feePr,
          cn: d.cn,
        },
      ],
    };

    validatingDetail.value = d;
    const kode = await askOtorisasi(variant, konteks, d.otorisasiKode || null);
    validatingDetail.value = null;
    if (!kode) return false;
    d.otorisasi = 1;
    d.otorisasiKode = kode;
    return true;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
    toast.error("Gagal memeriksa margin harga.");
    return false;
  }
};

// ── Validasi Form ────────────────────────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  if (!form.value.cusKode) {
    toast.warning("Customer belum dipilih.");
    return false;
  }
  if (form.value.detail.length === 0) {
    toast.warning("Belum ada detail barang.");
    return false;
  }
  for (const d of form.value.detail) {
    if (d.brgKode === 0) {
      toast.warning("SKU belum dipilih.");
      return false;
    }
    if (!validateQty(d)) return false;
    if (!(await validateMarginHET(d))) return false;
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await fpFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
    clearSavedDraft();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan FP.");
  } finally {
    isSaving.value = false;
  }
};

// ── Simpan & Cetak (paritas cxButton3 Delphi) ───────────────────────
const confirmSavePrint = async () => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await fpFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave("new", nomor);
    clearSavedDraft();
    await loadAndPreview(nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan FP.");
  } finally {
    isSaving.value = false;
  }
};

// ── Checkbox DP (paritas chkDPClick) ─────────────────────────────────
const onDpCheck = async (checked: boolean) => {
  if (!checked) {
    form.value.dp = 0;
    return;
  }
  if (!form.value.nomorSO) {
    toast.warning("Pilih SO dahulu.");
    return;
  }
  try {
    const res = await fpFormApi.getDP(form.value.nomorSO, form.value.nomor);
    form.value.dp = Number(res.dp) || 0;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mengambil DP dari SO.");
  }
};

// ── Checkbox CN faktur (paritas chkCNClick) ──────────────────────────
const onCnCheck = async (checked: boolean) => {
  if (!checked) {
    form.value.cn = 0;
    return;
  }
  if (form.value.cn > 0) {
    toast.info("CN ini menggunakan metode per ITem");
    return;
  }
  if (!form.value.cusKode) {
    toast.warning("Pilih customer dahulu.");
    return;
  }
  try {
    const res = await fpFormApi.getCNFaktur(form.value.cusKode, form.value.tanggal);
    const potong = Number(res.cn) || 0;
    const base = form.value.isTax === 1
      ? form.value.amount / getAngkaPPN(form.value.tanggal)
      : form.value.amount;
    form.value.cn = (potong / 100) * base;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mengambil CN customer.");
  }
};

// ── Load Data Edit ───────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await fpFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
    tanggalOld.value = form.value.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data FP.");
    router.push({ name: "fpBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    nomorSO: "",
    tanggal: today,
    jthTempo: today,
    memo: "",
    cusKode: "",
    cusNama: "",
    alamat: "",
    telp: "",
    salesman: "",
    isTax: 1,
    isEcer: 0,
    isCatalog: 0,
    tipecash: 0,
    isDTP: 0,
    discFakturPr: 0,
    discFaktur: 0,
    biayaPr: 0,
    biayaRp: 0,
    freight: 0,
    amount: 0,
    taxAmount: 0,
    dp: 0,
    cn: 0,
    totalSetelahRetur: 0,
    detail: [],
  };
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Draft Lokal (localStorage; auto-draft sebelum timpa) ────────────
// Tab id = path, jadi form FP baru hanya bisa satu per tab. Saat user
// membuka draft, isian form saat ini disimpan otomatis sebagai draft baru
// supaya tidak hilang ditimpa.
const { loadDrafts, saveDraft, removeDraft } = useFpDrafts();
const showDraftDialog = ref(false);
const drafts = ref<FpDraft[]>([]);
const activeDraftId = ref<string | null>(null);

const refreshDrafts = () => {
  drafts.value = loadDrafts();
};

const draftBadge = computed(() =>
  drafts.value.length > 0 ? ` (${drafts.value.length})` : ""
);

const openDraftDialog = () => {
  refreshDrafts();
  showDraftDialog.value = true;
};

const simpanDraft = (silent = false): FpDraft | null => {
  if (isEdit.value) {
    if (!silent) toast.info("Draft hanya untuk faktur baru.");
    return null;
  }
  if (!isFormDirty(form.value)) {
    if (!silent) toast.warning("Form masih kosong, tidak ada yang disimpan.");
    return null;
  }
  const d = saveDraft(form.value);
  activeDraftId.value = d.id;
  refreshDrafts();
  if (!silent) toast.success(`Draft disimpan: ${d.nama}`);
  return d;
};

// Saat FP tersimpan di server, draft yang jadi dasarnya dibuang.
const clearSavedDraft = () => {
  if (activeDraftId.value) {
    removeDraft(activeDraftId.value);
    activeDraftId.value = null;
    refreshDrafts();
  }
};

const bukaDraft = async (d: FpDraft) => {
  // Form saat ini sudah sama persis dengan draft yang dibuka → langsung muat,
  // tanpa konfirmasi.
  const identik = JSON.stringify(form.value) === JSON.stringify(d.data);
  if (!identik && isFormDirty(form.value)) {
    const ya = await askConfirmDialog(
      "Isian form saat ini belum disimpan. Apakah mau disimpan ke draft?",
      "Draft"
    );
    if (ya) simpanDraft(true);
  }
  form.value = JSON.parse(JSON.stringify(d.data)) as FPForm;
  form.value.isEdit = false;
  tanggalOld.value = form.value.tanggal;
  // Draft dikonsumsi: sudah pindah ke form aktif, hapus dari list.
  removeDraft(d.id);
  activeDraftId.value = null;
  refreshDrafts();
  showDraftDialog.value = false;
  await loadNomor();
  await hitung();
  toast.success(`Draft dimuat: ${d.nama}`);
};

const hapusDraft = (id: string) => {
  removeDraft(id);
  if (activeDraftId.value === id) activeDraftId.value = null;
  refreshDrafts();
};

const fmtDraftTime = (iso: string): string =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

onMounted(async () => {
  await loadData();
  refreshDrafts();
});

// ── Hotkey F9 = Draft (paralel F10/F11/F12 di BaseForm) ─────────────
// Listener hanya aktif saat form BETUL-BETUL tampil (activated) — tab
// KeepAlive yang dormant dicabut, jadi F9 tidak bocor ke tab lain.
const onDraftHotkey = (e: Event) => {
  if (isEdit.value) return;
  openDraftDialog();
};

onMounted(() => document.addEventListener("erp:hotkey", onDraftHotkey));
onActivated(() => document.addEventListener("erp:hotkey", onDraftHotkey));
onDeactivated(() => document.removeEventListener("erp:hotkey", onDraftHotkey));
onUnmounted(() => document.removeEventListener("erp:hotkey", onDraftHotkey));

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Input System (seperti SOFormView) ────────────────────────────────
const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const rawInputValues: Record<string, string> = {};

// ── Navigasi grid detail (ala Excel) — keyboard-first ────────────────
// useDetailGrid: Enter commit/edit, panah pindah sel, type-to-edit angka.
const fpCellId = (c: string, r: number) => `fp-cell-${c}-${r}`;
const fpQtyEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(fpCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`${c}-${r}`] = key;
  el.value = key;
  try {
    el.setSelectionRange(el.value.length, el.value.length);
  } catch {
    /* noop */
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const fpGrid = useDetailGrid({
  cols: ["qty", "harga", "discPr", "cn"],
  rowCount: () => form.value.detail.length,
  cellId: fpCellId,
  cellPrefix: "fp-cell",
  typeEditCols: ["qty", "harga", "discPr", "cn"],
  onTypeEdit: fpQtyEdit,
});

const {
  focusCell: fpFocusCell,
  editMode: fpEditMode,
  gridBlur: fpGridBlur,
  onGridCellFocus: fpOnGridFocus,
  setSelect: fpSetSelect,
  enterEdit: fpEnterEdit,
  commitEdit: fpCommitEdit,
  moveFocus: fpMoveFocus,
} = fpGrid;

const isActiveCell = (r: number, c: string) =>
  fpFocusCell.value?.r === r && fpFocusCell.value?.c === c;

const getInputValue = (key: string, modelValue: number, decimals = 2) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startEdit = (key: string, e: Event, raw: number) => {
  // Pola DO (startQtyEdit): nilai 0 dikosongkan saat fokus, langsung ketik.
  const val = raw === 0 ? "" : String(raw);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
};

const endEdit = (key: string, e: Event, raw: number, decimals = 2) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

const onHargaInput = (e: Event, d: FPDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['harga-' + idx] = el.value;
  d.harga = parseInput(el.value);
  updateRowTotal(d);
};

const onDiscPrInput = (e: Event, d: FPDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['discPr-' + idx] = el.value;
  d.discPr = parseInput(el.value);
  updateRowTotal(d);
};

const onCnInput = (e: Event, d: FPDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['cn-' + idx] = el.value;
  d.cn = parseInput(el.value);
  updateRowTotal(d);
};

// ── Harga blur: warning MTCI (paritas clHargaPropertiesValidate, non-blocking) ──
const onHargaBlur = async (e: Event, d: FPDetail, idx: number) => {
  endEdit('harga-' + idx, e, d.harga);
  if (!d.harga || !d.brgKode) return;
  try {
    const m = await fpFormApi.getMarginData(
      d.brgKode,
      d.expired || "",
      form.value.nomorSO,
      form.value.cusKode
    );
    if (m.mtciLastcost > 0 && d.harga < m.mtciLastcost) {
      toast.warning("Harga ini terlalu kecil.");
    }
  } catch (e2: any) {
    if (isAuthExpiredError(e2)) return;
  }
};

// ── Qty input/blur (baris editable, paritas partial invoice Delphi) ──
const onQtyInput = (e: Event, d: FPDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(parseInput(el.value));
  updateRowTotal(d);
};

const onQtyBlur = async (e: Event, d: FPDetail, idx: number) => {
  endEdit('qty-' + idx, e, d.qty, 0);
  validateQty(d);
};

const onDiscFakturPrInput = (e: Event) => {
  rawInputValues['discFakturPr'] = (e.target as HTMLInputElement).value;
  form.value.discFakturPr = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onDiscFakturInput = (e: Event) => {
  rawInputValues['discFaktur'] = (e.target as HTMLInputElement).value;
  form.value.discFaktur = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onFreightInput = (e: Event) => {
  rawInputValues['freight'] = (e.target as HTMLInputElement).value;
  form.value.freight = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

// ── Detail table column widths — used by both header and body ───────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: null },   // sisa lebar diambil ini
  { key: 'idBatch', width: 80 },
  { key: 'qty', width: 60 },
  { key: 'sat', width: 50 },
  { key: 'harga', width: 110 },
  { key: 'discPr', width: 70 },
  { key: 'total', width: 100 },
  { key: 'expired', width: 110 },
  { key: 'cn', width: 55 },
  { key: 'nilaiCN', width: 90 },
  { key: 'net', width: 90 },
  { key: 'promosiRp', width: 115 },
  { key: 'promosiPr', width: 70 },
  { key: 'feeRp', width: 115 },
  { key: 'feePr', width: 70 },
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// Lebar minimum tabel detail (kolom "nama" aslinya null/absorbs sisa, diganti
// lebar minimum) supaya body bisa scroll horizontal alih-alih menyempitkan.
const DETAIL_NAMA_MIN = 200;
const DETAIL_TABLE_MIN = DETAIL_COL_WIDTHS.reduce((s, c) => s + (c.width ?? DETAIL_NAMA_MIN), 0);

// Lebar tabel detail dipaksa SELALU > lebar wadah (+160px) supaya scroll
// horizontal pasti muncul — tidak bergantung lebar layar. Header ikut tergeser
// via syncDetailScroll.
const detailHeaderTblRef = ref<HTMLTableElement | null>(null);
const detailBodyTblRef = ref<HTMLTableElement | null>(null);
const detailHeaderRef = ref<HTMLElement | null>(null);
const detailBodyRef = ref<HTMLElement | null>(null);
const syncDetailScroll = () => {
  if (detailHeaderRef.value && detailBodyRef.value)
    detailHeaderRef.value.scrollLeft = detailBodyRef.value.scrollLeft;
};
// Lebar tabel dipatok TETAP ke total kolom (DETAIL_TABLE_MIN). Tanpa patok
// tetap dan tanpa ResizeObserver, wadah grid ikut membesar mengikuti konten
// (min-content) → scrollWidth selalu == clientWidth → tidak pernah scroll.
const applyDetailWidth = () => {
  const pxs = `${DETAIL_TABLE_MIN}px`;
  for (const el of [detailHeaderTblRef.value, detailBodyTblRef.value]) {
    if (el) el.style.setProperty("width", pxs, "important");
  }
};

onMounted(() => {
  nextTick(applyDetailWidth);
  document.fonts?.ready.then(applyDetailWidth).catch(() => {});
  window.addEventListener("resize", applyDetailWidth);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", applyDetailWidth);
});
watch(() => form.value.detail, applyDetailWidth, { deep: true });
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Faktur Penjualan' : 'Tambah Faktur Penjualan Baru'"
    :icon="IconFileInvoice"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :show-save-print="true"
    @save-action="confirmSave"
    @save-print="confirmSavePrint"
  >
    <template #header-actions>
      <v-btn
        v-if="!isEdit"
        size="small"
        class="tb-btn tb-btn-neutral"
        @click="openDraftDialog"
      >
        <template #prepend><IconArchive :size="14" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F9]</span> Draft{{ draftBadge }}
      </v-btn>
    </template>

    <div class="fp-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="fp-header-grid">
        <!-- SO & Customer Info -->
        <fieldset class="fp-groupbox">
          <legend class="fp-legend">Informasi SO & Customer</legend>
          <div class="fp-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor SO</label>
              <div class="search-group">
                <input :value="form.nomorSO" class="f-inp readonly-bg" readonly placeholder="Pilih SO..." />
                <button class="btn-search" type="button" @click="showDOModal = true; searchSO('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Customer</label>
              <input :value="form.cusNama" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Alamat</label>
              <input :value="form.alamat" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Telp</label>
              <input :value="form.telp" class="f-inp readonly-bg" readonly />
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="fp-groupbox">
          <legend class="fp-legend">Informasi Faktur</legend>
          <div class="fp-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" @change="onTanggalChange" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Jth Tempo</label>
              <DsDatePicker v-model="form.jthTempo" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">DP</label>
              <label class="check-lbl" title="Auto sisa DP dari SO">
                <input
                  type="checkbox"
                  :checked="form.dp > 0"
                  @change="onDpCheck(($event.target as HTMLInputElement).checked)"
                />
              </label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp f-inp-num"
                :value="getInputValue('dp', form.dp)"
                @focus="startEdit('dp', $event, form.dp)"
                @input="rawInputValues['dp'] = ($event.target as HTMLInputElement).value; form.dp = parseInput(($event.target as HTMLInputElement).value)"
                @blur="endEdit('dp', $event, form.dp)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">CN</label>
              <label class="check-lbl" title="Auto CN faktur dari tpiutangcn">
                <input
                  type="checkbox"
                  :checked="form.cn > 0"
                  @change="onCnCheck(($event.target as HTMLInputElement).checked)"
                />
              </label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp f-inp-num"
                :value="getInputValue('cn', form.cn)"
                @focus="startEdit('cn', $event, form.cn)"
                @input="rawInputValues['cn'] = ($event.target as HTMLInputElement).value; form.cn = parseInput(($event.target as HTMLInputElement).value)"
                @blur="endEdit('cn', $event, form.cn)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Salesman</label>
              <input :value="form.salesman" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" disabled />
                Pajak
              </label>
              <label class="check-lbl">
                <input v-model="form.isEcer" type="checkbox" :true-value="1" :false-value="0" disabled />
                Eceran
              </label>
              <label class="check-lbl">
                <input v-model="form.tipecash" type="checkbox" :true-value="1" :false-value="0" />
                Cash
              </label>
              <label class="check-lbl">
                <input v-model="form.isDTP" type="checkbox" :true-value="1" :false-value="0" />
                DTP
              </label>
              <label class="check-lbl">
                <input v-model="form.isCatalog" type="checkbox" :true-value="1" :false-value="0" />
                E-catalog
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="fp-groupbox fp-detail-group">
        <legend class="fp-legend">Detail Barang</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header" ref="detailHeaderRef">
            <table ref="detailHeaderTblRef" class="detail-table detail-table-header-tbl" :style="{ width: DETAIL_TABLE_MIN + 'px' }">
              <colgroup>
                <col v-for="c in DETAIL_COL_WIDTHS" :key="c.key" :style="detailColWidthStyle(c.key)" />
              </colgroup>
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('sku')">SKU</th>
                  <th :style="detailColWidthStyle('nama')">Nama Barang</th>
                  <th :style="detailColWidthStyle('idBatch')">Id Batch</th>
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('sat')" class="tc">Sat</th>
                  <th :style="detailColWidthStyle('harga')" class="tr">Harga</th>
                  <th :style="detailColWidthStyle('discPr')" class="tr">Disc%</th>
                  <th :style="detailColWidthStyle('total')" class="tr">Total</th>
                  <th :style="detailColWidthStyle('expired')" class="tc">Expired</th>
                  <th :style="detailColWidthStyle('cn')" class="tr">CN%</th>
                  <th :style="detailColWidthStyle('nilaiCN')" class="tr">Nilai CN</th>
                  <th :style="detailColWidthStyle('net')" class="tr">Net</th>
                  <th :style="detailColWidthStyle('promosiRp')" class="tr">Promosi Rp</th>
                  <th :style="detailColWidthStyle('promosiPr')" class="tr">Promosi %</th>
                  <th :style="detailColWidthStyle('feeRp')" class="tr">Fee Rp</th>
                  <th :style="detailColWidthStyle('feePr')" class="tr">Fee</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body" ref="detailBodyRef" @scroll="syncDetailScroll">
            <table ref="detailBodyTblRef" class="detail-table detail-table-body-tbl" :style="{ width: DETAIL_TABLE_MIN + 'px' }">
              <colgroup>
                <col v-for="c in DETAIL_COL_WIDTHS" :key="c.key" :style="detailColWidthStyle(c.key)" />
              </colgroup>
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx">
                  <td class="tc row-no" :style="detailColWidthStyle('no')">{{ idx + 1 }}</td>
                  <td class="mono" :style="detailColWidthStyle('sku')">{{ d.brgKode }}</td>
                  <td :style="detailColWidthStyle('nama')">{{ d.brgNama }}</td>
                  <td :style="detailColWidthStyle('idBatch')">{{ d.idBatch }}</td>
                  <td class="tr" :style="detailColWidthStyle('qty')">
                    <input
                      type="text"
                      inputmode="numeric"
                      class="cell-inp tr"
                      :id="fpCellId('qty', idx)"
                      :class="{ 'cell-active': isActiveCell(idx, 'qty') }"
                      :value="getInputValue('qty-' + idx, d.qty, 0)"
                      @focus="fpOnGridFocus('qty', idx); startEdit('qty-' + idx, $event, d.qty)"
                      @input="onQtyInput($event, d, idx)"
                      @blur="onQtyBlur($event, d, idx); fpGridBlur()"
                    />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('sat')">{{ d.satuan }}</td>
                  <td :style="detailColWidthStyle('harga')">
                    <div class="cell-search">
                      <input
                        type="text"
                        inputmode="numeric"
                        class="cell-inp tr"
                        :id="fpCellId('harga', idx)"
                        :class="{ 'cell-active': isActiveCell(idx, 'harga') }"
                        :value="getInputValue('harga-' + idx, d.harga)"
                        @focus="fpOnGridFocus('harga', idx); startEdit('harga-' + idx, $event, d.harga)"
                        @input="onHargaInput($event, d, idx)"
                        @blur="onHargaBlur($event, d, idx); fpGridBlur()"
                      />
                      <button class="cell-btn cell-btn-harga" type="button" title="Riwayat Harga" @click="openRiwayatHargaModal(idx)">
                        <IconHistory :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="tr" :style="detailColWidthStyle('discPr')">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :id="fpCellId('discPr', idx)" :class="{ 'cell-active': isActiveCell(idx, 'discPr') }" :value="getInputValue('discPr-' + idx, d.discPr)" @focus="startDiscEdit(idx, $event, d); fpOnGridFocus('discPr', idx)" @input="onDiscPrInput($event, d, idx)" @blur="onDiscPrBlur($event, d, idx); fpGridBlur()" />
                  </td>
                  <td class="tr cell-total" :style="detailColWidthStyle('total')">{{ fmt(d.total) }}</td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('expired')">{{ d.expired }}</td>
                  <td class="tr" :style="detailColWidthStyle('cn')">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :id="fpCellId('cn', idx)" :class="{ 'cell-active': isActiveCell(idx, 'cn') }" :value="getInputValue('cn-' + idx, d.cn)" @focus="fpOnGridFocus('cn', idx); startEdit('cn-' + idx, $event, d.cn)" @input="onCnInput($event, d, idx)" @blur="endEdit('cn-' + idx, $event, d.cn); fpGridBlur()" />
                  </td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('nilaiCN')">{{ fmt(d.nilaiCN) }}</td>
                  <td class="tr cell-total-accent" :style="detailColWidthStyle('net')">{{ fmt(d.net) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('promosiRp')">{{ fmt(d.promosiRp) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('promosiPr')">{{ d.promosiPr }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('feeRp')">{{ fmt(d.feeRp) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('feePr')">{{ d.feePr }}</td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="17" class="empty-state">
                    Belum ada barang. Klik <strong>"Pilih SO"</strong> untuk mulai mengisi.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <!-- ═══ FOOTER ═══ -->
      <div class="fp-footer-grid">
        <!-- Memo & Biaya -->
        <fieldset class="fp-groupbox">
          <legend class="fp-legend">Memo & Biaya</legend>
          <div class="fp-groupbody">
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="5"></textarea>
            </div>
            <div class="f-row">
              <label class="f-lbl">Biaya</label>
              <input :value="form.biayaPr" class="f-inp-sm readonly-bg" readonly />
              <span class="calc-op">%</span>
              <span class="calc-op">+</span>
              <input :value="form.biayaRp" class="f-inp-sm readonly-bg" readonly />
              <span class="calc-op">=</span>
              <span class="calc-val">{{ fmt((form.biayaPr / 100 * (form.amount - form.taxAmount)) + form.biayaRp) }}</span>
            </div>
          </div>
        </fieldset>

        <!-- Calculation -->
        <fieldset class="fp-groupbox">
          <legend class="fp-legend">Perhitungan</legend>
          <div class="fp-groupbody">
            <div class="calc-box">
              <div class="calc-row">
                <label class="calc-lbl">Disc</label>
                <input type="text" inputmode="numeric" class="calc-inp" :value="getInputValue('discFakturPr', form.discFakturPr)" @focus="startEdit('discFakturPr', $event, form.discFakturPr)" @input="onDiscFakturPrInput" @blur="endEdit('discFakturPr', $event, form.discFakturPr)" />
                <span class="calc-unit">%</span>
                <span class="calc-op">+</span>
                <input type="text" inputmode="numeric" class="calc-inp calc-inp-lg" :value="getInputValue('discFaktur', form.discFaktur)" @focus="startEdit('discFaktur', $event, form.discFaktur)" @input="onDiscFakturInput" @blur="endEdit('discFaktur', $event, form.discFaktur)" />
                <span class="calc-op">=</span>
                <span class="calc-val">{{ fmt((form.discFakturPr / 100 * subtotalBruto) + form.discFaktur) }}</span>
              </div>
              <div class="calc-row">
                <label class="calc-lbl">Pajak</label>
                <span class="calc-val calc-val-muted">{{ fmt(form.taxAmount) }}</span>
              </div>
              <div class="calc-row">
                <label class="calc-lbl">Freight</label>
                <span class="calc-op">+</span>
                <input type="text" inputmode="numeric" class="calc-inp" :value="getInputValue('freight', form.freight)" @focus="startEdit('freight', $event, form.freight)" @input="onFreightInput" @blur="endEdit('freight', $event, form.freight)" />
              </div>
              <div class="calc-row calc-total-row">
                <label class="calc-lbl calc-lbl-total">TOTAL</label>
                <span class="calc-val-total">{{ fmt(form.amount) }}</span>
              </div>
              <div class="calc-row calc-retur-row">
                <label class="calc-lbl">Setelah Retur</label>
                <span class="calc-val-retur">{{ fmt(form.totalSetelahRetur) }}</span>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </BaseForm>

  <!-- ═══ MODALS ═══ -->
  <SearchModal
    v-model="showDOModal"
    title="Pilih Nomor SO"
    :columns="[
      { key: 'nomor', title: 'Nomor SO', width: '170px' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
      { key: 'customer', title: 'Customer' },
    ]"
    :items="doOptions"
    :loading="doLoading"
    :server-search="true"
    search-placeholder="Cari nomor SO atau customer..."
    @select="selectSO"
    @search="searchSO"
  />

  <!-- Riwayat Harga Modal -->
  <v-dialog v-model="showRiwayatHargaModal" max-width="650" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Riwayat Harga Penjualan
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="riwayatHargaLoading" class="modal-loading">Memuat...</div>
        <div v-else class="riwayat-harga-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama Barang</th>
                <th class="tr">Harga</th>
                <th class="tr">Disc%</th>
                <th class="tr">QTY</th>
                <th>Expired</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in riwayatHargaItems" :key="idx" class="modal-row" @click="selectRiwayatHarga(item)">
                <td class="tc">{{ item.Tanggal }}</td>
                <td>{{ item.Nama }}</td>
                <td class="tr">{{ fmt(item.Harga) }}</td>
                <td class="tr">{{ item.Disc }}</td>
                <td class="tr">{{ item.Qty }}</td>
                <td class="tc">{{ item.Expired || '-' }}</td>
              </tr>
              <tr v-if="riwayatHargaItems.length === 0">
                <td colspan="6" class="empty-state">
                  Tidak ada riwayat harga untuk barang dan customer ini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showRiwayatHargaModal = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Dialog Otorisasi (terikat transaksi, konteks dikirim ke backend) ── -->
  <OtorisasiDialog
    v-model="showOtorisasi"
    :variant="otorisasiVariant"
    :konteks="otorisasiKonteks"
    :kode-cache="otorisasiKodeCache"
    :keterangan="otorisasiKeterangan"
    :show-draft-action="!isEdit"
    @success="onOtorisasiSuccess"
    @fail="onOtorisasiFail"
    @cancel="onOtorisasiCancel"
    @draft="onOtorisasiDraft"
  />

  <!-- ── Dialog konfirmasi generik (MessageDlg paritas) ── -->
  <ConfirmDialog
    v-model="confirmState.visible"
    :title="confirmState.title"
    :message="confirmState.message"
    icon="help"
    cancel-label="Tidak"
    confirm-label="Ya"
    @confirm="confirmState.onYes"
    @cancel="confirmState.onNo"
  />

  <!-- ── Printer & Preview (Simpan & Cetak) ── -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    title="Preview Faktur Penjualan"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />

  <!-- ── Dialog Draft lokal (auto-draft sebelum timpa) ── -->
  <v-dialog v-model="showDraftDialog" max-width="640" scrollable>
    <v-card rounded="false">
      <v-card-title
        class="d-flex align-center pa-3"
        style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);"
      >
        Draft Faktur Penjualan
        <v-spacer />
        <v-btn
          size="small"
          variant="flat"
          color="primary"
          @click="simpanDraft()"
        >
          Simpan Form Saat Ini
        </v-btn>
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div class="text-caption text-medium-emphasis mb-2">
          Satu draft per Nomor SO. Membuka draft memindahkannya menjadi form aktif.
        </div>
        <div class="riwayat-harga-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th>Nomor SO</th>
                <th>Nama Draft</th>
                <th>Ringkas</th>
                <th>Waktu</th>
                <th class="tc" style="width: 130px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in drafts" :key="d.id" class="modal-row">
                <td class="mono">{{ d.data.nomorSO || '-' }}</td>
                <td>{{ d.nama }}</td>
                <td class="text-medium-emphasis">{{ draftRingkas(d) }}</td>
                <td class="tc" style="white-space: nowrap;">{{ fmtDraftTime(d.savedAt) }}</td>
                <td class="tc" @click.stop>
                  <v-btn
                    size="x-small"
                    variant="flat"
                    color="primary"
                    class="mr-1"
                    @click="bukaDraft(d)"
                  >Buka</v-btn>
                  <v-btn
                    size="x-small"
                    variant="flat"
                    color="error"
                    @click="hapusDraft(d.id)"
                  >Hapus</v-btn>
                </td>
              </tr>
              <tr v-if="drafts.length === 0">
                <td colspan="5" class="empty-state">
                  Belum ada draft. Isi form lalu "Simpan Form Saat Ini".
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showDraftDialog = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Konfirmasi Re-cetak (paritas Delphi cekcetak) ── -->
  <ConfirmDialog
    v-model="showRecetakDialog"
    title="Cetak Ulang Faktur"
    icon="print"
    message="Faktur ini sudah pernah dicetak."
    question="Yakin ingin mencetak lagi?"
    subject-label="Nomor"
    :subject-value="recetakNomor"
    cancel-label="Tidak"
    confirm-label="Ya, Cetak"
    @confirm="confirmRecetak"
    @cancel="cancelRecetak"
  />
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   FP FORM — Classic Desktop Layout
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ─────────────────────────────────────────────────────── */
.fp-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.fp-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.fp-footer-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ──────────────────────────────────────── */
.fp-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.fp-legend {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start;
  line-height: 1.4;
}

.fp-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fp-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fp-detail-group .fp-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

/* ── Field Row ──────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-row-top {
  align-items: flex-start;
}

.f-lbl {
  width: 80px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

/* ── Input (sunken desktop style) ─────────────────────────────── */
.f-inp {
  flex: 1;
  max-width: 400px;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-inp-sm {
  width: 60px;
  height: 22px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 4px;
  font-size: 11px;
  text-align: right;
  outline: none;
}

.f-inp-sm:focus {
  border-color: var(--ds-primary, #0284c7);
}

.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-secondary, #5A6A7E);
}

.f-txa {
  flex: 1;
  max-width: 400px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 4px 5px;
  font-size: 11px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-txa:focus {
  border-color: var(--ds-primary, #0284c7);
}

/* ── Search Group ───────────────────────────────────────────────── */
.search-group {
  display: flex;
  flex: 1;
  max-width: 400px;
  gap: 2px;
}

.btn-search {
  height: 24px;
  width: 26px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-search:hover {
  background: var(--ds-primary-dark, #0369a1);
}

/* ── Checkbox ───────────────────────────────────────────────────── */
.check-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.check-lbl {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  cursor: pointer;
  user-select: none;
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 12px;
  height: 12px;
  margin: 0;
}

/* ── Detail Table ───────────────────────────────────────────────── */
.detail-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--ds-border, #A0AAB8);
  overflow: hidden;
}

.detail-table-header {
  flex-shrink: 0;
  overflow: hidden;
}

.detail-table-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  max-width: 100% !important;
  overflow-y: auto;
  overflow-x: auto !important;
  scrollbar-width: thin;
  scrollbar-color: #8A94A6 #E0E4EA;
}

/* Clamp lebar rantai lelang supaya wadah grid TIDAK ikut membesar mengikuti
   konten (min-content). Tanpa ini, wadah melebar selebar tabel → tak ada yang
   bisa di-scroll horizontal. */
.fp-layout,
.fp-detail-group,
.fp-detail-group .fp-groupbody,
.detail-table-wrap,
.detail-table-body {
  min-width: 0;
}

/* Scrollbar detail grid dibikin jelas terlihat (5px global terlalu tipis
   sehingga scroll horizontal mudah tidak terdeteksi). */
.detail-table-body::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}
.detail-table-body::-webkit-scrollbar-track {
  background: #E0E4EA;
}
.detail-table-body::-webkit-scrollbar-thumb {
  background: #8A94A6;
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.detail-table-body::-webkit-scrollbar-thumb:hover {
  background: #6A7689;
  background-clip: content-box;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-weight: 500;
  table-layout: fixed;
}

.detail-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.detail-table th {
  color: white;
  font-weight: 700;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
  border-bottom: 1px solid var(--ds-primary-dark, #0369a1);
}

.detail-table th:last-child {
  border-right: none;
}

.detail-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-table td:last-child {
  border-right: none;
}

/* ── Zebra steel: baris bergantian dua nada biru muda (bukan putih)
   supaya field input putih menonjol sebagai area yang bisa diisi. ── */
.detail-table tbody tr:nth-child(odd) {
  background: #F0F3F8;
}

.detail-table tbody tr:nth-child(even) {
  background: #E4EBF4;
}

.detail-table tbody tr:hover td {
  background: #D8E2EF;
}

.detail-table-header-tbl {
  table-layout: fixed;
}

.detail-table-body-tbl {
  table-layout: fixed;
}

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.cell-muted {
  color: var(--ds-text, #0c4a6e);
  font-weight: 600;
}

.cell-total {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ds-primary-dark, #0369a1);
}

.cell-total-accent {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ds-primary, #0284c7);
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

/* ── Cell Input ─────────────────────────────────────────────────── */
.cell-inp {
  width: 50px;
  height: 20px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px;
  font-size: 11px;
  outline: none;
  text-align: right;
  background: white;
}

.cell-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.cell-search {
  display: flex;
  gap: 2px;
}

.cell-search .cell-inp {
  flex: 1;
  min-width: 0;
}

.cell-btn {
  height: 20px;
  width: 22px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.cell-btn:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.cell-btn-harga {
  background: var(--ds-warning, #0284c7);
  border-color: #0369a1;
}

.cell-btn-harga:hover {
  background: #0369a1;
}

.riwayat-harga-table-wrap {
  max-height: 320px;
  overflow-y: auto;
}

/* ── Modal Table ────────────────────────────────────────────────── */
.modal-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.modal-tbl th {
  background: var(--ds-surface, #F0F3F8);
  font-weight: 700;
  padding: 5px 8px;
  text-align: left;
  border-bottom: 2px solid var(--ds-border, #A0AAB8);
  white-space: nowrap;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.modal-tbl td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  white-space: nowrap;
}

.modal-row {
  cursor: pointer;
}

.modal-row:hover td {
  background: var(--ds-primary-50, #E8EDF5);
}

.modal-loading {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  padding: 20px;
  font-size: 12px;
}

/* ── Kalkulasi ──────────────────────────────────────────────────── */
.calc-box {
  width: 100%;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calc-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.calc-lbl {
  width: 80px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
  font-size: 11px;
}

.calc-inp {
  width: 60px;
  height: 22px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 4px;
  font-size: 11px;
  text-align: right;
  outline: none;
  background: white;
}

.calc-inp-lg {
  width: 75px;
}

.calc-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.calc-unit {
  font-size: 10px;
  color: var(--ds-text-muted, #8494A7);
}

.calc-op {
  color: var(--ds-text-muted, #8494A7);
  font-weight: 600;
  font-size: 10px;
}

.calc-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.calc-val-muted {
  color: var(--ds-text-muted, #8494A7);
  font-weight: 600;
}

.calc-total-row {
  border-top: 2px solid var(--ds-primary, #0284c7);
  padding-top: 6px;
  margin-top: 2px;
}

.calc-lbl-total {
  font-size: 12px;
  font-weight: 800;
  color: var(--ds-primary-darker, #0c4a6e);
  width: auto;
}

.calc-val-total {
  font-size: 15px;
  font-weight: 800;
  color: var(--ds-primary, #0284c7);
  font-variant-numeric: tabular-nums;
  background: var(--ds-primary-50, #E8EDF5);
  border: 1px solid var(--ds-primary-100, #C5D0E6);
  padding: 2px 10px;
  margin-left: auto;
}

.calc-retur-row {
  border-top: 1px solid var(--ds-border, #A0AAB8);
  padding-top: 5px;
}

.calc-val-retur {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary-dark, #0369a1);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .fp-header-grid,
  .fp-footer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .fp-layout {
    padding: 4px;
    gap: 4px;
  }
  .fp-groupbody {
    padding: 6px;
    gap: 4px;
  }
  .f-lbl {
    width: 70px;
    font-size: 10px;
  }
}
</style>
