<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconTruckDelivery, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import { doFormApi, type DOForm, type DODetail } from "@/api/penjualan/doFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDoPrint } from "@/composables/useDoPrint";
import { useDetailGrid } from "@/composables/useDetailGrid";

import DsDatePicker from "@/components/DsDatePicker.vue";
const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  PrinterDialog,
  PrintPreviewDialog,
} = useDoPrint();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<DOForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  nomorSO: "",
  cusKode: "",
  cusNama: "",
  shipAddress: "",
  memo: "",
  gdgKode: "",
  gdgNama: "",
  driver: "",
  driverNama: "",
  isEcer: 0,
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const gudangOptions = ref<any[]>([]);
const driverOptions = ref<any[]>([]);
const soOptions = ref<any[]>([]);

// ── Modal State ──────────────────────────────────────────────────────
const showSOModal = ref(false);
const showGudangModal = ref(false);
const showDriverModal = ref(false);
const showStokModal = ref(false);
const activeDetailIndex = ref(-1);
const isAddRowMode = ref(false);

// ── Stok Modal ───────────────────────────────────────────────────────
const stokItems = ref<any[]>([]);
const stokLoading = ref(false);
const stokSearch = ref("");

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await doFormApi.getNomor(form.value.tanggal, 1);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor DO.");
  }
};

// ── Load Options ─────────────────────────────────────────────────────
const loadOptions = async () => {
  try {
    const [gudang, driver] = await Promise.all([
      doFormApi.getGudang(""),
      doFormApi.getDriver(),
    ]);
    gudangOptions.value = gudang;
    driverOptions.value = driver;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data.");
  }
};

