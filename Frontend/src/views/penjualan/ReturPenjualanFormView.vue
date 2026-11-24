<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import OtorisasiDialog from "@/components/OtorisasiDialog.vue";
import { IconReceiptRefund, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import { returPenjualanFormApi, type ReturPenjualanForm, type ReturPenjualanDetail } from "@/api/penjualan/returPenjualanFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useEscClose } from "@/composables/useEscClose";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const isLocked = ref(false);

// ── Otorisasi (paritas TfrmOtorisasi Delphi) ────────────────────────
const showOtorisasi = ref(false);
const otorisasiResolve = ref<((ok: boolean) => void) | null>(null);

const askOtorisasi = (): Promise<boolean> => {
  showOtorisasi.value = true;
  return new Promise((resolve) => {
    otorisasiResolve.value = resolve;
  });
};

const onOtorisasiSuccess = () => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(true);
  otorisasiResolve.value = null;
};

const onOtorisasiFail = (_kode?: string) => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(false);
  otorisasiResolve.value = null;
  toast.error("Otorisasi salah");
};

// Batal: tutup tanpa notif & tanpa otorisasi.
const onOtorisasiCancel = () => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(false);
  otorisasiResolve.value = null;
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

// Esc = No. WAJIB lewat onNo(), bukan set visible=false langsung: dialog ini
// me-resolve Promise, jadi kalau hanya ditutup tanpa resolve, setiap
// `await askConfirmDialog(...)` yang sedang berjalan menggantung selamanya.
useEscClose(
  computed(() => confirmState.value.visible),
  () => confirmState.value.onNo(),
);

const today = new Date().toISOString().slice(0, 10);

const form = ref<ReturPenjualanForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  nomorFaktur: "",
  cusKode: "",
  cusNama: "",
  alamat: "",
  gdgKode: "",
  gdgNama: "",
  memo: "",
  isTax: 1,
  discFakturPr: 0,
  discFaktur: 0,
  amount: 0,
  taxAmount: 0,
  cn: 0,
  detail: [],
});

// ── Options ──────────────────────────────────────────────────────────
const fpOptions = ref<any[]>([]);
const gudangOptions = ref<any[]>([]);
const barangOptions = ref<any[]>([]);
const fpLoading = ref(false);
const barangLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showFPModal = ref(false);
const showGudangModal = ref(false);
const showBarangModal = ref(false);
const activeDetailIndex = ref(-1);

