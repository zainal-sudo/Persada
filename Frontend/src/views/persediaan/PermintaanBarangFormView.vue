<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconClipboardText, IconSearch, IconPlus, IconTrash, IconFileUpload } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  permintaanBarangFormApi,
  type PermintaanBarangForm,
  type PermintaanBarangDetail,
} from "@/api/persediaan/permintaanBarangFormApi";

const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const { handlePostSave } = useAfterSave({ onReset: () => resetForm() });

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<PermintaanBarangForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  memo: "",
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const skuOptions = ref<any[]>([]);
const skuLoading = ref(false);
const pbOptions = ref<{ nomor: string; tanggal: string }[]>([]);

// ── Modal State ──────────────────────────────────────────────────────
const showSKUModal = ref(false);
const showPBModal = ref(false);
const activeDetailIndex = ref(-1);
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadMaxNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await permintaanBarangFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
    tanggalOld.value = form.value.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data permintaan barang.");
  } finally {
    isLoading.value = false;
  }
};

// Paritas Delphi getmaxkode: prefix KODE cabang, tanpa fallback.
const loadMaxNomor = async () => {
  try {
    form.value.nomor = await permintaanBarangFormApi.getMaxNomor(
      form.value.tanggal,
      authStore.cabangKode
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor permintaan.");
  }
};

// ── Guard tanggal edit beda bulan/tahun (paritas dtTanggalChange) ────
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

// ── Search SKU ───────────────────────────────────────────────────────
const searchSKU = async (query: string) => {
  skuLoading.value = true;
  try {
    skuOptions.value = await permintaanBarangFormApi.searchSKU(query || "", form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SKU.");
  } finally {
    skuLoading.value = false;
  }
};

const fillSKUStats = async (d: PermintaanBarangDetail, sku: string) => {
  try {
    const detail = await permintaanBarangFormApi.getDetailSKU(sku, form.value.nomor);
    d.namaBarang = detail.namaBarang;
    d.satuan = detail.satuan;
    d.mingguLalu = detail.qtyPending;
    d.realisasiIn = detail.realisasiIn;
    d.sisa = detail.sisa;
    d.qty = detail.qtyPending;
    d.stokNow = detail.stokNow;
    d.avgSale = detail.avgSale;
    d.keterangan = detail.keterangan;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
  }
};

const openSKUModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showSKUModal.value = true;
  searchSKU("");
};

const selectSKU = async (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  const duplicate = form.value.detail.find(
    (d, i) => i !== idx && String(d.sku) === String(item.sku) && item.sku !== ""
  );
  if (duplicate) {
    toast.warning(`SKU ada yang sama dengan baris lain.`);
    return;
  }

  const d = form.value.detail[idx];
  d.sku = item.sku;
  await fillSKUStats(d, item.sku);
  showSKUModal.value = false;
  nextTick(() => enterEdit(idx, "qty"));
};

// ── Tambah Detail (checklist barang master) — pola DO ────────────────
const isTambahDetailSelected = (sku: any) =>
  selectedTambahDetail.value.some((b) => String(b.sku) === String(sku));

const toggleTambahDetail = (brg: any) => {
  const idx = selectedTambahDetail.value.findIndex((b) => String(b.sku) === String(brg.sku));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(brg);
};

const allTambahDetailChecked = computed(() =>
  tambahDetailItems.value.length > 0 &&
  tambahDetailItems.value.every((b) => isTambahDetailSelected(b.sku))
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahDetailItems.value) {
      if (!isTambahDetailSelected(brg.sku)) selectedTambahDetail.value.push(brg);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((b) => String(b.sku)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter((b) => !keys.has(String(b.sku)));
  }
};

const openTambahDetail = async () => {
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await permintaanBarangFormApi.searchSKU("", form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

const onTambahDetailSearch = async (query: string) => {
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await permintaanBarangFormApi.searchSKU(query, form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

const addSelectedTambahDetail = async () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    if (form.value.detail.some((d) => String(d.sku) === String(brg.sku))) continue;
    const row: PermintaanBarangDetail = {
      no: form.value.detail.length + 1,
      sku: String(brg.sku),
      namaBarang: brg.namaBarang || "",
      satuan: brg.satuan || "",
      mingguLalu: 0,
      realisasiIn: 0,
      sisa: 0,
      qty: 0,
      stokNow: 0,
      avgSale: 0,
      keterangan: "",
    };
    form.value.detail.push(row);
    await fillSKUStats(row, row.sku);
    added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  if (added > 0) {
    nextTick(() => enterEdit(firstRow, "qty"));
  }
};

// ── Ambil Data Minggu Lalu ───────────────────────────────────────────
const searchPB = async (query: string) => {
  try {
    pbOptions.value = await permintaanBarangFormApi.searchPB(form.value.tanggal);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari PB.");
  }
};

const openPBModal = () => {
  showPBModal.value = true;
  searchPB("");
};

const selectPB = async (item: any) => {
  try {
    const items = await permintaanBarangFormApi.loadPB(item.nomor);
    form.value.detail = items.map((d, i) => ({
      ...d,
      no: i + 1,
    }));
    showPBModal.value = false;
    toast.success("Data PB berhasil dimuat.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load data PB.");
  }
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Navigasi grid detail (ala Excel) — pola DOFormView ───────────────
const colToElId = (c: string, r: number) =>
  c === "sku" ? `pb-cell-sku-${r}` : `pb-cell-${c}-${r}`;

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
  cols: ["sku", "qty", "keterangan"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "pb-cell",
  onPicker: (r, c) => {
    if (c === "sku") openSKUModal(r);
  },
  typeEditCols: ["qty", "keterangan"],
  onTypeEdit: doTypeEdit,
});

const {
  focusCell,
  gridBlur,
  onGridCellFocus,
  enterEdit,
} = grid;

const isActiveCell = (r: number, c: string) =>
  focusCell.value?.r === r && focusCell.value?.c === c;

// ── Input numerik QTY — bebas ketik seperti string, format saat blur ──
const rawInputValues: Record<string, string> = {};

const getInputValue = (key: string, modelValue: number, decimals = 0) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startQtyEdit = (idx: number, e: Event, qty: number) => {
  const key = `qty-${idx}`;
  const val = qty === 0 ? "" : String(qty);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
  onGridCellFocus("qty", idx);
};

const onQtyInput = (e: Event, d: PermintaanBarangDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues[`qty-${idx}`] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, "")) || 0);
};

const endEdit = (key: string, e: Event, raw: number, decimals = 0) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

// ── Validasi (paritas Delphi cekdata) ────────────────────────────────
const validateSave = (): boolean => {
  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.sku || d.sku === "0") {
      toast.warning(`SKU Baris ${i + 1} belum dipilih.`);
      return false;
    }
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!validateSave()) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await permintaanBarangFormApi.save(form.value);
    handlePostSave(action, String(form.value.nomor ?? ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Reset ( utk aksi "Simpan & Baru" ) ────────────────────────────────
const resetForm = () => {
  form.value = { isEdit: false, nomor: "", tanggal: today, memo: "", detail: [] };
  loadMaxNomor();
};

// ── Detail table column widths ───────────────────────────────────────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: 200 },
  { key: 'satuan', width: 50 },
  { key: 'minggu', width: 70 },
  { key: 'realisasi', width: 70 },
  { key: 'sisa', width: 60 },
  { key: 'qty', width: 70 },
  { key: 'stok', width: 70 },
  { key: 'avg', width: 70 },
  { key: 'keterangan', width: 140 },
  { key: 'action', width: 30 },
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtAvg = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Permintaan Barang' : 'Tambah Permintaan Barang Baru'"
    :icon="IconClipboardText"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="pb-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="pb-header-grid">
        <fieldset class="pb-groupbox">
          <legend class="pb-legend">Informasi Permintaan</legend>
          <div class="pb-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row f-row-top">
              <label class="f-lbl">Keterangan</label>
              <textarea v-model="form.memo" class="f-txa" rows="4"></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset class="pb-groupbox">
          <legend class="pb-legend">Data Minggu Lalu</legend>
          <div class="pb-groupbody">
            <div class="pb-hint">
              Ambil baris permintaan dari 7 hari terakhir sebagai dasar.
            </div>
            <div class="f-row">
              <label class="f-lbl"></label>
              <button class="btn-load" type="button" @click="openPBModal">
                <IconFileUpload :size="13" /> Ambil Data Minggu Lalu
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="pb-groupbox pb-detail-group">
        <legend class="pb-legend">Detail Permintaan</legend>
        <div class="pb-detail-actions">
          <button class="btn-add-detail" type="button" @click="openTambahDetail">
            <IconPlus :size="13" /> Tambah Detail
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
                  <th :style="detailColWidthStyle('satuan')" class="tc">Sat</th>
                  <th :style="detailColWidthStyle('minggu')" class="tr">Qty Pending</th>
                  <th :style="detailColWidthStyle('realisasi')" class="tr">Realisasi IN</th>
                  <th :style="detailColWidthStyle('sisa')" class="tr">Sisa</th>
                  <th :style="detailColWidthStyle('qty')" class="tr">QTY</th>
                  <th :style="detailColWidthStyle('stok')" class="tr">Stok Now</th>
                  <th :style="detailColWidthStyle('avg')" class="tr">Avg Sale</th>
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
                    <div class="cell-search" :id="'pb-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.sku" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" title="Cari SKU" @click="openSKUModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="cell-muted" :style="detailColWidthStyle('nama')">{{ d.namaBarang }}</td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('satuan')">{{ d.satuan }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('minggu')">{{ fmt(d.mingguLalu) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('realisasi')">{{ fmt(d.realisasiIn) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('sisa')">{{ fmt(d.sisa) }}</td>
                  <td :style="detailColWidthStyle('qty')">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :id="'pb-cell-qty-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="startQtyEdit(idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); gridBlur()" />
                  </td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('stok')">{{ fmt(d.stokNow) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('avg')">{{ fmtAvg(d.avgSale) }}</td>
                  <td :style="detailColWidthStyle('keterangan')">
                    <input v-model="d.keterangan" class="cell-inp" :id="'pb-cell-keterangan-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'keterangan') }" @focus="onGridCellFocus('keterangan', idx)" @blur="gridBlur()" />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="12" class="empty-state">
                    Belum ada barang. Klik <strong>"+ Tambah Detail"</strong> atau <strong>"Ambil Data Minggu Lalu"</strong>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL TAMBAH DETAIL (checklist barang master) ═══ -->
  <v-dialog v-model="showTambahDetailModal" max-width="680" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #D97706);">
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
                <th>Nama Barang</th>
                <th style="width: 70px" class="tc">Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in tambahDetailItems" :key="brg.sku" class="modal-row" @click="toggleTambahDetail(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg.sku)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.sku }}</td>
                <td>{{ brg.namaBarang }}</td>
                <td class="tc">{{ brg.satuan }}</td>
              </tr>
              <tr v-if="tambahDetailItems.length === 0">
                <td colspan="4" class="empty-state">Tidak ada barang yang cocok.</td>
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

  <!-- ═══ MODAL SEARCH SKU (pilih-satu) ═══ -->
  <SearchModal
    v-model="showSKUModal"
    title="Pilih SKU"
    :columns="[
      { key: 'sku', title: 'SKU', width: '100px' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '60px', align: 'center' },
    ]"
    :items="skuOptions"
    :loading="skuLoading"
    :server-search="true"
    search-placeholder="Cari SKU..."
    @select="selectSKU"
    @search="searchSKU"
  />

  <!-- ═══ MODAL SEARCH PB ═══ -->
  <SearchModal
    v-model="showPBModal"
    title="Pilih Nomor Permintaan"
    :columns="[
      { key: 'nomor', title: 'Nomor Permintaan', width: '150px' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
    ]"
    :items="pbOptions"
    search-placeholder="Cari nomor..."
    @select="selectPB"
  />
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   PERMINTAAN BARANG — Classic Desktop Layout (pola DO/SO/FP Form)
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #D97706);
  outline-offset: 0;
}

