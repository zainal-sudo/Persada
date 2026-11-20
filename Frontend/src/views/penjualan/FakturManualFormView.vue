<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconFileInvoice, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import { fakturManualFormApi, type FakturManualForm, type FakturManualDetail } from "@/api/penjualan/fakturManualFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const isLocked = ref(false);
const tanggalOld = ref("");  // guard tanggal beda bulan/tahun

const today = new Date().toISOString().slice(0, 10);

const form = ref<FakturManualForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  nomorSO: "",
  jthTempo: today,
  cusKode: "",
  cusNama: "",
  alamat: "",
  telp: "",
  memo: "",
  isTax: 1,
  discFakturPr: 0,
  discFaktur: 0,
  freight: 0,
  amount: 0,
  taxAmount: 0,
  top: 0,
  detail: [],
});

const doOptions = ref<any[]>([]);
const barangOptions = ref<any[]>([]);
const doLoading = ref(false);
const barangLoading = ref(false);

const showDOModal = ref(false);
const showBarangModal = ref(false);
const activeDetailIndex = ref(-1);

const getAngkaPPN = (tanggal: string) => {
  const t = new Date(tanggal);
  const cutoff = new Date(2022, 3, 1);
  return t >= cutoff ? 1.11 : 1.1;
};

const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum, d) => sum + Number(d.total || 0), 0);
});

const hitung = () => {
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
};

const initNomor = async () => {
  const cabang = authStore.userCabang || "01";
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  form.value.nomor = `${cabang}-FP.${yy}${mm}.`;
};

const searchSO = async (query: string) => {
  doLoading.value = true;
  try {
    doOptions.value = await fakturManualFormApi.searchSO(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SO.");
  } finally {
    doLoading.value = false;
  }
};

const selectSO = async (soItem: any) => {
  try {
    const data = await fakturManualFormApi.loadSO(soItem.nomor);
    form.value.nomorSO = data.nomorSO;
    form.value.cusKode = data.cusKode;
    form.value.cusNama = data.cusNama;
    form.value.alamat = data.alamat;
    form.value.telp = data.telp;
    form.value.isTax = data.isTax;
    form.value.discFakturPr = data.discFakturPr;
    form.value.discFaktur = data.discFaktur;

    // Nomor dari FP utama kalau ada
    if (data.nomorFP) {
      form.value.nomor = data.nomorFP;
    } else {
      await initNomor();
    }

    // Jth Tempo
    const topRes = await fakturManualFormApi.getTop(data.cusKode);
    const tgl = new Date(form.value.tanggal);
    tgl.setDate(tgl.getDate() + Number(topRes.top || 0));
    form.value.jthTempo = tgl.toISOString().split("T")[0];

    form.value.top = Number(topRes.top || 0);
    form.value.detail = data.detail;
    showDOModal.value = false;
    hitung();

    // Pola DOFormView: setelah detail terisi dari SO, fokus langsung ke
    // QTY baris pertama — user bisa langsung mengetik tanpa klik.
    if (form.value.detail.length > 0) {
      nextTick(() => fpmEnterEdit(0, "qty"));
    }

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat DO.");
  }
};

const searchBarang = async (query: string) => {
  barangLoading.value = true;
  try {
    barangOptions.value = await fakturManualFormApi.searchBarang(query || "");
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

  const d = form.value.detail[idx];
  d.brgKode = Number(brg.kode);
  d.brgNama = brg.nama;
  d.satuan = brg.satuan;
  d.harga = 0;
  d.discPr = 0;
  d.total = 0;

  showBarangModal.value = false;
  hitung();
};

// ── Tambah Baris (lookup barang) ────────────────────────────────────
const showTambahBarangModal = ref(false);
const tambahBarangItems = ref<any[]>([]);
const tambahBarangLoading = ref(false);
const tambahBarangSearch = ref("");
const selectedTambahBarang = ref<any[]>([]);

const isTambahBarangSelected = (kode: any) =>
  selectedTambahBarang.value.some(b => String(b.kode) === String(kode));

const toggleTambahBarang = (brg: any) => {
  const idx = selectedTambahBarang.value.findIndex(b => String(b.kode) === String(brg.kode));
  if (idx >= 0) {
    selectedTambahBarang.value.splice(idx, 1);
  } else {
    selectedTambahBarang.value.push(brg);
  }
};

const allTambahBarangChecked = computed(() =>
  tambahBarangItems.value.length > 0 &&
  tambahBarangItems.value.every(b => isTambahBarangSelected(b.kode))
);

const toggleAllTambahBarang = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahBarangItems.value) {
      if (!isTambahBarangSelected(brg.kode)) selectedTambahBarang.value.push(brg);
    }
  } else {
    const keys = new Set(tambahBarangItems.value.map(b => String(b.kode)));
    selectedTambahBarang.value = selectedTambahBarang.value.filter(b => !keys.has(String(b.kode)));
  }
};

