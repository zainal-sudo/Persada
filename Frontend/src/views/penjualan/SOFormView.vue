<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconShoppingBag, IconSearch, IconPlus, IconTrash, IconAlertTriangle, IconHistory, IconFilter, IconAdjustmentsHorizontal } from "@tabler/icons-vue";
import ColumnFilter, { type ColumnFilterValue } from "@/components/ColumnFilter.vue";
import { soFormApi, type SOForm, type SODetail } from "@/api/penjualan/soFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useSoPrint } from "@/composables/useSoPrint";
import { useEscClose } from "@/composables/useEscClose";

import DsDatePicker from "@/components/DsDatePicker.vue";
const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  previewTitle,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  PrinterDialog,
  PrintPreviewDialog,
} = useSoPrint();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

// Menandakan user sudah mencoba menyimpan — dipakai untuk menampilkan
// highlight merah pada field wajib yang masih kosong.
const attemptedSave = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<SOForm>({
  isEdit: false,
  nomor: "",
  nomorSosales: "",
  tanggal: today,
  memo: "",
  cusKode: "",
  cusNama: "",
  alamat: "",
  shipAddress: "",
  slsKode: "",
  slsNama: "",
  slaKode: "",
  slaNama: "",
  discFaktur: 0,
  discFakturPr: 0,
  amount: 0,
  taxAmount: 0,
  dp: 0,
  rekDp: "",
  rekNama: "",
  isTax: 1,
  isEcer: 0,
  isProforma: 0,
  detail: [],
});

// ── Field Error State (dipakai setelah user coba Simpan) ────────────
const cusError = computed(() => attemptedSave.value && !form.value.cusKode);
const slaError = computed(() => attemptedSave.value && !form.value.slaKode);

// ── Lookup Options ───────────────────────────────────────────────────
const customerOptions = ref<any[]>([]);
const salesmanAktifOptions = ref<any[]>([]);
const rekeningOptions = ref<any[]>([]);
const barangOptions = ref<any[]>([]);
const customerLoading = ref(false);
const barangLoading = ref(false);
// Rayon milik salesman yang dipilih (dari tsalesmanaktif_dtl)
const rayonOptions = ref<{ kode: string; nama: string }[]>([]);

// ── Modal State ──────────────────────────────────────────────────────
const showCustomerModal = ref(false);
const showSalesmanModal = ref(false);
const showRekeningModal = ref(false);
const showBarangModal = ref(false);
const showAmbilSOModal = ref(false);
const activeDetailIndex = ref(-1);
const isAddRowMode = ref(false);

// ── Riwayat Harga State ───────────────────────────────────────────
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
    riwayatHargaItems.value = await soFormApi.getRiwayatHarga(
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

// ── Ambil SO Modal ───────────────────────────────────────────────────
const ambilSOItems = ref<any[]>([]);
const ambilSOLoading = ref(false);
const ambilSOSearch = ref("");

// ── Column Filters for Ambil SO ────────────────────────────────────
const ambilSOColumnFilters = ref<Record<string, ColumnFilterValue>>({});
const ambilSOActiveFilterCol = ref<string | null>(null);
const ambilSOFDropdownStyle = ref<Record<string, string>>({});

const openAmbilSOColFilter = (key: string, e: MouseEvent) => {
  const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const POPUP_WIDTH = 190; // harus sama dengan lebar .cf-dropdown
  const MARGIN = 8;
  const viewportW = window.innerWidth;
  // Default: rata kiri dengan tombol filter
  let left = btnRect.left;
  // Kalau melebihi tepi kanan layar, balik ke kiri agar tidak terpotong
  if (left + POPUP_WIDTH + MARGIN > viewportW) {
    left = Math.min(btnRect.right, viewportW - MARGIN) - POPUP_WIDTH;
  }
  // Jaga agar tidak keluar layar di sisi kiri (layar sempit)
  left = Math.max(MARGIN, Math.min(left, viewportW - POPUP_WIDTH - MARGIN));
  ambilSOFDropdownStyle.value = {
    position: "fixed",
    top: btnRect.bottom + 4 + "px",
    left: left + "px",
    zIndex: "9999",
  };
  ambilSOActiveFilterCol.value = key;
};
const closeAmbilSOColFilter = () => {
  ambilSOActiveFilterCol.value = null;
};
const ambilSOColHasFilter = (key: string) => {
  return ambilSOColumnFilters.value[key] != null;
};
const onAmbilSOFilterUpdate = (key: string, val: ColumnFilterValue | null) => {
  if (val) {
    ambilSOColumnFilters.value = { ...ambilSOColumnFilters.value, [key]: val };
  } else {
    const copy = { ...ambilSOColumnFilters.value };
    delete copy[key];
    ambilSOColumnFilters.value = copy;
  }
};
const applyAmbilSOColFilter = (item: any, key: string): boolean => {
  const f = ambilSOColumnFilters.value[key];
  if (!f) return true;
  const raw = item[key] ?? "";
  const val = String(raw).toLowerCase();

  if ("allowed" in f) {
    // SelectFilter
    return (f as any).allowed.has(String(raw));
  }

  if ("operator" in f && "value" in f) {
    const op = String((f as any).operator);
    const v = (f as any).value;

    // DateFilter (so_tanggal; sel ISO yyyy-mm-dd → banding string = kronologis)
    if (
      "valueTo" in f &&
      ["between", "equals", "before", "after"].includes(op)
    ) {
      const from = String(v ?? "");
      const to = String((f as any).valueTo ?? "");
      const s = val.substring(0, 10);
      switch (op) {
        case "between": return (!from || s >= from) && (!to || s <= to);
        case "equals": return !from || s === from;
        case "before": return !from || s < from;
        case "after": return !from || s > from;
      }
      return false;
    }

    // TextFilter
    const q = String(v ?? "").toLowerCase();
    switch (op) {
      case "contains":
      case "search": return val.includes(q);
      case "equals": return val === q;
      case "not_contains": return !val.includes(q);
      case "starts_with": return val.startsWith(q);
      case "ends_with": return val.endsWith(q);
      case "empty": return val === "";
      case "not_empty": return val !== "";
      default: return true;
    }
  }
  return true;
};

// ── Konfirmasi Disc (menggantikan window.confirm) ────────────────────
// window.confirm() memutus alur visual karena berupa dialog native
// browser, bukan bagian dari UI aplikasi. Ini menggantikannya dengan
// dialog yang konsisten dengan dialog lain di form ini.
const discConfirmDialog = ref(false);
const discConfirmMsg = ref("");
let discConfirmResolve: ((value: boolean) => void) | null = null;
const discPreviousValue = ref(0);
const discValidateItem = ref<SODetail | null>(null);

const askDiscConfirm = (msg: string, previousValue: number, item: SODetail): Promise<boolean> => {
  discConfirmMsg.value = msg;
  discPreviousValue.value = previousValue;
  discValidateItem.value = item;
  discConfirmDialog.value = true;
  return new Promise((resolve) => {
    discConfirmResolve = resolve;
  });
};

const resolveDiscConfirm = (val: boolean) => {
  discConfirmDialog.value = false;
  if (!val && discValidateItem.value) {
    // Batal — revert ke nilai sebelumnya
    discValidateItem.value.discPr = discPreviousValue.value;
    updateRowTotal(discValidateItem.value);
  }
  discConfirmResolve?.(val);
  discConfirmResolve = null;
  discValidateItem.value = null;
};

// Esc = Batal: harus lewat resolveDiscConfirm(false), bukan sekadar menutup
// dialog. Selain me-resolve Promise (kalau dialognya ditutup langsung, await di
// askDiscConfirm menggantung selamanya), path itu juga mengembalikan discPr ke
// nilai sebelumnya.
useEscClose(discConfirmDialog, () => resolveDiscConfirm(false));
// ── PPN Helper ───────────────────────────────────────────────────────
// Paritas Delphi Ulib.getangkappn: 1.1 sebelum 01-04-2022, 1.11 sesudahnya.
const getAngkaPPN = (tanggal: string) => {
  const cutoff = new Date("2022-04-01");
  const t = tanggal ? new Date(tanggal) : new Date();
  return t >= cutoff ? 1.11 : 1.1;
};

// ── Hitung Total ─────────────────────────────────────────────────────
const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum, d) => {
    const qty = Number(d.qty) || 0;
    const harga = Number(d.harga) || 0;
    const discPr = Number(d.discPr) || 0;
    return sum + (qty * harga * (100 - discPr) / 100);
  }, 0);
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
};