.pb-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
  background: #FDFDFE;
}

.pb-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.pb-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.pb-legend {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
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

.pb-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pb-hint {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
}

.pb-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pb-detail-group .pb-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.pb-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: #F7FAFC;
}

.btn-add-detail,
.btn-load {
  height: 28px;
  padding: 0 14px;
  background: var(--ds-primary, #D97706);
  color: white;
  border: 1px solid var(--ds-primary-dark, #B45309);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.btn-add-detail:hover,
.btn-load:hover {
  background: var(--ds-primary-dark, #B45309);
}

.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-row-top {
  align-items: flex-start;
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
  border-color: var(--ds-primary, #D97706);
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
  background: var(--ds-primary, #D97706);
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
  border-right: 1px solid var(--ds-primary-dark, #B45309);
  border-bottom: 1px solid var(--ds-primary-dark, #B45309);
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

.detail-table tbody tr:nth-child(odd) {
  background: #F0F3F8;
}

.detail-table tbody tr:nth-child(even) {
  background: #E4EBF4;
}

.detail-table tbody tr:hover td {
  background: #D8E2EF;
}

.detail-table-header-tbl,
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

.cell-search {
  display: flex;
  gap: 2px;
}

.cell-active {
  outline: 2px solid var(--ds-primary, #D97706) !important;
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
  border-color: var(--ds-primary, #D97706);
}

.cell-inp.readonly-bg {
  background: #F0F2F6;
  color: #000000;
  font-weight: 400;
  border-color: #CBD2DA;
  cursor: default;
}

.cell-btn {
  height: 24px;
  width: 22px;
  background: var(--ds-primary, #D97706);
  color: white;
  border: 1px solid var(--ds-primary-dark, #B45309);
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.cell-btn:hover {
  background: var(--ds-primary-dark, #B45309);
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

.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

@media (max-width: 1024px) {
  .pb-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .pb-layout {
    padding: 4px;
    gap: 4px;
  }
  .pb-groupbody {
    padding: 6px;
    gap: 4px;
  }
}

/* ── Modal Tambah Detail (checklist) ──────────────────────── */
.tb-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tb-search-input {
  flex: 1; height: 28px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: #fff;
}
.tb-search-input:focus { border-color: var(--ds-primary, #D97706); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th {
  background: var(--ds-primary, #D97706); color: #fff; font-weight: 700;
  padding: 5px 8px; text-align: left; white-space: nowrap; position: sticky; top: 0;
}
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #D97706); }
.tb-add-btn { border-radius: 0; text-transform: none; }
</style>