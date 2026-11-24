<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconCalculator, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  hitungStokFormApi,
  type HitungStokForm,
  type HitungStokDetail,
} from "@/api/persediaan/hitungStokFormApi";

const route = useRoute();
const toast = useToast();
const { handlePostSave } = useAfterSave({ onReset: () => resetForm() });

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<HitungStokForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  gudang: "",
  lokasi: "",
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const gudangOptions = ref<{ kode: string; nama: string }[]>([]);
const barangOptions = ref<{ sku: string; namaBarang: string; satuan: string }[]>([]);
const barangLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showSKUModal = ref(false);
const activeDetailIndex = ref(-1);

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
    const data = await hitungStokFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
    // Isi NamaBarang dari lookup (detail edit tidak membawa nama).
    form.value.detail.forEach((d) => {
      const b = barangOptions.value.find((x) => String(x.sku) === String(d.sku));
      if (b) d.namaBarang = b.namaBarang;
    });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data hitung stok.");
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    form.value.nomor = await hitungStokFormApi.getMaxNomor(form.value.tanggal);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor hitung stok.");
  }
};

const loadGudang = async () => {
  try {
    gudangOptions.value = await hitungStokFormApi.getGudang();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data gudang.");
  }
};

// ── Search Barang (master) — paritas Delphi initViewSKU (tbarang) ───
const searchBarang = async (query: string) => {
  barangLoading.value = true;
  try {
    barangOptions.value = await hitungStokFormApi.getBarang(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data barang.");
  } finally {
    barangLoading.value = false;
  }
};

// ── Watch tanggal → generate nomor baru (paritas dtTanggalChange) ───
watch(
  () => form.value.tanggal,
  async () => {
    if (!form.value.isEdit) {
      await loadMaxNomor();
    }
  }
);

// ── Picker SKU (pilih-satu) ──────────────────────────────────────────
const openSKUModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showSKUModal.value = true;
  searchBarang("");
};

const selectSKU = async (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  // Paritas clSKUPropertiesValidate: SKU sama dgn baris lain → konfirmasi.
  const dupIdx = form.value.detail.findIndex(
    (d, i) => i !== idx && String(d.sku) === String(item.sku)
  );
  if (dupIdx >= 0) {
    const lanjut = window.confirm(`Kode barang sudah ada di baris ${dupIdx + 1}. Lanjut?`);
    if (!lanjut) return;
  }

  const d = form.value.detail[idx];
  d.sku = String(item.sku);
  d.namaBarang = item.namaBarang || "";
  d.satuan = item.satuan || "";
  showSKUModal.value = false;
  nextTick(() => enterEdit(idx, "qty"));
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Tambah Detail (checklist barang master) — pola DO ────────────────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

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
    tambahDetailItems.value = await hitungStokFormApi.getBarang("");
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
    tambahDetailItems.value = await hitungStokFormApi.getBarang(query);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

const addSelectedTambahDetail = () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    if (form.value.detail.some((d) => String(d.sku) === String(brg.sku))) continue;
    form.value.detail.push({
      no: form.value.detail.length + 1,
      sku: String(brg.sku),
      namaBarang: brg.namaBarang || "",
      satuan: brg.satuan || "",
      qty: 0,
      expired: "",
    });
    added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  // Fokus langsung ke QTY baris pertama yang baru ditambahkan (mode edit).
  if (added > 0) {
    nextTick(() => enterEdit(firstRow, "qty"));
  }
};

// ── Navigasi grid detail (ala Excel) — pola DOFormView ───────────────
const colToElId = (c: string, r: number) =>
  c === "sku" ? `hs-cell-sku-${r}` : `hs-cell-${c}-${r}`;

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
  cols: ["sku", "qty", "expired"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "hs-cell",
  onPicker: (r, c) => {
    if (c === "sku") openSKUModal(r);
  },
  typeEditCols: ["qty"],
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

// ── Input numerik — bebas ketik seperti string, format saat blur ───
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

const onQtyInput = (e: Event, d: HitungStokDetail, idx: number) => {
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
  if (!form.value.gudang) {
    toast.warning("Gudang belum di pilih.");
    return false;
  }
  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.sku || d.sku === "0") {
      toast.warning(`SKU Baris ${i + 1} belum dipilih.`);
      return false;
    }
    if (Number(d.qty) === 0) {
      toast.warning(`QTY Baris ${i + 1} belum diisi.`);
      return false;
    }
  }
  if (form.value.detail.length === 0) {
    toast.warning("Detail kosong. Klik Tambah Detail untuk mengisi barang.");
    return false;
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!validateSave()) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await hitungStokFormApi.save(form.value);
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
  form.value = { isEdit: false, nomor: "", tanggal: today, gudang: "", lokasi: "", detail: [] };
  loadMaxNomor();
};

