<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconPackage, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import { titipFormApi, type TitipForm, type TitipDetail } from "@/api/persediaan/titipFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";

import DsDatePicker from "@/components/DsDatePicker.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const attemptedSave = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<TitipForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  gdgKode: "",
  gdgNama: "",
  memo: "",
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const gudangOptions = ref<any[]>([]);
const barangOptions = ref<any[]>([]);

// ── Modal State ──────────────────────────────────────────────────────
const showGudangModal = ref(false);
const showBarangModal = ref(false);
const activeDetailIndex = ref(-1);
const isAddRowMode = ref(false);

// ── Load Nomor ───────────────────────────────────────────────────────
// Format TB.yymm.NNNN — dibuat saat buka form create, regenerate saat
// tanggal berubah (mode create).
const loadNomor = async () => {
  try {
    const res = await titipFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal generate nomor titip.");
  }
};

// ── Load Options ─────────────────────────────────────────────────────
const loadOptions = async () => {
  try {
    gudangOptions.value = await titipFormApi.getGudang("");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data.");
  }
};

// ── Search Gudang (hanya gudang konsinyasi — dari backend) ───────────
const searchGudang = async (query: string) => {
  try {
    gudangOptions.value = await titipFormApi.getGudang(query || "");
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

// ── Search Barang (hanya barang konsinyasi — dari backend) ──────────
const searchBarang = async (query: string) => {
  try {
    barangOptions.value = await titipFormApi.searchBarang(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  }
};

// ── Modal barang per baris ──
const openBarangModal = (idx: number) => {
  if (!form.value.gdgKode) {
    toast.warning("Pilih gudang dahulu.");
    return;
  }
  activeDetailIndex.value = idx;
  isAddRowMode.value = false;
  showBarangModal.value = true;
  searchBarang("");
};

const selectBarang = (item: any) => {
  // Tolak barang yang sudah ada di baris lain (kunci = SKU)
  const activeIdx = isAddRowMode.value ? -1 : activeDetailIndex.value;
  const dupIdx = form.value.detail.findIndex(
    (x, i) => i !== activeIdx && x.brgKode === Number(item.sku)
  );
  if (dupIdx >= 0) {
    toast.warning(`SKU sama dengan baris ${dupIdx + 1}.`);
    return;
  }

  const newRow: TitipDetail = {
    no: 0,
    brgKode: Number(item.sku),
    brgNama: item.namaBarang,
    qty: 0,
    satuan: item.satuan || "",
    expired: "",
    idBatch: "",
    isExpired: Number(item.isExpired) || 0,
    isKonsinyasi: Number(item.isKonsinyasi) || 0,
  };

  if (isAddRowMode.value) {
    newRow.no = form.value.detail.length + 1;
    form.value.detail.push(newRow);
    isAddRowMode.value = false;
  } else {
    const idx = activeDetailIndex.value;
    if (idx < 0 || !form.value.detail[idx]) return;
    newRow.no = idx + 1;
    form.value.detail[idx] = newRow;
  }

  showBarangModal.value = false;
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Tambah Detail (dialog checklist barang konsinyasi) ──────────────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

const brgKey = (b: any) => `${String(b.sku)}`;

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

// Tambah satu baris barang konsinyasi (dup-guard per SKU).
const addBrgRow = (item: any): boolean => {
  const dupIdx = form.value.detail.findIndex(
    (x) => x.brgKode === Number(item.sku)
  );
  if (dupIdx >= 0) return false;

  form.value.detail.push({
    no: form.value.detail.length + 1,
    brgKode: Number(item.sku),
    brgNama: item.namaBarang,
    qty: 0,
    satuan: item.satuan || "",
    expired: "",
    idBatch: "",
    isExpired: Number(item.isExpired) || 0,
    isKonsinyasi: Number(item.isKonsinyasi) || 0,
  });
  return true;
};

const openTambahDetail = async () => {
  if (!form.value.gdgKode) {
    toast.warning("Pilih gudang dahulu.");
    return;
  }
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await titipFormApi.searchBarang("");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Pencarian server-side (debounce)
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    tambahDetailLoading.value = true;
    try {
      tambahDetailItems.value = await titipFormApi.searchBarang(query || "");
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
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  if (added > 0) {
    nextTick(() => enterEdit(firstRow, "qty"));
  }
};

// ── Navigasi grid detail (ala Excel, pointer) ──────────────────────────
const colToElId = (c: string, r: number) =>
  c === "sku" ? `titip-cell-sku-${r}` : `titip-cell-${c}-${r}`;

// "Type-to-edit" khas qty: rawInputValues dulu agar Vue tidak menimpa DOM.
const titipTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(colToElId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  if (c === "qty") rawInputValues[`qty-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const grid = useDetailGrid({
  cols: ["sku", "qty"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "titip-cell",
  onPicker: (r, c) => {
    if (c === "sku") openBarangModal(r);
  },
  typeEditCols: ["qty"],
  onTypeEdit: titipTypeEdit,
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
const fmtQty = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

// ── Input System — bebas ketik seperti string, format saat blur ───
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

const endEdit = (key: string, e: Event, raw: number, decimals = 0) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

// ── Input Handlers (saat ketik — update model + raw store) ───────
const onQtyInput = (e: Event, d: TitipDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['qty-' + idx] = el.value;
  d.qty = Math.floor(Number(el.value.replace(/,/g, '')) || 0);
};

// ── Validasi ─────────────────────────────────────────────────────────
// Barang masuk (stok in) — tidak ada security stok.
const validateSave = (): boolean => {
  attemptedSave.value = true;
  if (!form.value.gdgKode) {
    toast.warning("Gudang konsinyasi belum dipilih.");
    return false;
  }
  if (!form.value.tanggal) {
    toast.warning("Tanggal belum diisi.");
    return false;
  }

  for (const d of form.value.detail) {
    if (d.brgKode === 0) {
      toast.warning(`SKU baris ${d.no} belum dipilih.`);
      return false;
    }
    if (Number(d.qty) <= 0) {
      toast.warning(`Qty baris ${d.no} (${d.brgNama}) belum diisi.`);
      return false;
    }
    if ((d.isExpired ?? 0) === 1 && !d.expired) {
      toast.warning(`Expired baris ${d.no} belum diisi.`);
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
    const res = await titipFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan titip barang.");
  } finally {
    isSaving.value = false;
  }
};

// ── Load Data Edit ───────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    return;
  }

  isLoading.value = true;
  try {
    const data = await titipFormApi.getDetailForm(decodeURIComponent(nomor));

    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
      tanggal: data.tanggal || today,
      gdgKode: data.gdgKode || "",
      gdgNama: data.gdgNama || "",
      memo: data.memo || "",
      detail: data.detail || [],
    };
    tanggalOld.value = form.value.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data titip barang.");
    router.push({ name: "titipBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Guard tanggal edit (nomor TB.yymm.NNNN) ──────────────────────────
const tanggalOld = ref("");
watch(
  () => form.value.tanggal,
  (nv, ov) => {
    if (!nv) return;
    if (!isEdit.value) {
      // Mode create: regenerate nomor saat tanggal berubah (skip awal mount)
      if (ov && form.value.nomor) loadNomor();
      tanggalOld.value = nv;
      return;
    }
    if (!form.value.nomor || !ov) return;
    const yy = nv.slice(2, 4);
    const mm = nv.slice(5, 7);
    if (form.value.nomor.slice(3, 7) !== `${yy}${mm}`) {
      toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun.");
      form.value.tanggal = tanggalOld.value || nv;
    } else {
      tanggalOld.value = nv;
    }
  }
);

const resetForm = () => {
  attemptedSave.value = false;
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    gdgKode: "",
    gdgNama: "",
    memo: "",
    detail: [],
  };
  loadNomor();
};

// ── Detail table column widths ───────────────────────────────────────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 65 },
  { key: 'nama', width: 340 },
  { key: 'idBatch', width: 110 },
  { key: 'qty', width: 70 },
  { key: 'satuan', width: 70 },
  { key: 'expired', width: 130 },
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
  if (!isEdit.value) await loadNomor();
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Titip Barang Konsinyasi' : 'Tambah Titip Barang Konsinyasi'"
    :icon="IconPackage"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :show-save-print="false"
    @save-action="confirmSave"
  >
    <div class="do-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="do-header-grid">
        <!-- Gudang -->
        <fieldset class="do-groupbox">
          <legend class="do-legend">Informasi Gudang Konsinyasi</legend>
          <div class="do-groupbody">
            <div class="f-row">
              <label class="f-lbl">Gudang</label>
              <div class="search-group">
                <input :value="form.gdgKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.gdgNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Gudang Konsinyasi..." />
                <button class="btn-search" type="button" @click="showGudangModal = true; searchGudang('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <div class="hint-row">
                Barang yang dipilih hanya barang konsinyasi. Stok akan masuk
                ke gudang konsinyasi ini (tmasterstok).
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="do-groupbox">
          <legend class="do-legend">Informasi Titip</legend>
          <div class="do-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="do-groupbox do-detail-group">
        <legend class="do-legend">Detail Barang Konsinyasi</legend>
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
                  <th :style="detailColWidthStyle('expired')" class="tc">Expired</th>
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
                    <div class="cell-search" :id="'titip-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.brgKode" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" title="Cari barang konsinyasi" @click="openBarangModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="cell-muted" :style="detailColWidthStyle('nama')">{{ d.brgNama }}</td>
                  <td :style="detailColWidthStyle('idBatch')">
                    <input v-model="d.idBatch" type="text" class="cell-inp" placeholder="Batch" />
                  </td>
                  <td :style="detailColWidthStyle('qty')"><input type="text" inputmode="numeric" class="cell-inp tr" :id="'titip-cell-qty-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'qty'), 'cell-missing': attemptedSave && Number(d.qty) <= 0 }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="startQtyEdit(idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); gridBlur()" /></td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('satuan')">{{ d.satuan }}</td>
                  <td class="tc" :style="detailColWidthStyle('expired')">
                    <input v-model="d.expired" type="date" class="cell-inp tc" :class="{ 'cell-missing': attemptedSave && (d.isExpired ?? 0) === 1 && !d.expired }" />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="8" class="empty-state">
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
    v-model="showGudangModal"
    title="Pilih Gudang Konsinyasi"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Gudang' },
    ]"
    :items="gudangOptions"
    :server-search="true"
    search-placeholder="Cari gudang konsinyasi..."
    @select="selectGudang"
    @search="searchGudang"
  />

  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang Konsinyasi"
    :columns="[
      { key: 'sku', title: 'SKU', width: '100px' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '90px', align: 'center' },
    ]"
    :items="barangOptions"
    :server-search="true"
    search-placeholder="Cari barang konsinyasi..."
    @select="selectBarang"
    @search="searchBarang"
  />

  <!-- ═══ MODAL TAMBAH DETAIL (checklist barang konsinyasi) ═══ -->
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
            placeholder="Cari barang konsinyasi..."
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
                <th style="width: 260px">Nama Barang</th>
                <th style="width: 80px" class="tc">Satuan</th>
                <th style="width: 70px" class="tc">Expired?</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in filteredTambahDetailItems" :key="brg.sku" class="modal-row" @click="toggleTambahDetail(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.sku }}</td>
                <td>{{ brg.namaBarang }}</td>
                <td class="tc">{{ brg.satuan }}</td>
                <td class="tc">{{ Number(brg.isExpired) === 1 ? 'Ya' : '-' }}</td>
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
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   TITIP BARANG KONSINYASI — Classic Desktop Layout (matches DOFormView)
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

.hint-row {
  font-size: 11px;
  color: var(--ds-text-muted, #8494A7);
  font-style: italic;
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

.cell-inp.cell-missing {
  border-color: #d32f2f !important;
  background: #fff5f5;
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