watch(showBarangModal, (val) => {
  if (!val && isAddRowMode.value) {
    isAddRowMode.value = false;
  }
});
watch(showAmbilSOModal, (val) => {
  if (!val) ambilSOActiveFilterCol.value = null;
});

// ── Load Nomor Otomatis ──────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await soFormApi.getNomor(form.value.tanggal, form.value.isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor SO.");
  }
};

// ── Load Lookup Options ──────────────────────────────────────────────
const loadOptions = async () => {
  try {
    salesmanAktifOptions.value = await soFormApi.getSalesmanAktif();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data salesman.");
  }
};

const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await soFormApi.getCustomer(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari customer.");
  } finally {
    customerLoading.value = false;
  }
};

const searchBarang = async (query: string) => {
  barangLoading.value = true;
  try {
    const jenisCustomer = customerOptions.value.find(c => c.kode === form.value.cusKode)?.jenisCustomer || "";
    barangOptions.value = await soFormApi.getBarang(query || "", jenisCustomer);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    barangLoading.value = false;
  }
};

const searchRekening = async (query: string) => {
  try {
    rekeningOptions.value = await soFormApi.getRekening(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari rekening.");
  }
};

// ── Select Handlers ──────────────────────────────────────────────────
const selectCustomer = async (cust: any) => {
  // Cek locked dulu sebelum update form
  try {
    const res = await soFormApi.checkCustomerLocked(cust.kode);
    if (res.locked) {
      toast.warning("Customer ini terkunci!");
      return;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
  }

  form.value.cusKode = cust.kode;
  form.value.cusNama = cust.nama;
  form.value.alamat = cust.alamat || "";
  form.value.shipAddress = cust.shipAddress || "";
  showCustomerModal.value = false;
};

const selectSalesman = (sla: any) => {
  form.value.slaKode = sla.kode;
  form.value.slaNama = sla.nama;

  // Rayon bisa dipilih — default rayon pertama salesman ini
  rayonOptions.value = sla.rayons || [];
  const first = rayonOptions.value[0];
  form.value.slsKode = first?.kode || "";
  form.value.slsNama = first?.nama || "";

  showSalesmanModal.value = false;
};

const onRayonChange = () => {
  const rayon = rayonOptions.value.find(r => r.kode === form.value.slsKode);
  form.value.slsNama = rayon?.nama || "";
};

const selectRekening = (rek: any) => {
  form.value.rekDp = rek.kode;
  form.value.rekNama = rek.nama;
  showRekeningModal.value = false;
};

// ── Barang Selection ─────────────────────────────────────────────────
const openBarangModal = (idx: number) => {
  activeDetailIndex.value = idx;
  isAddRowMode.value = false;
  showBarangModal.value = true;
  searchBarang("");
};

const selectBarang = (brg: any) => {
  if (isAddRowMode.value) {
    const harga = form.value.isTax === 1
      ? Number(brg.hargaJual)
      : Number(brg.hargaJual) * getAngkaPPN(form.value.tanggal);
    form.value.detail.push({
      no: form.value.detail.length + 1,
      brgKode: brg.kode,
      brgNama: brg.nama,
      satuan: brg.satuan,
      qty: 1,
      harga: harga,
      discPr: 0,
      total: harga,
      keterangan: "",
    });
    isAddRowMode.value = false;
  } else {
    const idx = activeDetailIndex.value;
    if (idx < 0 || !form.value.detail[idx]) return;
    const d = form.value.detail[idx];
    d.brgKode = brg.kode;
    d.brgNama = brg.nama;
    d.satuan = brg.satuan;
    d.harga = form.value.isTax === 1
      ? Number(brg.hargaJual)
      : Number(brg.hargaJual) * getAngkaPPN(form.value.tanggal);
    d.discPr = 0;
    d.total = d.qty * d.harga;
  }
  showBarangModal.value = false;
  hitung();
};

// ── Detail Grid ──────────────────────────────────────────────────────
const addRow = () => {
  isAddRowMode.value = true;
  activeDetailIndex.value = -1;
  showBarangModal.value = true;
  searchBarang("");
};

// ── Tambah Detail (dialog checklist barang — pola DOFormView) ────────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

const brgKey = (b: any) => String(b.kode);

const isTambahDetailSelected = (brg: any) =>
  selectedTambahDetail.value.some((b) => brgKey(b) === brgKey(brg));

const toggleTambahDetail = (brg: any) => {
  const idx = selectedTambahDetail.value.findIndex((b) => brgKey(b) === brgKey(brg));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(brg);
};

const allTambahDetailChecked = computed(() =>
  tambahDetailItems.value.length > 0 &&
  tambahDetailItems.value.every((b) => isTambahDetailSelected(b))
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahDetailItems.value) {
      if (!isTambahDetailSelected(brg)) selectedTambahDetail.value.push(brg);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((b) => brgKey(b)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter((b) => !keys.has(brgKey(b)));
  }
};

const filteredTambahDetailItems = computed(() => {
  const q = tambahDetailSearch.value.toLowerCase().trim();
  if (!q) return tambahDetailItems.value;
  return tambahDetailItems.value.filter((b) =>
    String(b.kode).toLowerCase().includes(q) ||
    String(b.nama || "").toLowerCase().includes(q)
  );
});

// Tambah satu baris barang (dup-guard: SKU yang sama sudah ada di detail).
// Paritas selectBarang mode add-row: qty awal 1, harga sesuai isTax.
const addBrgRow = (brg: any): boolean => {
  if (form.value.detail.some((x) => x.brgKode === brg.kode)) return false;
  const harga = form.value.isTax === 1
    ? Number(brg.hargaJual)
    : Number(brg.hargaJual) * getAngkaPPN(form.value.tanggal);
  form.value.detail.push({
    no: form.value.detail.length + 1,
    brgKode: brg.kode,
    brgNama: brg.nama,
    satuan: brg.satuan,
    qty: 1,
    harga: harga,
    discPr: 0,
    total: harga,
    keterangan: "",
  });
  return true;
};

const openTambahDetail = async () => {
  if (!form.value.cusKode) {
    toast.warning("Pilih customer dahulu.");
    return;
  }
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    const jenisCustomer = customerOptions.value.find(c => c.kode === form.value.cusKode)?.jenisCustomer || "";
    tambahDetailItems.value = await soFormApi.getBarang("", jenisCustomer);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Pencarian server-side (debounce) — barang di luar batch awal tetap ketemu.
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    if (!form.value.cusKode) return;
    tambahDetailLoading.value = true;
    try {
      const jenisCustomer = customerOptions.value.find(c => c.kode === form.value.cusKode)?.jenisCustomer || "";
      tambahDetailItems.value = await soFormApi.getBarang(query, jenisCustomer);
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal mencari barang.");
    } finally {
      tambahDetailLoading.value = false;
    }
  }, 250);
};