const openTambahBarangModal = async () => {
  selectedTambahBarang.value = [];
  tambahBarangSearch.value = "";
  showTambahBarangModal.value = true;
  tambahBarangLoading.value = true;
  try {
    tambahBarangItems.value = await fakturManualFormApi.searchBarang("");
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
    tambahBarangItems.value = await fakturManualFormApi.searchBarang(query);
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
  for (const brg of selectedTambahBarang.value) {
    form.value.detail.push({
      no: form.value.detail.length + 1,
      brgKode: Number(brg.kode),
      brgNama: brg.nama,
      qty: 0,
      satuan: brg.satuan || "",
      idBatch: "",
      harga: 0,
      discPr: 0,
      total: 0,
      expired: "",
      kurang: 0,
      gudang: "",
    });
  }
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  showTambahBarangModal.value = false;
  hitung();
  // Fokus langsung ke QTY baris pertama yang baru ditambahkan (pola DOFormView).
  if (form.value.detail.length > firstRow) {
    nextTick(() => fpmEnterEdit(firstRow, "qty"));
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  hitung();
};

const updateRowTotal = (d: FakturManualDetail) => {
  d.total = d.qty * d.harga * (100 - d.discPr) / 100;
  hitung();
};

// ── Detail column widths (shared by thead & tbody so they stay aligned) ──
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: null },   // takes the remaining width
  { key: 'qty', width: 70 },
  { key: 'satuan', width: 50 },
  { key: 'idBatch', width: 80 },
  { key: 'harga', width: 100 },
  { key: 'discPr', width: 60 },
  { key: 'total', width: 100 },
  { key: 'expired', width: 80 },
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
const onQtyInput = (e: Event, d: FakturManualDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, '')) || 0);
  updateRowTotal(d);
};

const onHargaInput = (e: Event, d: FakturManualDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['harga-' + idx] = el.value;
  d.harga = parseInput(el.value);
  updateRowTotal(d);
};