// ── Detail table column widths — header & body sinkron ───────────────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'sku', width: 80 },
  { key: 'nama', width: 280 },
  { key: 'qty', width: 70 },
  { key: 'satuan', width: 55 },
  { key: 'expired', width: 100 },
  { key: 'action', width: 30 },
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadGudang(), searchBarang("")]);
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Hitung Stok' : 'Tambah Hitung Stok Baru'"
    :icon="IconCalculator"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="hs-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="hs-header-grid">
        <!-- Informasi Gudang -->
        <fieldset class="hs-groupbox">
          <legend class="hs-legend">Informasi Gudang</legend>
          <div class="hs-groupbody">
            <div class="f-row">
              <label class="f-lbl">Gudang <span class="req">*</span></label>
              <select v-model="form.gudang" class="f-inp">
                <option value="" disabled>-- Pilih Gudang --</option>
                <option v-for="g in gudangOptions" :key="g.kode" :value="g.kode">
                  {{ g.kode }} - {{ g.nama }}
                </option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Lokasi</label>
              <input v-model="form.lokasi" class="f-inp" placeholder="Lokasi..." />
            </div>
          </div>
        </fieldset>

        <!-- Informasi Transaksi -->
        <fieldset class="hs-groupbox">
          <legend class="hs-legend">Informasi Transaksi</legend>
          <div class="hs-groupbody">
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
      <fieldset class="hs-groupbox hs-detail-group">
        <legend class="hs-legend">Detail Hitung Stok</legend>
        <div class="hs-detail-actions">
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
                  <th :style="detailColWidthStyle('sku')">Kode</th>
                  <th :style="detailColWidthStyle('nama')">Nama Barang</th>
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
                    <div class="cell-search" :id="'hs-cell-sku-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                      <input :value="d.sku" class="cell-inp readonly-bg tc" readonly />
                      <button class="cell-btn" type="button" title="Cari barang" @click="openSKUModal(idx)">
                        <IconSearch :size="11" />
                      </button>
                    </div>
                  </td>
                  <td class="cell-muted" :style="detailColWidthStyle('nama')">{{ d.namaBarang }}</td>
                  <td :style="detailColWidthStyle('qty')">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :id="'hs-cell-qty-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'qty') }" :value="getInputValue('qty-' + idx, d.qty, 0)" @focus="startQtyEdit(idx, $event, d.qty)" @input="onQtyInput($event, d, idx)" @blur="endEdit('qty-' + idx, $event, d.qty, 0); gridBlur()" />
                  </td>
                  <td class="tc cell-muted" :style="detailColWidthStyle('satuan')">{{ d.satuan }}</td>
                  <td :style="detailColWidthStyle('expired')">
                    <DsDatePicker v-model="d.expired" variant="cell" :id="'hs-cell-expired-' + idx" @focus="onGridCellFocus('expired', idx)" @blur="gridBlur()" />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="7" class="empty-state">
                    Belum ada barang. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.
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
    title="Pilih Barang"
    :columns="[
      { key: 'sku', title: 'Kode', width: '100px' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '60px', align: 'center' },
    ]"
    :items="barangOptions"
    :loading="barangLoading"
    :server-search="true"
    search-placeholder="Cari barang..."
    @select="selectSKU"
    @search="searchBarang"
  />
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   HITUNG STOK — Classic Desktop Layout (pola DO/SO/FP Form)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.hs-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
  background: #FDFDFE;
}

.hs-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.hs-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.hs-legend {
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

.hs-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.hs-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.hs-detail-group .hs-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.hs-detail-actions {
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

.req { color: red; }

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

/* ── Zebra steel ───────────────────────────────────────────────── */
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

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .hs-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .hs-layout {
    padding: 4px;
    gap: 4px;
  }
  .hs-groupbody {
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
.tb-search-input:focus { border-color: var(--ds-primary, #0284c7); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th {
  background: var(--ds-primary, #0284c7); color: #fff; font-weight: 700;
  padding: 5px 8px; text-align: left; white-space: nowrap; position: sticky; top: 0;
}
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #0284c7); }
.tb-add-btn { border-radius: 0; text-transform: none; }
</style>