const addSelectedTambahDetail = () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    if (addBrgRow(brg)) added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail / tidak ditemukan.");
  showTambahDetailModal.value = false;
  hitung();
  // Fokus langsung ke QTY baris pertama yang baru ditambahkan (pola DOFormView).
  if (added > 0) {
    nextTick(() => soEnterEdit(firstRow, "qty"));
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  hitung();
};

const updateRowTotal = (d: SODetail) => {
  d.total = d.qty * d.harga * (100 - d.discPr) / 100;
  hitung();
};

// ── Format & Parse Angka ─────────────────────────────────────────
const formatCurrency = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmt = (v: number) => formatCurrency(v);
const fmtQty = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// ── Input System — bebas ketik seperti string, format saat blur ───
// Saat ketik: input dikendalikan langsung oleh DOM (bukan Vue).
//             Raw value disimpan di rawInputValues agar Vue re-render
//             tidak mengganggu input.
// Saat blur:  endEdit format value ke tampilan rapi.
// Alasan: Vue :value binding selalu overwrite DOM value saat re-render,
//         sehingga user tidak bisa bebas ketik.
const rawInputValues: Record<string, string> = {};

// ── Navigasi grid detail (ala Excel) — keyboard-first ────────────────
const soCellId = (c: string, r: number) => `so-cell-${c}-${r}`;
const soTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(soCellId(c, r)) as HTMLInputElement | null;
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

const soGrid = useDetailGrid({
  cols: ["sku", "qty", "harga", "disc", "keterangan"],
  rowCount: () => form.value.detail.length,
  cellId: soCellId,
  cellPrefix: "so-cell",
  onPicker: (r, c) => {
    if (c === "sku") openBarangModal(r);
  },
  typeEditCols: ["qty", "harga", "disc", "keterangan"],
  onTypeEdit: soTypeEdit,
});

const {
  focusCell: soFocusCell,
  editMode: soEditMode,
  gridBlur: soGridBlur,
  onGridCellFocus: soOnGridFocus,
  setSelect: soSetSelect,
  enterEdit: soEnterEdit,
  commitEdit: soCommitEdit,
  moveFocus: soMoveFocus,
} = soGrid;

const isActiveCell = (r: number, c: string) =>
  soFocusCell.value?.r === r && soFocusCell.value?.c === c;

const getInputValue = (key: string, modelValue: number, decimals = 2) => {
  // Kalau sedang diedit, return raw value dari store
  if (key in rawInputValues) return rawInputValues[key];
  // Kalau idle, return formatted
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startEdit = (key: string, e: Event, raw: number) => {
  // Nilai 0 dikosongkan saat fokus (pola startQtyEdit): langsung ketik.
  // Simpan raw value — ini mencegah Vue overwrite saat re-render
  const val = raw === 0 ? "" : String(raw);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
};

const endEdit = (key: string, e: Event, raw: number, decimals = 2) => {
  // Hapus raw value dari store
  delete rawInputValues[key];
  // Format DOM value
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

// ── Input Handlers (saat ketik — update model + raw store) ───────
const onHargaInput = (e: Event, d: SODetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['harga-' + idx] = el.value;
  d.harga = parseInput(el.value);
  updateRowTotal(d);
};

const onQtyInput = (e: Event, d: SODetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, '')) || 0);
  updateRowTotal(d);
};

const onDiscPrInput = (e: Event, d: SODetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['disc-' + idx] = el.value;
  d.discPr = parseInput(el.value);
  updateRowTotal(d);
};