// ── PPN Helper ───────────────────────────────────────────────────────
const getAngkaPPN = (tanggal: string) => {
  const t = new Date(tanggal);
  const cutoff = new Date(2022, 3, 1);
  return t >= cutoff ? 1.11 : 1.1;
};

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await returPenjualanFormApi.getNomor(form.value.tanggal, form.value.isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

// ── Load Options ─────────────────────────────────────────────────────
const loadOptions = async () => {
  try {
    gudangOptions.value = await returPenjualanFormApi.getGudang();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data gudang.");
  }
};

// ── Search FP ────────────────────────────────────────────────────────
const searchFP = async (query: string) => {
  fpLoading.value = true;
  try {
    fpOptions.value = await returPenjualanFormApi.searchFP(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari faktur.");
  } finally {
    fpLoading.value = false;
  }
};

const selectFP = async (fp: any) => {
  try {
    const excludeNomor = isEdit.value ? form.value.nomor : "";
    const data = await returPenjualanFormApi.getFP(fp.nomor, excludeNomor);

    // ── Approve flow (paritas Delphi edtNomorfakturClickBtn) ──
    // Sudah faktur pajak → approve
    if (data.sudahFakturPajak) {
      const lanjut = await askConfirmDialog("Faktur sudah di faktur pajak, ingin Approve?");
      if (!lanjut) return;
      const ok = await askOtorisasi();
      if (!ok) return;
    }

    form.value.nomorFaktur = data.nomor;
    form.value.cusKode = data.cusKode;
    form.value.cusNama = data.cusNama;
    form.value.alamat = data.alamat;
    form.value.isTax = data.isTax;
    form.value.detail = [];
    showFPModal.value = false;
    await loadNomor();

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat faktur.");
  }
};

const selectGudang = (g: any) => {
  form.value.gdgKode = g.kode;
  form.value.gdgNama = g.nama;
  showGudangModal.value = false;
};

// ── Search Barang ────────────────────────────────────────────────────
const searchBarang = async (query: string) => {
  if (!form.value.nomorFaktur) {
    toast.warning("Pilih nomor faktur dahulu.");
    return;
  }
  barangLoading.value = true;
  try {
    barangOptions.value = await returPenjualanFormApi.searchBarang(form.value.nomorFaktur, query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    barangLoading.value = false;
  }
};

const openBarangModal = async (idx: number) => {
  activeDetailIndex.value = idx;
  showBarangModal.value = true;
  await searchBarang("");
};

const selectBarang = (brg: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  // Cek duplikat SKU+idBatch (PK barang = kode barang + id batch)
  const isDuplicate = form.value.detail.some(
    (x, i) => i !== idx && String(x.brgKode) === String(brg.sku) &&
              ((x.idBatch || "") === (brg.idBatch || ""))
  );
  if (isDuplicate) {
    toast.warning("SKU dan Expired sudah ada di baris lain.");
    return;
  }

  const d = form.value.detail[idx];
  d.brgKode = Number(brg.sku);
  d.brgNama = brg.namaBarang;
  d.satuan = brg.satuan;
  d.idBatch = brg.idBatch || "";
  d.harga = Number(brg.harga);
  d.discPr = Number(brg.discPr);
  d.expired = brg.expired || "";
  d.total = 0;
  d.cn = 0;
  d.nilaiCN = 0;

  showBarangModal.value = false;
  hitung();
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  hitung();
};

const updateRowTotal = (d: ReturPenjualanDetail) => {
  d.total = d.qty * d.harga * (100 - d.discPr) / 100;
  d.nilaiCN = d.cn * d.total / 100;
  hitung();
};

// ── Tambah Baris (lookup barang dari faktur) ────────────────────────
const showTambahBarangModal = ref(false);
const tambahBarangItems = ref<any[]>([]);
const tambahBarangLoading = ref(false);
const tambahBarangSearch = ref("");
const selectedTambahBarang = ref<any[]>([]);

// PK barang = kode barang + id batch
const batchKey = (b: any) => `${String(b.sku)}|${b.idBatch || ""}`;

const isTambahBarangSelected = (brg: any) =>
  selectedTambahBarang.value.some(b => batchKey(b) === batchKey(brg));

const toggleTambahBarang = (brg: any) => {
  const idx = selectedTambahBarang.value.findIndex(b => batchKey(b) === batchKey(brg));
  if (idx >= 0) {
    selectedTambahBarang.value.splice(idx, 1);
  } else {
    selectedTambahBarang.value.push(brg);
  }
};

const allTambahBarangChecked = computed(() =>
  tambahBarangItems.value.length > 0 &&
  tambahBarangItems.value.every(b => isTambahBarangSelected(b))
);

const toggleAllTambahBarang = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahBarangItems.value) {
      if (!isTambahBarangSelected(brg)) selectedTambahBarang.value.push(brg);
    }
  } else {
    const keys = new Set(tambahBarangItems.value.map(b => batchKey(b)));
    selectedTambahBarang.value = selectedTambahBarang.value.filter(b => !keys.has(batchKey(b)));
  }
};