const onDiscPrInput = (e: Event, d: FakturManualDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['discPr-' + idx] = el.value;
  d.discPr = parseInput(el.value);
  updateRowTotal(d);
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif FPM: sku (picker modal), nama, qty, idBatch, harga,
// discPr, expired (date) — mengikuti urutan visual kolom tabel.
const fpmCellId = (c: string, r: number) => `fpm-cell-${c}-${r}`;

const fpmTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(fpmCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`${c}-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const fpmGrid = useDetailGrid({
  cols: ["sku", "nama", "qty", "idBatch", "harga", "discPr", "expired"],
  rowCount: () => form.value.detail.length,
  cellId: fpmCellId,
  cellPrefix: "fpm-cell",
  onPicker: (r, c) => { if (c === "sku") openBarangModal(r); },
  typeEditCols: ["nama", "idBatch", "qty", "harga", "discPr"],
  onTypeEdit: fpmTypeEdit,
});

const {
  focusCell: fpmFocusCell,
  gridBlur: fpmGridBlur,
  onGridCellFocus: fpmOnGridFocus,
  setSelect: fpmSetSelect,
  enterEdit: fpmEnterEdit,
} = fpmGrid;

const isActiveCell = (r: number, c: string) =>
  fpmFocusCell.value?.r === r && fpmFocusCell.value?.c === c;

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

// ── onTanggalChange (paritas GAP-FPM-06 + GAP-FPM-14) ─────────────
const onTanggalChange = () => {
  // GAP-FPM-14: auto-update Jth Tempo = tanggal + top
  if (form.value.cusKode) {
    const tgl = new Date(form.value.tanggal);
    tgl.setDate(tgl.getDate() + Number(form.value.top || 0));
    form.value.jthTempo = tgl.toISOString().split("T")[0];
  }
  // GAP-FPM-06: guard tanggal beda bulan/tahun saat edit
  if (isEdit.value && tanggalOld.value) {
    const old = new Date(tanggalOld.value);
    const cur = new Date(form.value.tanggal);
    if (old.getFullYear() !== cur.getFullYear() || old.getMonth() !== cur.getMonth()) {
      toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun");
      form.value.tanggal = tanggalOld.value;
    }
  }
};

const onFreightInput = (e: Event) => {
  rawInputValues['freight'] = (e.target as HTMLInputElement).value;
  form.value.freight = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

// ── Lookup harga faktur lain (paritas clHargaPropertiesButtonClick) ──
const showHargaModal = ref(false);
const hargaHistoriItems = ref<any[]>([]);
const hargaHistoriLoading = ref(false);
const activeHargaDetailIdx = ref(-1);

const openHargaHistori = async (idx: number) => {
  const d = form.value.detail[idx];
  if (!d || !d.brgKode || !form.value.cusKode) {
    toast.warning("Pilih SKU dan Customer terlebih dahulu.");
    return;
  }
  activeHargaDetailIdx.value = idx;
  showHargaModal.value = true;
  hargaHistoriLoading.value = true;
  try {
    hargaHistoriItems.value = await fakturManualFormApi.getHargaHistori(
      d.brgKode, form.value.cusKode, form.value.nomor
    );
  } catch {
    hargaHistoriItems.value = [];
  } finally {
    hargaHistoriLoading.value = false;
  }
};

const selectHargaHistori = (item: any) => {
  const idx = activeHargaDetailIdx.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  form.value.detail[idx].harga = Number(item.Harga) || 0;
  form.value.detail[idx].discPr = Number(item.Disc) || 0;
  updateRowTotal(form.value.detail[idx]);
  showHargaModal.value = false;
};

const validateSave = () => {
  if (!form.value.cusKode) {
    toast.warning("Customer belum dipilih.");
    return;
  }
  if (!form.value.nomor.trim()) {
    toast.warning("Nomor faktur harus diisi.");
    return;
  }

  for (const d of form.value.detail) {
    if (d.brgKode === 0) {
      toast.warning(`SKU baris ${d.no} belum dipilih.`);
      return;
    }
  }

};

const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value || isLocked.value) return;
  isSaving.value = true;
  try {
    const res = await fakturManualFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await initNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await fakturManualFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
    tanggalOld.value = data.tanggal || "";
    isLocked.value = !!data.locked;
    if (isLocked.value) {
      toast.warning("Transaksi ini sudah ada pembayaran, tidak dapat diubah.");
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "fakturManualBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    nomorSO: "",
    jthTempo: today,
    cusKode: "",
    cusNama: "",
    alamat: "",
    telp: "",
    memo: "",
    isTax: 1,
    discFakturPr: 0,
    discFaktur: 0,
    freight: 0,
    amount: 0,
    taxAmount: 0,
    top: 0,
    detail: [],
  };
  initNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Faktur Penjualan Manual' : 'Tambah Faktur Penjualan Manual Baru'"
    :icon="IconFileInvoice"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :disabled="isLocked"
    @save-action="confirmSave"
  >
    <div class="fpm-layout">
      <!-- ═══ HEADER (2 kolom sejajar) ═══ -->
      <div class="fpm-header-grid">
        <!-- Customer Info -->
        <fieldset class="fpm-groupbox">
          <legend class="fpm-legend">Informasi Customer</legend>
          <div class="fpm-groupbody">
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
        <fieldset class="fpm-groupbox">
          <legend class="fpm-legend">Informasi Faktur</legend>
          <div class="fpm-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input v-model="form.nomor" class="f-inp" />
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
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" @change="hitung" />
                Pajak
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="fpm-groupbox fpm-detail-group">
        <legend class="fpm-legend">Detail Barang</legend>
        <div class="fpm-detail-toolbar">
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
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('satuan')" class="tc">Sat</th>
                  <th :style="detailColWidthStyle('idBatch')">ID Batch</th>
                  <th :style="detailColWidthStyle('harga')" class="tr">Harga</th>
                  <th :style="detailColWidthStyle('discPr')" class="tr">Disc%</th>
                  <th :style="detailColWidthStyle('total')" class="tr">Total</th>
                  <th :style="detailColWidthStyle('expired')" class="tc">Expired</th>
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
                    <div class="cell-search" :id="'fpm-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.brgKode" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" @click="openBarangModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td :style="detailColWidthStyle('nama')"><input v-model="d.brgNama" class="cell-inp" :id="fpmCellId('nama', idx)" :class="{ 'cell-active': isActiveCell(idx, 'nama') }" @focus="fpmOnGridFocus('nama', idx)" @blur="fpmGridBlur()" /></td>
                  <td :style="detailColWidthStyle('qty')"><input type="text" inputmode="numeric" class="cell-inp tr" :id="fpmCellId('qty', idx)" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="fpmOnGridFocus('qty', idx); startEdit('qty-' + idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); fpmGridBlur()" /></td>
                  <td :style="detailColWidthStyle('satuan')"><input v-model="d.satuan" class="cell-inp tc readonly-bg" readonly /></td>
                  <td :style="detailColWidthStyle('idBatch')"><input v-model="d.idBatch" class="cell-inp" :id="fpmCellId('idBatch', idx)" :class="{ 'cell-active': isActiveCell(idx, 'idBatch') }" @focus="fpmOnGridFocus('idBatch', idx)" @blur="fpmGridBlur()" /></td>
                  <td :style="detailColWidthStyle('harga')">
                    <div class="cell-search">
                      <input type="text" inputmode="decimal" class="cell-inp tr" :id="fpmCellId('harga', idx)" :class="{ 'cell-active': isActiveCell(idx, 'harga') }" :value="getInputValue('harga-' + idx, d.harga)" @focus="fpmOnGridFocus('harga', idx); startEdit('harga-' + idx, $event, d.harga)" @input="onHargaInput($event, d, idx)" @blur="endEdit('harga-' + idx, $event, d.harga); fpmGridBlur()" />
                      <button class="cell-btn" type="button" title="Lihat harga faktur lain" @click="openHargaHistori(idx)">
                        <IconSearch :size="9" />
                      </button>
                    </div>
                  </td>
                  <td :style="detailColWidthStyle('discPr')"><input type="text" inputmode="decimal" class="cell-inp tr" :id="fpmCellId('discPr', idx)" :class="{ 'cell-active': isActiveCell(idx, 'discPr') }" :value="getInputValue('discPr-' + idx, d.discPr)" @focus="fpmOnGridFocus('discPr', idx); startEdit('discPr-' + idx, $event, d.discPr)" @input="onDiscPrInput($event, d, idx)" @blur="endEdit('discPr-' + idx, $event, d.discPr); fpmGridBlur()" /></td>
                  <td class="tr bold" :style="detailColWidthStyle('total')">{{ fmt(d.total) }}</td>
                  <td :style="detailColWidthStyle('expired')"><DsDatePicker v-model="d.expired" variant="cell" :id="fpmCellId('expired', idx)" @focus="fpmOnGridFocus('expired', idx)" @blur="fpmGridBlur()" /></td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" @click="removeRow(idx)">✕</button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="11" class="empty-state">
                    Pilih SO atau tambah barang manual.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <!-- ═══ FOOTER ═══ -->
      <div class="fpm-footer">
        <div class="fpm-footer-left">
          <div class="f-row">
            <label class="f-lbl">Memo</label>
            <textarea v-model="form.memo" class="f-txa" rows="5"></textarea>
          </div>
        </div>
        <div class="fpm-footer-right">
          <div class="calc-box">
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
            <div class="calc-row">
              <label>Freight</label>
              <input
                type="text"
                inputmode="decimal"
                class="calc-inp"
                :value="getInputValue('freight', form.freight)"
                @focus="startEdit('freight', $event, form.freight)"
                @input="onFreightInput"
                @blur="endEdit('freight', $event, form.freight)"
              />
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
  <!-- Modal Tambah Baris: lookup barang -->
  <v-dialog v-model="showTambahBarangModal" max-width="700" scrollable>
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
                <th style="width: 100px">Kode</th>
                <th>Nama Barang</th>
                <th style="width: 70px" class="tc">Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in tambahBarangItems" :key="brg.kode" class="modal-row" @click="toggleTambahBarang(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahBarangSelected(brg.kode)" @change="toggleTambahBarang(brg)" />
                </td>
                <td class="mono">{{ brg.kode }}</td>
                <td>{{ brg.nama }}</td>
                <td class="tc">{{ brg.satuan }}</td>
              </tr>
              <tr v-if="tambahBarangItems.length === 0">
                <td colspan="4" class="empty-state">Tidak ada barang yang cocok.</td>
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
    search-placeholder="Cari SO..."
    @select="selectSO"
    @search="searchSO"
  />

  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '70px', align: 'center' },
    ]"
    :items="barangOptions"
    :loading="barangLoading"
    :server-search="true"
    search-placeholder="Cari barang..."
    @select="selectBarang"
    @search="searchBarang"
  />

  <!-- Modal Harga Histori (paritas frmbantuan Delphi) -->
  <v-dialog v-model="showHargaModal" max-width="680" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3 tb-title">
        Riwayat Harga Faktur Lain
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="hargaHistoriLoading" class="modal-loading">Memuat...</div>
        <div v-else class="tb-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th style="min-width: 160px">Nama Barang</th>
                <th style="width: 100px" class="tr">Harga</th>
                <th style="width: 60px" class="tr">Disc%</th>
                <th style="width: 90px" class="tc">Expired</th>
                <th style="width: 90px" class="tc">Tanggal</th>
                <th style="width: 60px" class="tr">Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in hargaHistoriItems" :key="idx" class="modal-row" @click="selectHargaHistori(item)">
                <td>{{ item.Nama }}</td>
                <td class="tr">{{ fmt(Number(item.Harga)) }}</td>
                <td class="tr">{{ item.Disc }}</td>
                <td class="tc">{{ item.Expired }}</td>
                <td class="tc">{{ item.Tanggal }}</td>
                <td class="tr">{{ item.Qty }}</td>
              </tr>
              <tr v-if="hargaHistoriItems.length === 0">
                <td colspan="6" class="empty-state">Tidak ada riwayat harga.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2 tb-actions">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showHargaModal = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   FAKTUR MANUAL — Classic Desktop Layout (matches SO/DO/FP/BayarCustomer)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.fpm-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.fpm-header-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.fpm-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.fpm-legend {
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

.fpm-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.fpm-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fpm-detail-toolbar {
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
.fpm-footer {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  padding: 8px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}

.fpm-footer-left,
.fpm-footer-right {
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
</style>