const onDiscFakturInput = (e: Event) => {
  rawInputValues['discFaktur'] = (e.target as HTMLInputElement).value;
  form.value.discFaktur = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onDiscFakturPrInput = (e: Event) => {
  rawInputValues['discFakturPr'] = (e.target as HTMLInputElement).value;
  form.value.discFakturPr = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onDpInput = (e: Event) => {
  rawInputValues['dp'] = (e.target as HTMLInputElement).value;
  form.value.dp = parseInput((e.target as HTMLInputElement).value);
};

// ── Navigasi Keyboard pada Grid Detail ────────────────────────────────
// Enter di kolom Keterangan pada baris terakhir langsung menambah baris
// baru dan memindahkan fokus ke tombol cari barang baris tersebut,
// supaya entri banyak baris tidak perlu bolak-balik ke mouse.
const handleKeteranganEnter = (idx: number) => {
  if (idx !== form.value.detail.length - 1) return;
  addRow();
  nextTick(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(".detail-table .cell-btn");
    buttons[buttons.length - 1]?.focus();
  });
};

// ── Validasi SKU duplikat ────────────────────────────────────────────
const validateSKU = (): boolean => {
  const seen = new Set<number>();
  for (let i = 0; i < form.value.detail.length; i++) {
    const sku = form.value.detail[i].brgKode;
    if (sku === 0) {
      toast.warning(`SKU baris ${i + 1} belum dipilih.`);
      return false;
    }
    if (seen.has(sku)) {
      toast.warning(`SKU ${sku} duplikat di baris ${i + 1}.`);
      return false;
    }
    seen.add(sku);
  }
  return true;
};

// ── Validasi Disc Sales ──────────────────────────────────────────────
const validateDisc = async (d: SODetail): Promise<boolean> => {
  try {
    const res = await soFormApi.getDiscSales(d.brgKode);
    if (Number(d.discPr) > Number(res.discSales)) {
      // Simpan nilai sebelumnya untuk revert jika batal
      const previousValue = discPreviousValue.value;
      return await askDiscConfirm(
        `Disc ${d.discPr}% pada "${d.brgNama}" melebihi batas maksimal ${res.discSales}%. Tetap lanjutkan?`,
        previousValue,
        d
      );
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
  }
  return true;
};

// ── Validasi Last Cost ───────────────────────────────────────────────
const validateLastCost = async (d: SODetail): Promise<void> => {
  try {
    const res = await soFormApi.getLastCost(d.brgKode);
    if (Number(d.harga) < Number(res.lastCost)) {
      toast.warning(`SKU ${d.brgKode} — Harga kurang dari last cost: ${formatCurrency(res.lastCost)}`);
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
  }
};

// ── Validasi Form ────────────────────────────────────────────────────
const validateSave = async () => {
  attemptedSave.value = true;

  if (!form.value.cusKode) {
    toast.warning("Customer belum dipilih.");
    return;
  }
  if (!form.value.slaKode) {
    toast.warning("Salesman belum dipilih.");
    return;
  }
  if (form.value.detail.length === 0) {
    toast.warning("Belum ada detail. Tidak dapat disimpan.");
    return;
  }

  if (!validateSKU()) return;

  for (const d of form.value.detail) {
    if (Number(d.qty) === 0) {
      toast.warning(`QTY baris ${d.no} belum diisi.`);
      return;
    }
    const discOK = await validateDisc(d);
    if (!discOK) return;
    await validateLastCost(d);
  }

  if (Number(form.value.dp) > 0 && !form.value.rekDp) {
    toast.warning("Rekening DP belum diisi.");
    return;
  }

};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await soFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan SO.");
  } finally {
    isSaving.value = false;
  }
};

// ── Simpan & Cetak (paritas cxButton3 Delphi) ──────────────────────
// Simpan lalu langsung minta cetak slip SO.
const confirmSavePrint = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await soFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave("new", nomor);
    await loadAndPreview(nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan SO.");
  } finally {
    isSaving.value = false;
  }
};

// ── Ambil SO ─────────────────────────────────────────────────────────
const filteredAmbilSOItems = computed(() => {
  let items = ambilSOItems.value;
  // Search filter
  const q = ambilSOSearch.value.toLowerCase().trim();
  if (q) {
    items = items.filter((item: any) =>
      (item.so_nomor || '').toLowerCase().includes(q) ||
      (item.cus_nama || '').toLowerCase().includes(q)
    );
  }
  // Column filters
  const filterKeys = Object.keys(ambilSOColumnFilters.value);
  if (filterKeys.length > 0) {
    items = items.filter((item: any) =>
      filterKeys.every((key) => applyAmbilSOColFilter(item, key))
    );
  }
  return items;
});

const openAmbilSO = async () => {
  ambilSOSearch.value = "";
  ambilSOColumnFilters.value = {};
  ambilSOActiveFilterCol.value = null;
  showAmbilSOModal.value = true;
  ambilSOLoading.value = true;
  try {
    const cabang = authStore.userCabang || "Solo";
    ambilSOItems.value = await soFormApi.getAmbilSO(cabang);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data SO.");
  } finally {
    ambilSOLoading.value = false;
  }
};