const openTambahBarangModal = async () => {
  if (!form.value.nomorFaktur) {
    toast.warning("Pilih nomor faktur dahulu.");
    return;
  }
  selectedTambahBarang.value = [];
  tambahBarangSearch.value = "";
  showTambahBarangModal.value = true;
  tambahBarangLoading.value = true;
  try {
    tambahBarangItems.value = await returPenjualanFormApi.searchBarang(form.value.nomorFaktur, "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahBarangLoading.value = false;
  }
};

const onTambahBarangSearch = async (query: string) => {
  tambahBarangLoading.value = true;
  try {
    tambahBarangItems.value = await returPenjualanFormApi.searchBarang(form.value.nomorFaktur, query);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    tambahBarangLoading.value = false;
  }
};

const addSelectedTambahBarang = () => {
  if (selectedTambahBarang.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let skipped = 0;
  for (const brg of selectedTambahBarang.value) {
    // Cek duplikat SKU+idBatch (PK barang = kode barang + id batch)
    const isDuplicate = form.value.detail.some(
      (x) => String(x.brgKode) === String(brg.sku) &&
            ((x.idBatch || "") === (brg.idBatch || ""))
    );
    if (isDuplicate) { skipped++; continue; }

    form.value.detail.push({
      no: form.value.detail.length + 1,
      brgKode: Number(brg.sku),
      brgNama: brg.namaBarang,
      idBatch: brg.idBatch || "",
      qty: 0,
      satuan: brg.satuan || "",
      harga: Number(brg.harga) || 0,
      discPr: Number(brg.discPr) || 0,
      total: 0,
      expired: brg.expired || "",
      cn: 0,
      nilaiCN: 0,
    });
  }
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  if (skipped > 0) toast.warning(`${skipped} barang dilewati (duplikat SKU+Id Batch).`);
  showTambahBarangModal.value = false;
  hitung();
  // Fokus langsung ke QTY baris pertama yang baru ditambahkan (pola DOFormView).
  if (form.value.detail.length > firstRow) {
    nextTick(() => retjEnterEdit(firstRow, "qty"));
  }
};

// ── Detail column widths (shared by thead & tbody so they stay aligned) ──
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: null },   // takes the remaining width
  { key: 'idBatch', width: 80 },
  { key: 'qty', width: 60 },
  { key: 'satuan', width: 50 },
  { key: 'harga', width: 100 },
  { key: 'discPr', width: 60 },
  { key: 'total', width: 100 },
  { key: 'expired', width: 80 },
  { key: 'cn', width: 60 },
  { key: 'nilaiCN', width: 90 },
  { key: 'action', width: 30 },
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// ── Input System — bebas ketik seperti string, format saat blur ───
const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const rawInputValues: Record<string, string> = {};

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

// ── Input Handlers (detail grid) ─────────────────────────────────────
const onQtyInput = (e: Event, d: ReturPenjualanDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, '')) || 0);
  updateRowTotal(d);
};

const onHargaInput = (e: Event, d: ReturPenjualanDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['harga-' + idx] = el.value;
  d.harga = parseInput(el.value);
  updateRowTotal(d);
};

const onDiscPrInput = (e: Event, d: ReturPenjualanDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['discPr-' + idx] = el.value;
  d.discPr = parseInput(el.value);
  updateRowTotal(d);
};