// ── Search SO ────────────────────────────────────────────────────────
const searchSO = async (query: string) => {
  try {
    soOptions.value = await doFormApi.searchSO(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SO.");
  }
};

const selectSO = async (so: any) => {
  try {
    const data = await doFormApi.loadSO(so.nomor);
    form.value.nomorSO = data.nomorSO;
    form.value.cusKode = data.cusKode;
    form.value.cusNama = data.cusNama;
    form.value.shipAddress = data.shipAddress;
    form.value.isEcer = data.isEcer;

    // Generate nomor DO sesuai isTax dari SO
    const res = await doFormApi.getNomor(form.value.tanggal, data.isTax);
    form.value.nomor = res.nomor;

    // Clear detail
    form.value.detail = [];

    showSOModal.value = false;

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat SO.");
  }
};

// ── Search Gudang ────────────────────────────────────────────────────
const searchGudang = async (query: string) => {
  try {
    gudangOptions.value = await doFormApi.getGudang(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari gudang.");
  }
};

const selectGudang = (g: any) => {
  form.value.gdgKode = g.kode;
  form.value.gdgNama = g.nama;
  showGudangModal.value = false;
};

// ── Select Driver ────────────────────────────────────────────────────
const selectDriver = (d: any) => {
  form.value.driver = d.kode;
  form.value.driverNama = d.nama;
  showDriverModal.value = false;
};

// ── Watch stok modal close ──
watch(showStokModal, (val) => {
  if (!val && isAddRowMode.value) {
    isAddRowMode.value = false;
  }
});

// ── Search Stok ──────────────────────────────────────────────────────
const openStokModal = async (idx: number) => {
  if (!form.value.gdgKode) {
    toast.warning("Pilih gudang dahulu.");
    return;
  }
  if (!form.value.nomorSO) {
    toast.warning("Pilih nomor SO dahulu.");
    return;
  }
  activeDetailIndex.value = idx;
  stokLoading.value = true;
  showStokModal.value = true;
  try {
    stokItems.value = await doFormApi.searchStok(
      form.value.nomorSO,
      form.value.gdgKode,
      form.value.nomor || ""
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari stok.");
  } finally {
    stokLoading.value = false;
  }
};

const selectStok = async (item: any) => {
  try {
    const expiredDate = item.expired || "";

    const detail = await doFormApi.getDetailStok(
      item.sku,
      expiredDate,
      form.value.nomorSO,
      form.value.gdgKode,
      isEdit.value
    );

    if (!detail) {
      toast.warning("Stok tidak ditemukan.");
      return;
    }

    // Paritas Delphi bantuansku: tolak SKU + expired yang sama dengan baris lain
    const activeIdx = isAddRowMode.value ? -1 : activeDetailIndex.value;
    const dupIdx = form.value.detail.findIndex(
      (x, i) =>
        i !== activeIdx &&
        x.brgKode === Number(detail.sku) &&
        (x.expired || "") === (detail.expired || "") &&
        x.gudang === form.value.gdgKode
    );
    if (dupIdx >= 0) {
      toast.warning(`Sku dan expired ada yang sama dengan baris ${dupIdx + 1}.`);
      return;
    }

    const newRow: DODetail = {
      no: 0,
      brgKode: Number(detail.sku),
      brgNama: detail.namaBarang,
      idBatch: detail.idBatch || "",
      qty: 0,
      satuan: detail.satuan,
      sudah: Number(detail.sudah) || 0,
      kurang: Number(detail.kurang) || 0,
      expired: detail.expired || "",
      closed: 0,
      gudang: form.value.gdgKode,
      stok: Number(detail.stok) || 0,
      isExpired: Number(detail.isExpired) || 0,
    };

    if (isAddRowMode.value) {
      // Mode tambah baris baru
      newRow.no = form.value.detail.length + 1;
      form.value.detail.push(newRow);
      isAddRowMode.value = false;
    } else {
      // Mode edit baris yang sudah ada
      const idx = activeDetailIndex.value;
      if (idx < 0 || !form.value.detail[idx]) return;

      newRow.no = idx + 1;
      form.value.detail[idx] = newRow;
    }

    showStokModal.value = false;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat detail stok.");
  }
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Tambah Detail (dialog checklist barang — pola Retur Penjualan) ──
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

const brgKey = (b: any) => `${String(b.sku)}|${b.expired || ""}`;

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
    String(b.sku).toLowerCase().includes(q) ||
    String(b.namaBarang || "").toLowerCase().includes(q)
  );
});

// Tambah satu baris (reuse logika getDetailStok + dup-guard selectStok).
const addStokRow = async (item: any): Promise<boolean> => {
  try {
    const detail = await doFormApi.getDetailStok(
      item.sku,
      item.expired || "",
      form.value.nomorSO,
      form.value.gdgKode,
      isEdit.value
    );
    if (!detail) {
      toast.warning(`Stok ${item.sku} tidak ditemukan.`);
      return false;
    }

    const dupIdx = form.value.detail.findIndex(
      (x) =>
        x.brgKode === Number(detail.sku) &&
        (x.expired || "") === (detail.expired || "") &&
        x.gudang === form.value.gdgKode
    );
    if (dupIdx >= 0) return false;

    form.value.detail.push({
      no: form.value.detail.length + 1,
      brgKode: Number(detail.sku),
      brgNama: detail.namaBarang,
      idBatch: detail.idBatch || "",
      qty: 0,
      satuan: detail.satuan,
      sudah: Number(detail.sudah) || 0,
      kurang: Number(detail.kurang) || 0,
      expired: detail.expired || "",
      closed: 0,
      gudang: form.value.gdgKode,
      stok: Number(detail.stok) || 0,
      isExpired: Number(detail.isExpired) || 0,
    });
    return true;
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal memuat detail stok.");
    return false;
  }
};

const openTambahDetail = async () => {
  if (!form.value.gdgKode) {
    toast.warning("Pilih gudang dahulu.");
    return;
  }
  if (!form.value.nomorSO) {
    toast.warning("Pilih nomor SO dahulu.");
    return;
  }
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await doFormApi.searchStok(
      form.value.nomorSO,
      form.value.gdgKode,
      form.value.nomor || ""
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat stok.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Pencarian server-side (debounce) — barang di luar batch awal tetap ketemu.
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    if (!form.value.nomorSO || !form.value.gdgKode) return;
    tambahDetailLoading.value = true;
    try {
      tambahDetailItems.value = await doFormApi.searchStok(
        form.value.nomorSO,
        form.value.gdgKode,
        form.value.nomor || "",
        query
      );
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal mencari stok.");
    } finally {
      tambahDetailLoading.value = false;
    }
  }, 250);
};