const selectAmbilSO = async (item: any) => {
  try {
    // Simpan nomor SO sumber → ditandai sdh dieksekusi saat save (paritas Delphi)
    form.value.nomorSosales = item.so_nomor;

    // Cek locked dulu sebelum update form
    try {
      const lockRes = await soFormApi.checkCustomerLocked(item.so_cus_kode);
      if (lockRes.locked) {
        toast.warning("Customer ini terkunci!");
        return;
      }
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
    }

    const details = await soFormApi.getDetailAmbilSO(item.so_nomor);

    // Clear form & set customer
    form.value.detail = [];
    form.value.cusKode = item.so_cus_kode;
    form.value.cusNama = item.cus_nama;
    form.value.alamat = customerOptions.value.find((c) => c.kode === item.so_cus_kode)?.alamat || "";

    // Set salesman
    if (details.length > 0) {
      form.value.slsKode = details[0].slsKode;
      form.value.slaKode = details[0].slaKode;

      // Set salesman aktif + rayon options
      const salesman = salesmanAktifOptions.value.find(s => s.kode === details[0].slaKode);
      if (salesman) {
        form.value.slaNama = salesman.nama;
        rayonOptions.value = salesman.rayons || [];
      }

      // Set rayon (dari detail SO yang diambil)
      const rayon = rayonOptions.value.find(r => r.kode === details[0].slsKode);
      form.value.slsNama = rayon?.nama || "";
    }

    // Isi detail — FIX MAPPING
    form.value.detail = details.map((d: any, i: number) => {
      const qty = Number(d.qty) || 0;
      const discPr = Number(d.discPr) || 0;

      // Harga: kalau pajak → hargaJual, kalau non-pajak → hargaJual * PPN
      const harga = form.value.isTax === 1
        ? Number(d.hargaJual)
        : Number(d.hargaJual) * getAngkaPPN(form.value.tanggal);

      // Total: (100 - discPr) * (harga * qty) / 100
      // Kalau non-pajak → dikali PPN
      const total = form.value.isTax === 1
        ? ((100 - discPr) * (harga * qty) / 100)
        : ((100 - discPr) * (harga * qty) / 100) * getAngkaPPN(form.value.tanggal);

      return {
        no: i + 1,
        brgKode: Number(d.brgKode),
        brgNama: d.brgNama,
        satuan: d.brgSatuan,      // ← FIX: brgSatuan
        qty: qty,
        harga: harga,
        discPr: discPr,
        total: total,
        keterangan: d.keterangan || "",
      };
    });

    hitung();
    showAmbilSOModal.value = false;

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mengambil detail SO.");
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
    const data = await soFormApi.getDetailForm(decodeURIComponent(nomor));

    // Pastikan field terisi dengan benar
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
      tanggal: data.tanggal || today,
      cusKode: data.cusKode || "",
      cusNama: data.cusNama || "",
      alamat: data.alamat || "",
      slsKode: data.slsKode || "",
      slsNama: data.slsNama || "",
      slaKode: data.slaKode || "",
      slaNama: data.slaNama || "",
      detail: data.detail || [],
    };

    // Sinkronkan rayon options dari salesman aktif yang dipilih
    const salesman = salesmanAktifOptions.value.find(s => s.kode === form.value.slaKode);
    rayonOptions.value = salesman?.rayons || [];
    if (form.value.slsKode) {
      const rayon = rayonOptions.value.find(r => r.kode === form.value.slsKode);
      if (rayon) form.value.slsNama = rayon.nama;
    }

    // Set customer options (kalau belum ada)
    if (form.value.cusKode && !customerOptions.value.find(c => c.kode === form.value.cusKode)) {
      customerOptions.value.push({
        kode: form.value.cusKode,
        nama: form.value.cusNama,
        alamat: data.alamat || "",
      });
    }

    // Hitung total
    hitung();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data SO.");
    router.push({ name: "soBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  attemptedSave.value = false;
  form.value = {
    isEdit: false,
    nomor: "",
    nomorSosales: "",
    tanggal: today,
    memo: "",
    cusKode: "",
    cusNama: "",
    alamat: "",
    shipAddress: "",
    slsKode: "",
    slsNama: "",
    slaKode: "",
    slaNama: "",
    discFaktur: 0,
    discFakturPr: 0,
    amount: 0,
    taxAmount: 0,
    dp: 0,
    rekDp: "",
    rekNama: "",
    isTax: 1,
    isEcer: 0,
    isProforma: 0,
    detail: [],
  };
  rayonOptions.value = [];
  loadNomor();
  nextTick(() => {
    document.querySelector<HTMLButtonElement>(".so-header .btn-search")?.focus();
  });
};

// ── Detail table column widths — used by both header and body ───────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: null },   // 나머지 남은 너비 차지
  { key: 'satuan', width: 60 },
  { key: 'qty', width: 60 },
  { key: 'harga', width: 100 },
  { key: 'disc', width: 60 },
  { key: 'total', width: 100 },
  { key: 'keterangan', width: 130 },
  { key: 'action', width: 30 },
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadOptions();
  await loadData();
  // Fokuskan langsung ke pencarian Customer saat membuat SO baru,
  // supaya user bisa langsung mengetik tanpa klik dulu.
  if (!isEdit.value) {
    nextTick(() => {
      document.querySelector<HTMLButtonElement>(".so-header .btn-search")?.focus();
    });
  }
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Sales Order' : 'Tambah Sales Order Baru'"
    :icon="IconShoppingBag"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :show-save-print="true"
    @save-action="confirmSave"
    @save-print="confirmSavePrint"
  >
    <!-- ═══ HEADER ═══ -->
    <div class="so-layout">
      <div class="so-header-grid">
        <!-- Customer Info -->
        <fieldset class="so-groupbox">
          <legend class="so-legend">Informasi Customer</legend>
          <div class="so-groupbody">
            <div class="f-row" :class="{ 'field-error': cusError }">
              <label class="f-lbl">Customer <span class="req">*</span></label>
              <div class="search-group">
                <input :value="form.cusKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.cusNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Customer..." />
                <button class="btn-search" type="button" @click="showCustomerModal = true; searchCustomer('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Alamat</label>
              <input :value="form.alamat" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Ship Address</label>
              <input v-model="form.shipAddress" class="f-inp" />
            </div>
            <div class="f-row" :class="{ 'field-error': slaError }">
              <label class="f-lbl">Salesman <span class="req">*</span></label>
              <div class="combo-group">
                <input :value="form.slaKode" class="f-inp combo-kode readonly-bg" readonly placeholder="Kode" />
                <input :value="form.slaNama" class="f-inp combo-nama readonly-bg" readonly placeholder="Pilih Salesman..." />
                <button class="btn-search" type="button" @click="showSalesmanModal = true">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Rayon</label>
              <div class="combo-group">
                <select
                  v-model="form.slsKode"
                  class="f-inp combo-nama"
                  :disabled="rayonOptions.length === 0"
                  @change="onRayonChange"
                >
                  <option v-if="rayonOptions.length === 0" value="">
                    {{ form.slaKode ? 'Salesman tanpa rayon' : 'Pilih Salesman dulu...' }}
                  </option>
                  <option v-for="r in rayonOptions" :key="r.kode" :value="r.kode">
                    {{ r.nama || r.kode }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="so-groupbox">
          <legend class="so-legend">Informasi Order</legend>
          <div class="so-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" @change="loadNomor" />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" disabled title="Pajak terkunci — selalu aktif (paritas Delphi chkPajak)" />
                Pajak
              </label>
              <label class="check-lbl">
                <input v-model="form.isProforma" type="checkbox" :true-value="1" :false-value="0" />
                Proforma
              </label>
              <label class="check-lbl">
                <input v-model="form.isEcer" type="checkbox" :true-value="1" :false-value="0" />
                Eceran
              </label>
            </div>
            <div class="f-row">
              <button class="btn-ambil-so" type="button" @click="openAmbilSO">
                Ambil Data SO
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="so-groupbox so-detail-group">
        <legend class="so-legend">Detail Barang</legend>
        <div class="so-detail-actions">
          <button class="btn-add-detail" type="button" @click="openTambahDetail">
            <IconPlus :size="13" />
            Tambah Detail
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
                  <th :style="detailColWidthStyle('satuan')" class="tc">Satuan</th>
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('harga')" class="tr">Harga</th>
                  <th :style="detailColWidthStyle('disc')" class="tr">Disc%</th>
                  <th :style="detailColWidthStyle('total')" class="tr">Total</th>
                  <th :style="detailColWidthStyle('keterangan')">Keterangan</th>
                  <th :style="detailColWidthStyle('action')" class="tc"></th>
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
                    <div class="cell-search" :id="'so-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.brgKode" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" title="Cari barang" @click="openBarangModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="cell-muted" :style="detailColWidthStyle('nama')">{{ d.brgNama }}</td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('satuan')">{{ d.satuan }}</td>
                  <td :style="detailColWidthStyle('qty')"><input type="text" inputmode="numeric" class="cell-inp tr" :id="soCellId('qty', idx)" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="soOnGridFocus('qty', idx); startEdit('qty-' + idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); soGridBlur()" /></td>
                  <td :style="detailColWidthStyle('harga')">
                    <div class="cell-search">
                      <input
                        type="text"
                        inputmode="decimal"
                        class="cell-inp tr"
                        :id="soCellId('harga', idx)"
                        :class="{ 'cell-active': isActiveCell(idx, 'harga') }"
                        :value="getInputValue('harga-' + idx, d.harga)"
                        @focus="soOnGridFocus('harga', idx); startEdit('harga-' + idx, $event, d.harga)"
                        @input="onHargaInput($event, d, idx)"
                        @blur="endEdit('harga-' + idx, $event, d.harga); validateLastCost(d); soGridBlur()"
                      />
                      <button class="cell-btn cell-btn-harga" type="button" title="Riwayat Harga" @click="openRiwayatHargaModal(idx)">
                        <IconHistory :size="11" />
                      </button>
                    </div>
                  </td>
                  <td :style="detailColWidthStyle('disc')">
                    <input
                      type="text"
                      inputmode="decimal"
                      class="cell-inp tr"
                      :id="soCellId('disc', idx)"
                      :class="{ 'cell-active': isActiveCell(idx, 'disc') }"
                      :value="getInputValue('disc-' + idx, d.discPr)"
                      @focus="soOnGridFocus('disc', idx); startEdit('disc-' + idx, $event, d.discPr); discPreviousValue = d.discPr"
                      @input="onDiscPrInput($event, d, idx)"
                      @blur="endEdit('disc-' + idx, $event, d.discPr); validateDisc(d); soGridBlur()"
                    />
                  </td>
                  <td class="tr cell-total" :style="detailColWidthStyle('total')">{{ fmt(d.total) }}</td>
                  <td :style="detailColWidthStyle('keterangan')"><input v-model="d.keterangan" class="cell-inp" :id="soCellId('keterangan', idx)" :class="{ 'cell-active': isActiveCell(idx, 'keterangan') }" @focus="soOnGridFocus('keterangan', idx)" @blur="soGridBlur()" @keydown.enter.prevent="handleKeteranganEnter(idx)" /></td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="10" class="empty-state">
                    Belum ada barang. Klik <strong>"Tambah Detail"</strong> atau <strong>"Ambil Data SO"</strong> untuk mulai mengisi.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <!-- ═══ FOOTER ═══ -->
      <div class="so-footer-grid">
        <!-- Memo & DP -->
        <fieldset class="so-groupbox">
          <legend class="so-legend">Memo & Uang Muka</legend>
          <div class="so-groupbody">
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="2"></textarea>
            </div>
            <div class="f-row">
              <label class="f-lbl">Uang Muka</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp f-inp-sm tr"
                :value="getInputValue('dp', form.dp)"
                @focus="startEdit('dp', $event, form.dp)"
                @input="onDpInput"
                @blur="endEdit('dp', $event, form.dp)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Rekening</label>
              <div class="search-group">
                <input :value="form.rekDp" class="f-inp w-20 readonly-bg" readonly />
                <input :value="form.rekNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Rekening..." />
                <button class="btn-search" type="button" @click="showRekeningModal = true; searchRekening('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Calculation -->
        <fieldset class="so-groupbox">
          <legend class="so-legend">Total</legend>
          <div class="so-groupbody">
            <div class="calc-box">
              <div class="calc-row">
                <label class="calc-lbl">Subtotal</label>
                <span class="calc-val">{{ fmt(subtotalBruto) }}</span>
              </div>
              <div class="calc-row">
                <label class="calc-lbl">Disc</label>
                <input type="text" inputmode="decimal" class="calc-inp" :value="getInputValue('discFakturPr', form.discFakturPr)" @focus="startEdit('discFakturPr', $event, form.discFakturPr)" @input="onDiscFakturPrInput" @blur="endEdit('discFakturPr', $event, form.discFakturPr)" />
                <span class="calc-unit">%</span>
                <span class="calc-op">+</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="calc-inp calc-inp-lg"
                  :value="getInputValue('discFaktur', form.discFaktur)"
                  @focus="startEdit('discFaktur', $event, form.discFaktur)"
                  @input="onDiscFakturInput"
                  @blur="endEdit('discFaktur', $event, form.discFaktur)"
                />
                <span class="calc-op">=</span>
                <span class="calc-val">{{ fmt((form.discFakturPr / 100 * subtotalBruto) + form.discFaktur) }}</span>
              </div>
              <div class="calc-row">
                <label class="calc-lbl">Pajak</label>
                <span class="calc-val calc-val-muted">{{ fmt(form.taxAmount) }}</span>
              </div>
              <div class="calc-row calc-total-row">
                <label class="calc-lbl calc-lbl-total">TOTAL</label>
                <span class="calc-val-total">{{ fmt(form.amount) }}</span>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </BaseForm>

  <!-- ═══ MODALS ═══ -->
  <PrinterDialog v-model="showPrinterDialog" @saved="onPrinterSaved" />

  <PrintPreviewDialog
    v-model="showPreviewDialog"
    :title="previewTitle"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />

  <SearchModal
    v-model="showCustomerModal"
    title="Pilih Customer"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Customer' },
      { key: 'alamat', title: 'Alamat' },
    ]"
    :items="customerOptions"
    :loading="customerLoading"
    :server-search="true"
    search-placeholder="Cari customer..."
    @select="selectCustomer"
    @search="searchCustomer"
  />

  <SearchModal
    v-model="showSalesmanModal"
    title="Pilih Salesman"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Salesman' },
    ]"
    :items="salesmanAktifOptions"
    search-placeholder="Cari salesman..."
    @select="selectSalesman"
  />

  <SearchModal
    v-model="showRekeningModal"
    title="Pilih Rekening"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Rekening' },
    ]"
    :items="rekeningOptions"
    :server-search="true"
    search-placeholder="Cari rekening..."
    @select="selectRekening"
    @search="searchRekening"
  />

  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '70px', align: 'center' },
      { key: 'hargaJual', title: 'Harga', width: '120px', align: 'right' },
    ]"
    :items="barangOptions"
    :loading="barangLoading"
    :server-search="true"
    search-placeholder="Cari barang..."
    @select="selectBarang"
    @search="searchBarang"
  />

  <!-- ═══ MODAL TAMBAH DETAIL (checklist barang — pola DOFormView) ═══ -->
  <v-dialog v-model="showTambahDetailModal" max-width="680" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Tambah Detail
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div class="tb-search">
          <IconSearch :size="14" style="color: var(--ds-text-muted, #8494A7); flex-shrink: 0;" />
          <input
            v-model="tambahDetailSearch"
            type="text"
            class="tb-search-input"
            placeholder="Cari barang..."
            @input="onTambahDetailSearch(tambahDetailSearch)"
          />
        </div>
        <div v-if="tambahDetailLoading" class="modal-loading">Memuat...</div>
        <div v-else class="tb-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th style="width: 30px" class="tc">
                  <input type="checkbox" :checked="allTambahDetailChecked" @change="toggleAllTambahDetail" />
                </th>
                <th style="width: 80px">Kode</th>
                <th style="width: 220px">Nama Barang</th>
                <th style="width: 70px" class="tc">Satuan</th>
                <th style="width: 110px" class="tr">Harga</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in filteredTambahDetailItems" :key="brg.kode" class="modal-row" @click="toggleTambahDetail(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.kode }}</td>
                <td>{{ brg.nama }}</td>
                <td class="tc">{{ brg.satuan }}</td>
                <td class="tr">{{ fmt(Number(brg.hargaJual)) }}</td>
              </tr>
              <tr v-if="filteredTambahDetailItems.length === 0">
                <td colspan="5" class="empty-state">Tidak ada barang yang cocok.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2 tb-actions">
        <span class="tb-count" v-if="selectedTambahDetail.length > 0">
          {{ selectedTambahDetail.length }} barang dipilih
        </span>
        <v-spacer />
        <v-btn variant="text" size="small" @click="showTambahDetailModal = false">Batal</v-btn>
        <v-btn size="small" color="primary" class="tb-add-btn" @click="addSelectedTambahDetail">
          Tambah ({{ selectedTambahDetail.length }})
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showAmbilSOModal" max-width="820" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Ambil Data SO (Database Salesman)
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div class="ambil-so-search">
          <IconSearch :size="14" style="color: var(--ds-text-muted, #8494A7); flex-shrink: 0;" />
          <input
            v-model="ambilSOSearch"
            type="text"
            class="ambil-so-search-input"
            placeholder="Cari No. SO atau Customer..."
          />
        </div>
        <div v-if="ambilSOLoading" class="modal-loading">Memuat...</div>
        <div v-else class="ambil-so-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th>
                  <div class="th-inner">
                    <span>No. SO</span>
                    <button class="col-filter-btn" :class="{ active: ambilSOColHasFilter('so_nomor') }" @click.stop="openAmbilSOColFilter('so_nomor', $event)">
                      <IconFilter v-if="ambilSOColHasFilter('so_nomor')" :size="9" :stroke-width="2.2" />
                      <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                    </button>
                  </div>
                </th>
                <th>
                  <div class="th-inner">
                    <span>Customer</span>
                    <button class="col-filter-btn" :class="{ active: ambilSOColHasFilter('cus_nama') }" @click.stop="openAmbilSOColFilter('cus_nama', $event)">
                      <IconFilter v-if="ambilSOColHasFilter('cus_nama')" :size="9" :stroke-width="2.2" />
                      <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                    </button>
                  </div>
                </th>
                <th>
                  <div class="th-inner">
                    <span>Tanggal</span>
                    <button class="col-filter-btn" :class="{ active: ambilSOColHasFilter('so_tanggal') }" @click.stop="openAmbilSOColFilter('so_tanggal', $event)">
                      <IconFilter v-if="ambilSOColHasFilter('so_tanggal')" :size="9" :stroke-width="2.2" />
                      <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                    </button>
                  </div>
                </th>
                <th>
                  <div class="th-inner">
                    <span>Rayon</span>
                    <button class="col-filter-btn" :class="{ active: ambilSOColHasFilter('Rayon') }" @click.stop="openAmbilSOColFilter('Rayon', $event)">
                      <IconFilter v-if="ambilSOColHasFilter('Rayon')" :size="9" :stroke-width="2.2" />
                      <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                    </button>
                  </div>
                </th>
                <th>
                  <div class="th-inner">
                    <span>Salesman</span>
                    <button class="col-filter-btn" :class="{ active: ambilSOColHasFilter('Salesman') }" @click.stop="openAmbilSOColFilter('Salesman', $event)">
                      <IconFilter v-if="ambilSOColHasFilter('Salesman')" :size="9" :stroke-width="2.2" />
                      <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredAmbilSOItems" :key="item.so_nomor" class="modal-row" @click="selectAmbilSO(item)">
                <td class="mono">{{ item.so_nomor }}</td>
                <td>{{ item.cus_nama }}</td>
                <td class="tc">{{ item.so_tanggal }}</td>
                <td>{{ item.Rayon }}</td>
                <td>{{ item.Salesman }}</td>
              </tr>
              <tr v-if="filteredAmbilSOItems.length === 0">
                <td colspan="5" class="empty-state">
                  Tidak ada data SO yang cocok.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showAmbilSOModal = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="discConfirmDialog" max-width="420" persistent>
    <v-card rounded="false" class="disc-confirm-card">
      <div class="disc-confirm-header">
        <IconAlertTriangle :size="18" :stroke-width="2" class="disc-confirm-icon" />
        <span class="disc-confirm-title">Peringatan Diskon</span>
      </div>
      <div class="disc-confirm-body">
        <p class="disc-confirm-msg">{{ discConfirmMsg }}</p>
      </div>
      <div class="disc-confirm-actions">
        <button class="disc-btn disc-btn-cancel" @click="resolveDiscConfirm(false)">Batal</button>
        <button class="disc-btn disc-btn-confirm" @click="resolveDiscConfirm(true)">Tetap Lanjutkan</button>
      </div>
    </v-card>
  </v-dialog>

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

  <Teleport to="body">
    <ColumnFilter
      v-if="ambilSOActiveFilterCol"
      :filter-type="ambilSOActiveFilterCol === 'so_tanggal' ? 'date' : 'text'"
      :column-key="ambilSOActiveFilterCol"
      :title="ambilSOActiveFilterCol"
      :items="ambilSOItems"
      :model-value="ambilSOColumnFilters[ambilSOActiveFilterCol] ?? null"
      :dropdown-style="ambilSOFDropdownStyle"
      @update:model-value="onAmbilSOFilterUpdate(ambilSOActiveFilterCol, $event)"
      @close="closeAmbilSOColFilter"
    />
  </Teleport>