const onCnInput = (e: Event, d: ReturPenjualanDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['cn-' + idx] = el.value;
  d.cn = parseInput(el.value);
  updateRowTotal(d);
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif Retur: sku (picker modal), idBatch, qty, harga, discPr,
// expired (date), cn. Urutan cols mengikuti urutan visual kolom tabel.
const retjCellId = (c: string, r: number) => `retj-cell-${c}-${r}`;

const retjTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(retjCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`${c}-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const retjGrid = useDetailGrid({
  cols: ["sku", "idBatch", "qty", "harga", "discPr", "expired", "cn"],
  rowCount: () => form.value.detail.length,
  cellId: retjCellId,
  cellPrefix: "retj-cell",
  onPicker: (r, c) => { if (c === "sku") openBarangModal(r); },
  typeEditCols: ["idBatch", "qty", "harga", "discPr", "cn"],
  onTypeEdit: retjTypeEdit,
});

const {
  focusCell: retjFocusCell,
  gridBlur: retjGridBlur,
  onGridCellFocus: retjOnGridFocus,
  setSelect: retjSetSelect,
  enterEdit: retjEnterEdit,
} = retjGrid;

const isActiveCell = (r: number, c: string) =>
  retjFocusCell.value?.r === r && retjFocusCell.value?.c === c;

// ── Input Handlers (footer hitung) ───────────────────────────────────
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

// ── Hitung ───────────────────────────────────────────────────────────
const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum, d) => sum + Number(d.total || 0), 0);
});

const totalCN = computed(() => {
  return form.value.detail.reduce((sum, d) => sum + Number(d.nilaiCN || 0), 0);
});

const hitung = () => {
  const subtotal = subtotalBruto.value;
  const discPrValue = Number(form.value.discFakturPr) || 0;
  const discValue = Number(form.value.discFaktur) || 0;
  const totalDiscFaktur = (discPrValue / 100 * subtotal) + discValue;
  const setelahDisc = subtotal - totalDiscFaktur;

  if (form.value.isTax === 1) {
    form.value.taxAmount = setelahDisc * (getAngkaPPN(form.value.tanggal) - 1);
    form.value.amount = setelahDisc * getAngkaPPN(form.value.tanggal);
  } else {
    form.value.taxAmount = 0;
    form.value.amount = setelahDisc;
  }

  // CN: per-item saja
  form.value.cn = form.value.isTax === 1
    ? totalCN.value * getAngkaPPN(form.value.tanggal)
    : totalCN.value;
};

// ── Validasi (paritas cekdata Delphi) ─────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  if (!form.value.cusKode) {
    toast.warning("Customer belum di pilih.");
    return false;
  }
  if (!form.value.nomorFaktur) {
    toast.warning("Nomor faktur belum dipilih.");
    return false;
  }
  for (const d of form.value.detail) {
    if (Number(d.qty) > 0 && !Number(d.brgKode)) {
      toast.warning("SKU Baris belum dipilih.");
      return false;
    }
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value || isLocked.value) return;
  if (!(await validateSave())) return;
  isSaving.value = true;
  try {
    const res = await returPenjualanFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
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
    const data = await returPenjualanFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "returPenjualanBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    nomorFaktur: "",
    cusKode: "",
    cusNama: "",
    alamat: "",
    gdgKode: "",
    gdgNama: "",
    memo: "",
    isTax: 1,
    discFakturPr: 0,
    discFaktur: 0,
    amount: 0,
    taxAmount: 0,
    cn: 0,
    detail: [],
  };
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadOptions();
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Retur Penjualan' : 'Tambah Retur Penjualan Baru'"
    :icon="IconReceiptRefund"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :disabled="isLocked"
    @save-action="confirmSave"
  >
    <div class="retj-layout">
      <!-- ═══ HEADER (2 kolom sejajar) ═══ -->
      <div class="retj-header-grid">
        <!-- Faktur Info -->
        <fieldset class="retj-groupbox">
          <legend class="retj-legend">Informasi Faktur</legend>
          <div class="retj-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor Faktur</label>
              <div class="search-group">
                <input :value="form.nomorFaktur" class="f-inp readonly-bg" readonly placeholder="Pilih Faktur..." />
                <button class="btn-search" type="button" @click="showFPModal = true; searchFP('')">
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
              <label class="f-lbl">Gudang</label>
              <div class="search-group">
                <input :value="form.gdgKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.gdgNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Gudang..." />
                <button class="btn-search" type="button" @click="showGudangModal = true">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Retur Info -->
        <fieldset class="retj-groupbox">
          <legend class="retj-legend">Informasi Retur</legend>
          <div class="retj-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" disabled />
                Pajak
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="retj-groupbox retj-detail-group">
        <legend class="retj-legend">Detail Barang Retur</legend>
        <div class="retj-detail-toolbar">
          <button class="btn-add-row" type="button" @click="openTambahBarangModal">
            <IconPlus :size="13" /> Tambah Baris
          </button>
        </div>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('sku')">SKU</th>
                  <th :style="detailColWidthStyle('nama')">Nama Barang</th>
                  <th :style="detailColWidthStyle('idBatch')">Id Batch</th>
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('satuan')" class="tc">Sat</th>
                  <th :style="detailColWidthStyle('harga')" class="tr">Harga</th>
                  <th :style="detailColWidthStyle('discPr')" class="tr">Disc%</th>
                  <th :style="detailColWidthStyle('total')" class="tr">Total</th>
                  <th :style="detailColWidthStyle('expired')" class="tc">Expired</th>
                  <th :style="detailColWidthStyle('cn')" class="tr">CN%</th>
                  <th :style="detailColWidthStyle('nilaiCN')" class="tr">Nilai CN</th>
                  <th :style="detailColWidthStyle('action')" class="tc">✕</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx">
                  <td class="tc row-no" :style="detailColWidthStyle('no')">{{ idx + 1 }}</td>
                  <td :style="detailColWidthStyle('sku')">
                    <div class="cell-search" :id="'retj-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.brgKode" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" @click="openBarangModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td :style="detailColWidthStyle('nama')"><input v-model="d.brgNama" class="cell-inp readonly-bg" readonly /></td>
                  <td :style="detailColWidthStyle('idBatch')"><input v-model="d.idBatch" class="cell-inp" :id="retjCellId('idBatch', idx)" :class="{ 'cell-active': isActiveCell(idx, 'idBatch') }" @focus="retjOnGridFocus('idBatch', idx)" @blur="retjGridBlur()" /></td>
                  <td :style="detailColWidthStyle('qty')"><input type="text" inputmode="numeric" class="cell-inp tr" :id="retjCellId('qty', idx)" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="retjOnGridFocus('qty', idx); startEdit('qty-' + idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); retjGridBlur()" /></td>
                  <td :style="detailColWidthStyle('satuan')"><input v-model="d.satuan" class="cell-inp tc readonly-bg" readonly /></td>
                  <td :style="detailColWidthStyle('harga')"><input type="text" inputmode="decimal" class="cell-inp tr" :id="retjCellId('harga', idx)" :class="{ 'cell-active': isActiveCell(idx, 'harga') }" :value="getInputValue('harga-' + idx, d.harga)" @focus="retjOnGridFocus('harga', idx); startEdit('harga-' + idx, $event, d.harga)" @input="onHargaInput($event, d, idx)" @blur="endEdit('harga-' + idx, $event, d.harga); retjGridBlur()" /></td>
                  <td :style="detailColWidthStyle('discPr')"><input type="text" inputmode="decimal" class="cell-inp tr" :id="retjCellId('discPr', idx)" :class="{ 'cell-active': isActiveCell(idx, 'discPr') }" :value="getInputValue('discPr-' + idx, d.discPr)" @focus="retjOnGridFocus('discPr', idx); startEdit('discPr-' + idx, $event, d.discPr)" @input="onDiscPrInput($event, d, idx)" @blur="endEdit('discPr-' + idx, $event, d.discPr); retjGridBlur()" /></td>
                  <td class="tr bold" :style="detailColWidthStyle('total')">{{ fmt(d.total) }}</td>
                  <td :style="detailColWidthStyle('expired')"><DsDatePicker v-model="d.expired" variant="cell" :id="retjCellId('expired', idx)" @focus="retjOnGridFocus('expired', idx)" @blur="retjGridBlur()" /></td>
                  <td :style="detailColWidthStyle('cn')"><input type="text" inputmode="decimal" class="cell-inp tr" :id="retjCellId('cn', idx)" :class="{ 'cell-active': isActiveCell(idx, 'cn') }" :value="getInputValue('cn-' + idx, d.cn)" @focus="retjOnGridFocus('cn', idx); startEdit('cn-' + idx, $event, d.cn)" @input="onCnInput($event, d, idx)" @blur="endEdit('cn-' + idx, $event, d.cn); retjGridBlur()" /></td>
                  <td class="tr bold accent" :style="detailColWidthStyle('nilaiCN')">{{ fmt(d.nilaiCN) }}</td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" @click="removeRow(idx)">✕</button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="13" class="empty-state">
                    Pilih nomor faktur untuk memuat barang.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <!-- ═══ FOOTER ═══ -->
      <div class="retj-footer">
        <div class="retj-footer-left">
          <div class="f-row">
            <label class="f-lbl">Memo</label>
            <textarea v-model="form.memo" class="f-txa" rows="5"></textarea>
          </div>
        </div>
        <div class="retj-footer-right">
          <div class="calc-box">
            <div class="calc-row">
              <label>CN</label>
              <span style="margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums">{{ fmt(form.cn) }}</span>
            </div>
            <div class="calc-row">
              <label>Disc (%)</label>
              <input
                type="text"
                inputmode="decimal"
                class="calc-inp"
                :value="getInputValue('discFakturPr', form.discFakturPr)"
                @focus="startEdit('discFakturPr', $event, form.discFakturPr)"
                @input="onDiscFakturPrInput"
                @blur="endEdit('discFakturPr', $event, form.discFakturPr)"
              />
              <span>+</span>
              <input
                type="text"
                inputmode="decimal"
                class="calc-inp"
                :value="getInputValue('discFaktur', form.discFaktur)"
                @focus="startEdit('discFaktur', $event, form.discFaktur)"
                @input="onDiscFakturInput"
                @blur="endEdit('discFaktur', $event, form.discFaktur)"
              />
              <span>=</span>
              <span class="calc-val">{{ fmt((form.discFakturPr / 100 * subtotalBruto) + form.discFaktur) }}</span>
            </div>
            <div class="calc-row">
              <label>Pajak</label>
              <span class="calc-val">{{ fmt(form.taxAmount) }}</span>
            </div>
            <div class="calc-row calc-total-row">
              <label>Total</label>
              <span class="calc-val-total">{{ fmt(form.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseForm>

  <!-- ═══ MODALS ═══ -->
  <!-- Modal Tambah Baris: lookup barang dari faktur terpilih -->
  <v-dialog v-model="showTambahBarangModal" max-width="760" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3 tb-title">
        Tambah Baris — Pilih Barang
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div class="tb-search">
          <IconSearch :size="14" style="color: var(--ds-text-muted, #8494A7); flex-shrink: 0;" />
          <input
            v-model="tambahBarangSearch"
            type="text"
            class="tb-search-input"
            placeholder="Cari barang..."
            @input="onTambahBarangSearch(tambahBarangSearch)"
          />
        </div>
        <div v-if="tambahBarangLoading" class="modal-loading">Memuat...</div>
        <div v-else class="tb-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th style="width: 30px" class="tc">
                  <input type="checkbox" :checked="allTambahBarangChecked" @change="toggleAllTambahBarang" />
                </th>
                <th style="width: 80px">SKU</th>
                <th>Nama Barang</th>
                <th style="width: 70px" class="tc">Sat</th>
                <th style="width: 100px" class="tr">Harga</th>
                <th style="width: 60px" class="tr">Disc%</th>
                <th style="width: 90px" class="tc">Id Batch</th>
                <th style="width: 90px" class="tc">Expired</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in tambahBarangItems" :key="brg.sku + '|' + (brg.idBatch || '')" class="modal-row" @click="toggleTambahBarang(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahBarangSelected(brg)" @change="toggleTambahBarang(brg)" />
                </td>
                <td class="mono">{{ brg.sku }}</td>
                <td>{{ brg.namaBarang }}</td>
                <td class="tc">{{ brg.satuan }}</td>
                <td class="tr">{{ fmt(Number(brg.harga)) }}</td>
                <td class="tr">{{ brg.discPr }}</td>
                <td class="mono tc">{{ brg.idBatch || "-" }}</td>
                <td class="tc">{{ brg.expired }}</td>
              </tr>
              <tr v-if="tambahBarangItems.length === 0">
                <td colspan="8" class="empty-state">Tidak ada barang yang cocok.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2 tb-actions">
        <span class="tb-count" v-if="selectedTambahBarang.length > 0">
          {{ selectedTambahBarang.length }} barang dipilih
        </span>
        <v-spacer />
        <v-btn variant="text" size="small" @click="showTambahBarangModal = false">Batal</v-btn>
        <v-btn size="small" color="primary" class="tb-add-btn" @click="addSelectedTambahBarang">
          Tambah ({{ selectedTambahBarang.length }})
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <SearchModal
    v-model="showFPModal"
    title="Pilih Nomor Faktur"
    :columns="[
      { key: 'nomor', title: 'Nomor Faktur', width: '170px' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
      { key: 'customer', title: 'Customer' },
      { key: 'total', title: 'Total', width: '120px', align: 'right' },
    ]"
    :items="fpOptions"
    :loading="fpLoading"
    :server-search="true"
    search-placeholder="Cari faktur..."
    @select="selectFP"
    @search="searchFP"
  />

  <SearchModal
    v-model="showGudangModal"
    title="Pilih Gudang"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Gudang' },
    ]"
    :items="gudangOptions"
    search-placeholder="Cari gudang..."
    @select="selectGudang"
  />

  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang"
    :columns="[
      { key: 'sku', title: 'SKU', width: '80px' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'idBatch', title: 'Id Batch', width: '100px', align: 'center' },
      { key: 'expired', title: 'Expired', width: '100px', align: 'center' },
    ]"
    :items="barangOptions"
    :loading="barangLoading"
    :server-search="true"
    search-placeholder="Cari barang..."
    @select="selectBarang"
    @search="searchBarang"
  />

  <!-- Dialog Otorisasi (paritas TfrmOtorisasi Delphi) -->
  <OtorisasiDialog
    v-model="showOtorisasi"
    :variant="1"
    @success="onOtorisasiSuccess"
    @fail="onOtorisasiFail"
    @cancel="onOtorisasiCancel"
  />

  <!-- Dialog konfirmasi generik (MessageDlg paritas) -->
  <v-dialog v-model="confirmState.visible" max-width="380" persistent>
    <v-card rounded="false">
      <div class="ot-title-bar" style="background: var(--ds-primary, #0284c7); color: white; font-size: 12px; font-weight: 700; padding: 6px 12px;">
        {{ confirmState.title }}
      </div>
      <v-card-text class="pa-4">{{ confirmState.message }}</v-card-text>
      <v-card-actions class="pa-3 pt-0">
        <v-spacer />
        <v-btn size="small" variant="outlined" @click="confirmState.onNo">No</v-btn>
        <v-btn size="small" color="primary" variant="flat" @click="confirmState.onYes">Yes</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   RETUR PENJUALAN — Classic Desktop Layout (matches SO/DO/FP/BayarCustomer)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.retj-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.retj-header-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.retj-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.retj-legend {
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

.retj-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.retj-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.retj-detail-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}

/* ── Field Row ────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
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

.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

.f-txa {
  flex: 1;
  max-width: 400px;
  min-height: 60px;
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

/* ── Search Group ─────────────────────────────────────────────── */
.search-group {
  display: flex;
  flex: 1;
  max-width: 400px;
  gap: 2px;
}

.w-20 { width: 25%; flex: none !important; }
.w-80 { width: 75%; }

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

.check-lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 14px;
  height: 14px;
}

/* ── Detail Table ─────────────────────────────────────────────── */
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
  overflow: auto;
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
}

.detail-table td:last-child {
  border-right: none;
}

.detail-table-header-tbl {
  table-layout: fixed;
}

.detail-table-body-tbl {
  table-layout: fixed;
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

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

/* ── Cell Input / Search / Button ─────────────────────────────── */
/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.cell-search {
  display: flex;
  gap: 2px;
}

.cell-inp {
  width: 100%;
  height: 22px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px;
  font-size: 11px;
  outline: none;
  background: white;
  box-sizing: border-box;
}

.cell-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.cell-btn {
  height: 22px;
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

.btn-add-row {
  height: 28px;
  padding: 0 14px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.btn-add-row:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-del {
  background: none;
  border: none;
  color: var(--ds-danger, #c62828);
  cursor: pointer;
  font-weight: bold;
}

/* ── Footer ───────────────────────────────────────────────────── */
.retj-footer {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  padding: 8px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}

.retj-footer-left,
.retj-footer-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calc-box {
  width: 100%;
  max-width: 340px;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.calc-row label {
  width: 60px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.calc-inp {
  width: 70px;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 4px;
  font-size: 11px;
  text-align: right;
  outline: none;
  background: white;
}

.calc-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.calc-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.calc-val-total {
  font-size: 16px;
  font-weight: 800;
  color: var(--ds-primary, #0284c7);
  font-variant-numeric: tabular-nums;
  background: var(--ds-primary-50, #E8EDF5);
  padding: 4px 12px;
  border-radius: 0;
  margin-left: auto;
}

.calc-total-row {
  border-top: 2px solid var(--ds-primary, #0284c7);
  padding-top: 6px;
}

/* ── Modal Tambah Baris (lookup barang) ──────────────────────── */
.tb-title {
  font-size: 13px;
  font-weight: 700;
  border-top: 3px solid var(--ds-primary, #0284c7);
}

.tb-search {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  height: 30px;
  margin-bottom: 8px;
}

.tb-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--ds-text, #0c4a6e);
}

.modal-loading {
  padding: 24px;
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 12px;
  font-style: italic;
}

.tb-table-wrap {
  max-height: 340px;
  overflow: auto;
  border: 1px solid var(--ds-border, #A0AAB8);
}

.modal-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.modal-tbl thead tr {
  background: var(--ds-primary, #0284c7);
  position: sticky;
  top: 0;
  z-index: 1;
}

.modal-tbl th {
  color: white;
  font-weight: 700;
  font-size: 11px;
  padding: 6px 8px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
}

.modal-tbl td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  color: var(--ds-text, #0c4a6e);
  vertical-align: middle;
  white-space: nowrap;
}

.modal-tbl th:last-child,
.modal-tbl td:last-child {
  border-right: none;
}

.modal-tbl tbody tr:nth-child(even) td {
  background: var(--ds-surface, #F0F3F8);
}

.modal-row {
  cursor: pointer;
}

.modal-row:hover td {
  background: var(--ds-primary-50, #E8EDF5);
}

.tb-count {
  font-size: 11px;
  color: var(--ds-text-muted, #8494A7);
}

.tb-add-btn {
  border-radius: 0;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
</style>