const addSelectedTambahDetail = async () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    if (await addStokRow(brg)) added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail / stok tidak ditemukan.");
  showTambahDetailModal.value = false;
  // Fokus langsung ke QTY baris pertama yang baru ditambahkan (mode edit).
  if (added > 0) {
    nextTick(() => enterEdit(firstRow, "qty"));
  }
};

// ── Navigasi grid detail (ala Excel, pointer) ──────────────────────────
// Dipakai useDetailGrid → perilaku keyboard (Enter/panah/Space/type-to-edit)
// identik implementasi lama tapi reusable untuk semua form.
const colToElId = (c: string, r: number) =>
  c === "sku" ? `do-cell-sku-${r}` : `do-cell-${c}-${r}`;

// "Type-to-edit" khas DO: qty menulis rawInputValues dulu agar Vue
// tidak menimpa DOM saat re-render.
const doTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(colToElId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  if (c === "qty") rawInputValues[`qty-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const grid = useDetailGrid({
  cols: ["sku", "qty", "closed"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "do-cell",
  onPicker: (r, c) => {
    if (c === "sku") openStokModal(r);
  },
  isToggle: (c) => c === "closed",
  onToggle: (r) => {
    const d = form.value.detail[r];
    if (d) d.closed = Number(d.closed) === 1 ? 0 : 1;
  },
  typeEditCols: ["qty"],
  onTypeEdit: doTypeEdit,
});

const {
  focusCell,
  editMode,
  gridBlur,
  onGridCellFocus,
  setSelect,
  enterEdit,
  commitEdit,
  moveFocus,
} = grid;

const isActiveCell = (r: number, c: string) =>
  focusCell.value?.r === r && focusCell.value?.c === c;

// ── Formatting ───────────────────────────────────────────────────────
const formatCurrency = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
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

const getInputValue = (key: string, modelValue: number, decimals = 0) => {
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

// QTY: saat nilai 0 dan masuk edit → kosongkan dulu (biar langsung ketik, ala Excel).
const startQtyEdit = (idx: number, e: Event, qty: number) => {
  const key = `qty-${idx}`;
  const val = qty === 0 ? "" : String(qty);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
  onGridCellFocus("qty", idx);
};

const endEdit = (key: string, e: Event, raw: number, decimals = 0) => {
  // Hapus raw value dari store
  delete rawInputValues[key];
  // Format DOM value
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

// ── Input Handlers (saat ketik — update model + raw store) ───────
const onQtyInput = (e: Event, d: DODetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, '')) || 0);
};

// ── Validasi ─────────────────────────────────────────────────────────
// Paritas Delphi clQTYPropertiesValidate:
// 1) qty total baris SKU sama + baris lain tidak boleh melebihi jumlah "kurang"
//    semua baris SKU yang sama (aqtykurang = jumlah kurang per SKU).
// 2) qty per baris tidak boleh melebihi stok gudang per SKU+expired.
const validateQty = async (d: DODetail): Promise<boolean> => {
  if (Number(d.qty) <= 0) return true;

  // Cek qty melebihi sisa SO — jumlah kurang SEMUA baris SKU yang sama
  const totalQtySameSKU = form.value.detail
    .filter(x => x.brgKode === d.brgKode)
    .reduce((sum, x) => sum + Number(x.qty), 0);
  const totalKurangSameSKU = form.value.detail
    .filter(x => x.brgKode === d.brgKode)
    .reduce((sum, x) => sum + Number(x.kurang), 0);

  if (totalQtySameSKU > totalKurangSameSKU) {
    toast.warning(`Qty melebihi qty kurang (${totalKurangSameSKU}).`);
    return false;
  }

  // Cek qty melebihi stok gudang (getstok Delphi: per gudang + expired, exclude DO ini)
  try {
    const stok = await doFormApi.getStok(
      d.brgKode,
      d.expired || "",
      form.value.gdgKode,
      form.value.nomor || ""
    );
    if (Number(d.qty) > Number(stok)) {
      toast.warning("Qty melebihi stok gudang.");
      return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
    toast.error("Gagal memeriksa stok gudang.");
    return false;
  }

  return true;
};

const validateSave = async (): Promise<boolean> => {
  if (!form.value.cusKode) {
    toast.warning("Customer belum dipilih.");
    return false;
  }
  if (!form.value.nomorSO) {
    toast.warning("Nomor SO belum dipilih.");
    return false;
  }

  for (const d of form.value.detail) {
    if (!d.gudang) {
      toast.warning(`Gudang baris ${d.no} belum dipilih.`);
      return false;
    }
    if (d.brgKode === 0) {
      toast.warning(`SKU baris ${d.no} belum dipilih.`);
      return false;
    }
    // Paritas Delphi cekdata + getstatusexpired: expired wajib hanya
    // untuk barang yang memang di-set perlu expired (brg_isexpired).
    if (Number(d.qty) > 0 && !d.expired && (d.isExpired ?? 0) === 1) {
      toast.warning(`Expired baris ${d.no} belum diisi.`);
      return false;
    }
    if (!(await validateQty(d))) return false;
  }

  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await doFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan DO.");
  } finally {
    isSaving.value = false;
  }
};

// ── Simpan & Cetak (paritas cxButton3 Delphi) ───────────────────────
// Simpan lalu langsung tampilkan preview cetak Surat Jalan.
const confirmSavePrint = async () => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await doFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave("new", nomor);
    await loadAndPreview(nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan DO.");
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
    const data = await doFormApi.getDetailForm(decodeURIComponent(nomor));

    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
      nomorSO: data.nomorSO || "",
      tanggal: data.tanggal || today,
      cusKode: data.cusKode || "",
      cusNama: data.cusNama || "",
      shipAddress: data.shipAddress || "",
      memo: data.memo || "",
      gdgKode: data.gdgKode || "",
      gdgNama: data.gdgNama || "",
      driver: data.driver || "",
      driverNama: data.driverNama || "",
      isEcer: data.isEcer || 0,
      detail: data.detail || [],
    };
    // do_driver menyimpan kode; tampilkan namanya (fallback ke kode bila tak dikenal).
    if (form.value.driver && !form.value.driverNama) {
      form.value.driverNama =
        driverOptions.value.find((x: any) => x.kode === form.value.driver)?.nama || form.value.driver;
    }
    tanggalOld.value = form.value.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data DO.");
    router.push({ name: "doBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

// ── Guard tanggal edit (paritas Delphi dtTanggalChange) ──────────────
// Nomor DO mengandung yymm (CABANG-DO.yymm.NNNN) — di mode edit, tanggal
// tidak boleh pindah bulan/tahun. Server memvalidasi ulang saat save.
const tanggalOld = ref("");
watch(
  () => form.value.tanggal,
  (nv) => {
    if (!isEdit.value || !form.value.nomor || !nv) return;
    const yy = nv.slice(2, 4);
    const mm = nv.slice(5, 7);
    const prefix = form.value.nomor.slice(0, 6) + yy + mm + ".";
    if (prefix !== form.value.nomor.slice(0, 11)) {
      toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun.");
      form.value.tanggal = tanggalOld.value || nv;
    } else {
      tanggalOld.value = nv;
    }
  }
);

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    nomorSO: "",
    cusKode: "",
    cusNama: "",
    shipAddress: "",
    memo: "",
    gdgKode: "",
    gdgNama: "",
    driver: "",
    driverNama: "",
    isEcer: 0,
    detail: [],
  };
  loadNomor();
};

// ── Detail table column widths — used by both header and body ───────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 65 },
  { key: 'nama', width: 330 },
  { key: 'idBatch', width: 70 },
  { key: 'qty', width: 60 },
  { key: 'satuan', width: 60 },
  { key: 'sudah', width: 70 },
  { key: 'kurang', width: 70 },
  { key: 'stok', width: 70 },
  { key: 'expired', width: 85 },
  { key: 'closed', width: 60 },
  { key: 'gudang', width: 65 },
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
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Delivery Order' : 'Tambah Delivery Order Baru'"
    :icon="IconTruckDelivery"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :show-save-print="true"
    @save-action="confirmSave"
    @save-print="confirmSavePrint"
  >
    <div class="do-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="do-header-grid">
        <!-- SO & Customer Info -->
        <fieldset class="do-groupbox">
          <legend class="do-legend">Informasi SO & Customer</legend>
          <div class="do-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor SO</label>
              <div class="search-group">
                <input :value="form.nomorSO" class="f-inp readonly-bg" readonly placeholder="Pilih SO..." />
                <button class="btn-search" type="button" @click="showSOModal = true; searchSO('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Customer</label>
              <input :value="form.cusNama" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Ship Address</label>
              <input v-model="form.shipAddress" class="f-inp" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Gudang</label>
              <div class="search-group">
                <input :value="form.gdgKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.gdgNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Gudang..." />
                <button class="btn-search" type="button" @click="showGudangModal = true; searchGudang('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="do-groupbox">
          <legend class="do-legend">Informasi Order</legend>
          <div class="do-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Driver</label>
              <div class="search-group">
                <input :value="form.driverNama" class="f-inp readonly-bg" readonly placeholder="Pilih Driver..." />
                <button class="btn-search" type="button" @click="showDriverModal = true">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isEcer" type="checkbox" :true-value="1" :false-value="0" disabled />
                Eceran
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="do-groupbox do-detail-group">
        <legend class="do-legend">Detail Barang</legend>
        <div class="do-detail-actions">
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
                  <th :style="detailColWidthStyle('idBatch')">Id Batch</th>
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('satuan')" class="tc">Satuan</th>
                  <th :style="detailColWidthStyle('sudah')" class="tr">Sudah</th>
                  <th :style="detailColWidthStyle('kurang')" class="tr">Kurang</th>
                  <th :style="detailColWidthStyle('stok')" class="tr">Stok</th>
                  <th :style="detailColWidthStyle('expired')" class="tc">Expired</th>
                  <th :style="detailColWidthStyle('closed')" class="tc">Closed</th>
                  <th :style="detailColWidthStyle('gudang')">Gudang</th>
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
                    <div class="cell-search" :id="'do-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.brgKode" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" title="Cari stok" @click="openStokModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="cell-muted" :style="detailColWidthStyle('nama')">{{ d.brgNama }}</td>
                  <td class="cell-muted" :style="detailColWidthStyle('idBatch')">{{ d.idBatch || '-' }}</td>
                  <td :style="detailColWidthStyle('qty')"><input type="text" inputmode="numeric" class="cell-inp tr" :id="'do-cell-qty-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="startQtyEdit(idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); validateQty(d); gridBlur()" /></td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('satuan')">{{ d.satuan }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('sudah')">{{ fmtQty(d.sudah) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('kurang')">{{ fmtQty(d.kurang) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('stok')">{{ fmtQty(d.stok) }}</td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('expired')">{{ d.expired || '-' }}</td>
                  <td class="tc" :style="detailColWidthStyle('closed')" :class="{ 'cell-active': isActiveCell(idx, 'closed') }">
                    <input :id="'do-cell-closed-' + idx" v-model="d.closed" type="checkbox" :true-value="1" :false-value="0" />
                  </td>
                  <td class="cell-text" :style="detailColWidthStyle('gudang')">{{ d.gudang }}</td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="13" class="empty-state">
                    Belum ada barang. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <!-- ═══ FOOTER ═══ -->
      <div class="do-footer-area">
        <fieldset class="do-groupbox">
          <legend class="do-legend">Memo</legend>
          <div class="do-groupbody">
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="5"></textarea>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </BaseForm>

  <!-- ═══ MODALS ═══ -->
  <SearchModal
    v-model="showSOModal"
    title="Pilih Nomor SO"
    :columns="[
      { key: 'nomor', title: 'Nomor SO', width: '170px' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
      { key: 'customer', title: 'Customer' },
    ]"
    :items="soOptions"
    :server-search="true"
    search-placeholder="Cari nomor SO atau customer..."
    @select="selectSO"
    @search="searchSO"
  />

  <SearchModal
    v-model="showGudangModal"
    title="Pilih Gudang"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Gudang' },
    ]"
    :items="gudangOptions"
    :server-search="true"
    search-placeholder="Cari gudang..."
    @select="selectGudang"
    @search="searchGudang"
  />

  <SearchModal
    v-model="showDriverModal"
    title="Pilih Driver"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama' },
    ]"
    :items="driverOptions"
    search-placeholder="Cari driver..."
    @select="selectDriver"
  />

  <!-- ═══ MODAL TAMBAH DETAIL (checklist barang — pola Retur Penjualan) ═══ -->
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
                <th style="width: 80px">SKU</th>
                <th style="width: 220px">Nama Barang</th>
                <th style="width: 90px">Id Batch</th>
                <th style="width: 80px" class="tr">Stok</th>
                <th style="width: 80px" class="tr">Kurang</th>
                <th style="width: 100px" class="tc">Expired</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in filteredTambahDetailItems" :key="brg.sku + brg.expired" class="modal-row" @click="toggleTambahDetail(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.sku }}</td>
                <td>{{ brg.namaBarang }}</td>
                <td>{{ brg.idBatch || '-' }}</td>
                <td class="tr">{{ fmtQty(brg.stok) }}</td>
                <td class="tr">{{ fmtQty(brg.kurang) }}</td>
                <td class="tc">{{ brg.expired || '-' }}</td>
              </tr>
              <tr v-if="filteredTambahDetailItems.length === 0">
                <td colspan="7" class="empty-state">Tidak ada barang yang cocok.</td>
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

  <v-dialog v-model="showStokModal" max-width="800" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Pilih Stok Barang
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="stokLoading" class="modal-loading">Memuat...</div>
        <table v-else class="modal-tbl">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nama Barang</th>
              <th>Id Batch</th>
              <th>Expired</th>
              <th class="tr">Stok</th>
              <th>Satuan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in stokItems" :key="item.sku + item.expired" class="modal-row" @click="selectStok(item)">
              <td class="mono">{{ item.sku }}</td>
              <td>{{ item.namaBarang }}</td>
              <td>{{ item.idBatch || '-' }}</td>
              <td class="tc">{{ item.expired || '-' }}</td>
              <td class="tr">{{ fmtQty(item.stok) }}</td>
              <td class="tc">{{ item.satuan }}</td>
            </tr>
            <tr v-if="stokItems.length === 0">
              <td colspan="6" class="empty-state">Tidak ada stok.</td>
            </tr>
          </tbody>
        </table>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showStokModal = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Printer Dialog (Simpan & Cetak) ── -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />

  <!-- ── Print Preview Dialog (Simpan & Cetak) ── -->
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    title="Preview Surat Jalan (DO)"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   DO FORM — Classic Desktop Layout (matches SOFormView)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.do-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
  background: #FDFDFE;
}

.do-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.do-footer-area {
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.do-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.do-legend {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  background: #FDFDFE;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start;
  line-height: 1.4;
}

.do-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.do-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.do-detail-group .do-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.do-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: #F7FAFC;
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
  width: 95px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #000000;
}

/* ── Input (sunken desktop style) ─────────────────────────────── */
.f-inp {
  flex: 1;
  max-width: 400px;
  height: 28px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
  background: white;
  color: #000000;
}

.f-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.readonly-bg {
  background: #F0F2F6;
  color: #000000;
  font-weight: 500;
  border-color: #CBD2DA;
}

.f-txa {
  flex: 1;
  max-width: 400px;
  min-height: 60px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 4px 5px;
  font-size: 15px;
  font-weight: 500;
  color: #000000;
  outline: none;
  resize: vertical;
  font-family: inherit;
  background: white;
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
  font-size: 13px;
  font-weight: 600;
  color: #000000;
  cursor: pointer;
  user-select: none;
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 12px;
  height: 12px;
  margin: 0;
}

.check-lbl input:disabled {
  opacity: 0.5;
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
  font-size: 13px;
  font-weight: 600;
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
  font-size: 12px;
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
  color: #111827;
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
  color: #111827;
  font-weight: 600;
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
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px;
  font-size: 15px;
  font-weight: 600;
  outline: none;
  background: white;
  color: #111827;
  box-sizing: border-box;
}

.cell-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.cell-inp.readonly-bg {
  cursor: default;
  font-weight: 400;
}

.cell-btn {
  height: 24px;
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

/* ── Modal ────────────────────────────────────────────────────── */
.modal-loading {
  padding: 20px;
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 12px;
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

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .do-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .do-layout {
    padding: 4px;
    gap: 4px;
  }
  .do-groupbody {
    padding: 6px;
    gap: 4px;
  }
  .f-lbl {
    width: 85px;
    font-size: 11px;
  }
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
</style>