</template>
<style scoped>
/* ═══════════════════════════════════════════════════════════════
   SO FORM — Classic Desktop Layout (matches FPFormView)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.so-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.so-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.so-footer-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.so-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.so-legend {
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

.so-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.so-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.so-detail-group .so-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.so-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}

.btn-add-detail {
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

.btn-add-detail:hover {
  background: var(--ds-primary-dark, #0369a1);
}

/* ── Field Row ────────────────────────────────────────────────── */
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

.req {
  color: #dc2626;
  font-weight: 700;
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
  color: #3D4F6A;
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
}

.f-txa:focus {
  border-color: var(--ds-primary, #0284c7);
}

/* ── Field error ──────────────────────────────────────────────── */
.field-error .f-inp,
.field-error .btn-search {
  border-color: #dc2626;
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

/* ── Checkbox ─────────────────────────────────────────────────── */
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

/* ── Button Ambil SO ──────────────────────────────────────────── */
.btn-ambil-so {
  height: 22px;
  padding: 0 10px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-ambil-so:hover {
  background: var(--ds-primary-dark, #0369a1);
}

/* ── Combo Group ──────────────────────────────────────────────── */
.combo-group {
  display: flex;
  gap: 2px;
  flex: 1;
  max-width: 400px;
}

.combo-kode {
  width: 100px !important;
  max-width: 100px !important;
  flex: none !important;
}

.combo-nama {
  width: 200px !important;
  max-width: 200px !important;
  flex: none !important;
}

.disabled-bg {
  background: var(--ds-surface-inset, #E0E4EA) !important;
  color: var(--ds-text-muted, #8494A7) !important;
  cursor: not-allowed;
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

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

/* ── Cell Input ───────────────────────────────────────────────── */
.cell-search {
  display: flex;
  gap: 2px;
}

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.cell-inp {
  width: 100%;
  height: 20px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px;
  font-size: 11px;
  outline: none;
  text-align: right;
  background: white;
  box-sizing: border-box;
}

.cell-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.cell-inp.readonly-bg {
  cursor: default;
  text-align: left;
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

.cell-total {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ds-primary-dark, #0369a1);
}

.btn-del {
  background: none;
  border: none;
  color: var(--ds-text-muted, #8494A7);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 0;
}

.btn-del:hover {
  background: #FEE2E2;
  color: #dc2626;
}

/* ── Kalkulasi ────────────────────────────────────────────────── */
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
  margin-left: auto;
  font-size: 11px;
}

.calc-val-muted {
  color: var(--ds-text-muted, #8494A7);
  font-weight: 600;
}

.calc-total-row {
  border-top: 2px solid var(--ds-primary, #0284c7);
  padding-top: 8px;
  margin-top: 4px;
  width: 100%;
  justify-content: space-between;
}

.calc-lbl-total {
  font-size: 12px;
  font-weight: 800;
  color: var(--ds-primary-darker, #0c4a6e);
  width: auto;
}

.calc-val-total {
  font-size: 28px;
  font-weight: 900;
  color: var(--ds-primary, #0284c7);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

/* ── Ambil SO Search ──────────────────────────────────────────── */
.ambil-so-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.ambil-so-search-input {
  flex: 1;
  height: 26px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 11px;
  outline: none;
  background: white;
}

.ambil-so-search-input:focus {
  border-color: var(--ds-primary, #0284c7);
}

.ambil-so-table-wrap {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}

/* ── Modal ────────────────────────────────────────────────────── */
.modal-loading {
  padding: 20px;
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 12px;
}

.riwayat-harga-table-wrap {
  max-height: 320px;
  overflow-y: auto;
}

.modal-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.modal-tbl th {
  background: var(--ds-primary, #0284c7);
  color: white;
  font-weight: 700;
  padding: 5px 8px;
  text-align: left;
  white-space: nowrap;
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

/* ── Column Filter Buttons in Modal ── */
.modal-tbl th .th-inner {
  display: flex;
  align-items: center;
  gap: 4px;
}
.modal-tbl th .col-filter-btn {
  border: none;
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  padding: 1px 3px;
  display: inline-flex;
  align-items: center;
  border-radius: 2px;
  transition: background 0.15s;
}
.modal-tbl th .col-filter-btn:hover {
  background: rgba(255,255,255,0.3);
  color: white;
}
.modal-tbl th .col-filter-btn.active {
  background: rgba(255,255,255,0.35);
  color: white;
}

/* ── Modal Tambah Detail (checklist) ──────────────────────── */
.tb-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tb-search-input {
  flex: 1; height: 28px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: #fff;
}
.tb-search-input:focus { border-color: var(--ds-primary, #0284c7); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #0284c7); }
.tb-add-btn { border-radius: 0; text-transform: none; }

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .so-header-grid,
  .so-footer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .so-layout {
    padding: 4px;
    gap: 4px;
  }
  .so-groupbody {
    padding: 6px;
    gap: 4px;
  }
  .f-lbl {
    width: 70px;
    font-size: 10px;
  }
}

/* ── Disc Confirm Dialog ─────────────────────────────────────── */
.disc-confirm-card {
  overflow: hidden;
}

.disc-confirm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--ds-surface, #F0F3F8);
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  border-top: 3px solid var(--ds-warning, #0284c7);
}

.disc-confirm-icon {
  color: var(--ds-warning, #0284c7);
  flex-shrink: 0;
}

.disc-confirm-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-text, #0c4a6e);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.disc-confirm-body {
  padding: 16px 14px;
}

.disc-confirm-msg {
  font-size: 12px;
  line-height: 1.6;
  color: var(--ds-text-secondary, #5A6A7E);
  margin: 0;
}

.disc-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}

.disc-btn {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.disc-btn-cancel {
  background: white;
  color: var(--ds-text-secondary, #5A6A7E);
}

.disc-btn-cancel:hover {
  background: var(--ds-surface-inset, #E0E4EA);
}

.disc-btn-confirm {
  background: var(--ds-warning, #0284c7);
  color: white;
  border-color: #0369a1;
}

.disc-btn-confirm:hover {
  background: #0369a1;
}
</style>