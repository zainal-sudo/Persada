<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import ColumnFilter, {
  type ColumnFilterValue,
  type FilterType,
} from "@/components/ColumnFilter.vue";
import { matchColumnFilter } from "@/composables/useColumnFilter";
import {
  IconFileCheck,
  IconSearch,
  IconFilter,
  IconFilterOff,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-vue";
import { serahTerimaFakturSalesmanFormApi, type SerahTerimaFakturSalesmanForm, type SerahTerimaFakturSalesmanDetail } from "@/api/penjualan/serahTerimaFakturSalesmanFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<SerahTerimaFakturSalesmanForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  slsKode: "",
  slsNama: "",
  memo: "",
  detail: [],
});

const salesmanOptions = ref<any[]>([]);
const showSalesmanModal = ref(false);

const loadNomor = async () => {
  try {
    const res = await serahTerimaFakturSalesmanFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const loadOptions = async () => {
  try {
    salesmanOptions.value = await serahTerimaFakturSalesmanFormApi.getSalesman();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data salesman.");
  }
};

const selectSalesman = async (sls: any) => {
  form.value.slsKode = sls.kode;
  form.value.slsNama = sls.nama;
  showSalesmanModal.value = false;
  await loadInvoice();
};

const loadInvoice = async () => {
  if (!form.value.slsKode) return;
  try {
    const data = await serahTerimaFakturSalesmanFormApi.getInvoice(form.value.slsKode);
    form.value.detail = data;
    // Antrean baru → filter kolom lama tidak relevan lagi.
    resetFilters();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

const validateSave = () => {
  if (!form.value.slsKode) {
    toast.warning("Salesman belum dipilih.");
    return;
  }

  const checkedItems = form.value.detail.filter((d) => d.check === 1);
  if (checkedItems.length === 0) {
    toast.warning("Minimal satu faktur harus dicentang.");
    return;
  }

};

const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await serahTerimaFakturSalesmanFormApi.save(form.value);
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
    await loadNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await serahTerimaFakturSalesmanFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "serahTerimaFakturSalesmanBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    slsKode: "",
    slsNama: "",
    memo: "",
    detail: [],
  };
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadOptions();
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${d}-${m}-${y}`;
  } catch { return val; }
};

// ── Filter per kolom (pola SerahTerimaFakturFormView) ────────────────────
type DtlKey =
  | "no"
  | "customer"
  | "faktur"
  | "tanggal"
  | "ppn"
  | "nilai"
  | "jatuhTempo"
  | "overdue"
  | "rangeOverdue"
  | "check";

// Satu sumber kebenaran untuk judul, lebar, dan tipe filter.
const DETAIL_COLS: {
  key: DtlKey;
  title: string;
  width?: string;
  minWidth?: string;
  cls?: string;
  filterType: FilterType;
}[] = [
  { key: "no", title: "No", width: "36px", cls: "tc", filterType: "select" },
  { key: "customer", title: "Customer", minWidth: "180px", filterType: "select" },
  { key: "faktur", title: "Faktur", width: "150px", filterType: "select" },
  { key: "tanggal", title: "Tgl Faktur", width: "100px", cls: "tc", filterType: "date" },
  { key: "ppn", title: "PPN", width: "90px", cls: "tr", filterType: "number" },
  { key: "nilai", title: "Nilai", width: "110px", cls: "tr", filterType: "number" },
  { key: "jatuhTempo", title: "Jatuh Tempo", width: "100px", cls: "tc", filterType: "select" },
  { key: "overdue", title: "Overdue", width: "70px", cls: "tr", filterType: "select" },
  { key: "rangeOverdue", title: "Range", width: "90px", cls: "tc", filterType: "select" },
  { key: "check", title: "Check", width: "50px", cls: "tc", filterType: "select" },
];

const colFilters = ref<Record<string, ColumnFilterValue | null>>({});
const openFilterCol = ref<string | null>(null);
const filterStyle = ref<Record<string, string>>({});

const activeFilterCount = computed(
  () => Object.values(colFilters.value).filter((f) => f !== null).length,
);

const hasFilter = (key: string) =>
  colFilters.value[key] !== null && colFilters.value[key] !== undefined;

// Nilai yang dipakai filter per kolom (No bukan data → pakai urutan asli).
const filterValue = (d: SerahTerimaFakturSalesmanDetail, no: number, key: DtlKey): any => {
  switch (key) {
    case "no": return no;
    case "customer": return d.customer;
    case "faktur": return d.faktur;
    case "tanggal": return d.tanggal;
    case "ppn": return d.ppn;
    case "nilai": return d.nilai;
    case "jatuhTempo": return d.jatuhTempo;
    case "overdue": return d.overdue;
    case "rangeOverdue": return d.rangeOverdue;
    case "check": return d.check;
  }
};

// Baris yang tampil + nomor urut ASLI (bukan nomor hasil filter), supaya
// angka di layar tetap sama dengan yang tersimpan.
const filteredDetail = computed(() =>
  form.value.detail
    .map((d, i) => ({ d, no: i + 1 }))
    .filter(({ d, no }) =>
      DETAIL_COLS.every(({ key }) =>
        matchColumnFilter(filterValue(d, no, key), colFilters.value[key])
      )
    )
);

const openColFilter = (key: string, event: MouseEvent) => {
  if (openFilterCol.value === key) {
    openFilterCol.value = null;
    return;
  }
  // Samakan lebar dropdown dengan lebar header, lalu flip ke kiri bila
  // akan melewati tepi kanan layar (pola BaseBrowse.openColFilter).
  const POPUP_WIDTH = 190;
  const MARGIN = 8;
  const btn = event.currentTarget as HTMLElement;
  const th = btn.closest("th");
  if (th) {
    const thRect = th.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = thRect.left;
    if (left + POPUP_WIDTH + MARGIN > vw) {
      left = Math.min(btnRect.right, vw - MARGIN) - POPUP_WIDTH;
    }
    left = Math.max(MARGIN, Math.min(left, vw - POPUP_WIDTH - MARGIN));
    filterStyle.value = {
      position: "fixed",
      top: `${thRect.bottom + 2}px`,
      left: `${left}px`,
    };
  }
  openFilterCol.value = key;
};

const onColFilterUpdate = (key: string, val: ColumnFilterValue | null) => {
  colFilters.value = { ...colFilters.value, [key]: val };
};

const clearAllFilters = () => {
  colFilters.value = {};
  openFilterCol.value = null;
};

const resetFilters = () => {
  colFilters.value = {};
  openFilterCol.value = null;
};

const activeFilterTitle = computed(() => {
  const k = openFilterCol.value;
  if (!k) return "";
  return DETAIL_COLS.find((c) => c.key === k)?.title || k;
});

const filterTypeOf = (key: string): FilterType =>
  DETAIL_COLS.find((c) => c.key === key)?.filterType || "text";

// Baris tersembunyi ikut tersimpan → bukan salah filter kalau validate
// tetap lolos sementara tidak ada baris terlihat yang tercentang.
const hiddenCheckedCount = computed(
  () =>
    form.value.detail.length -
    filteredDetail.value.filter((r) => Number(r.d.check) === 1).length
);

// Sumber nilai unik untuk filter select: `no` bukan properti row (hasil
// index), jadi tanpa ini checklist kolom No berisi "(Kosong)" semua.
const filterRows = computed(() =>
  form.value.detail.map((d, i) => ({ ...d, no: i + 1 }))
);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Serah Terima Faktur Salesman' : 'Tambah Serah Terima Faktur Salesman Baru'"
    :icon="IconFileCheck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="stf-layout">
      <!-- ═══ HEADER (2 kolom sejajar) ═══ -->
      <div class="stf-header-grid">
        <!-- Salesman Info -->
        <fieldset class="stf-groupbox">
          <legend class="stf-legend">Informasi Salesman</legend>
          <div class="stf-groupbody">
            <div class="f-row">
              <label class="f-lbl">Salesman</label>
              <div class="search-group">
                <input :value="form.slsKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.slsNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Salesman..." />
                <button class="btn-search" type="button" @click="showSalesmanModal = true">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="2"></textarea>
            </div>
            <div class="f-row">
              <label class="f-lbl"></label>
              <button class="btn-load" type="button" @click="loadInvoice" :disabled="!form.slsKode">
                Load
              </button>
            </div>
          </div>
        </fieldset>

        <!-- Serah Terima Info -->
        <fieldset class="stf-groupbox">
          <legend class="stf-legend">Informasi Serah Terima</legend>
          <div class="stf-groupbody">
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
      <fieldset class="stf-groupbox stf-detail-group">
        <legend class="stf-legend">Daftar Faktur</legend>
        <div class="detail-toolbar">
          <span v-if="activeFilterCount" class="filter-count">
            {{ activeFilterCount }} filter aktif
          </span>
          <span v-else class="filter-count muted">
            {{ form.detail.length }} faktur
          </span>
          <button
            v-if="activeFilterCount"
            type="button"
            class="btn-filter-clear"
            @click="clearAllFilters"
          >
            <IconFilterOff :size="13" />
            Hapus Filter
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th
                  v-for="col in DETAIL_COLS"
                  :key="col.key"
                  :style="
                    col.width
                      ? { width: col.width }
                      : col.minWidth
                        ? { minWidth: col.minWidth }
                        : {}
                  "
                  :class="col.cls"
                >
                  <div class="th-inner">
                    <span class="th-title">{{ col.title }}</span>
                    <button
                      type="button"
                      class="col-filter-btn"
                      :class="{ active: hasFilter(col.key) }"
                      :title="`Filter ${col.title}`"
                      @click.stop="openColFilter(col.key, $event)"
                    >
                      <IconFilter
                        v-if="hasFilter(col.key)"
                        :size="9"
                        :stroke-width="2.2"
                      />
                      <IconAdjustmentsHorizontal
                        v-else
                        :size="9"
                        :stroke-width="2.2"
                      />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredDetail" :key="row.d.faktur">
                <td class="tc row-no">{{ row.no }}</td>
                <td>{{ row.d.customer }}</td>
                <td>{{ row.d.faktur }}</td>
                <td class="tc">{{ row.d.tanggal }}</td>
                <td class="tr">{{ fmt(row.d.ppn) }}</td>
                <td class="tr bold">{{ fmt(row.d.nilai) }}</td>
                <td class="tc">{{ row.d.jatuhTempo }}</td>
                <td class="tr">{{ row.d.overdue }}</td>
                <td class="tc">{{ row.d.rangeOverdue }}</td>
                <td class="tc">
                  <input
                    v-model="row.d.check"
                    type="checkbox"
                    :true-value="1"
                    :false-value="0"
                    :aria-label="`Centang faktur ${row.d.faktur}`"
                  />
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="10" class="empty-state">
                  Pilih salesman dan klik Load untuk memuat data.
                </td>
              </tr>
              <tr v-else-if="filteredDetail.length === 0">
                <td colspan="10" class="empty-state">
                  Tidak ada faktur yang cocok dengan filter aktif.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="hiddenCheckedCount > 0" class="filter-note">
          {{ hiddenCheckedCount }} faktur tercentang tersembunyi oleh filter —
          tetap ikut disimpan.
        </p>
      </fieldset>
    </div>
  </BaseForm>

  <ColumnFilter
    v-if="openFilterCol"
    :filter-type="filterTypeOf(openFilterCol)"
    :column-key="openFilterCol"
    :title="activeFilterTitle"
    :items="filterRows"
    :model-value="colFilters[openFilterCol] ?? null"
    :dropdown-style="filterStyle"
    @update:model-value="onColFilterUpdate(openFilterCol, $event)"
    @close="openFilterCol = null"
  />

  <!-- ═══ MODAL SALESMAN ═══ -->
  <SearchModal
    v-model="showSalesmanModal"
    title="Pilih Salesman"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Salesman' },
    ]"
    :items="salesmanOptions"
    search-placeholder="Cari salesman..."
    @select="selectSalesman"
  />
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   SERAH TERIMA FAKTUR SALESMAN — Classic Desktop Layout
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.stf-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.stf-header-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(240px, 320px);
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.stf-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.stf-legend {
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

.stf-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.stf-detail-group {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Field Row ────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-lbl {
  width: 70px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

/* ── Input (sunken desktop style) ─────────────────────────────── */
.f-inp {
  flex: 1;
  max-width: 300px;
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
  max-width: 380px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 4px 5px;
  font-size: 11px;
  outline: none;
  resize: vertical;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-txa:focus {
  border-color: var(--ds-primary, #0284c7);
}

/* ── Search Group ─────────────────────────────────────────────── */
.search-group {
  display: flex;
  gap: 2px;
  flex: 1;
  max-width: 380px;
}

.w-20 { width: 30%; flex: none !important; }
.w-80 { width: 70%; }

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

.btn-load {
  height: 24px;
  padding: 0 10px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-load:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-load:disabled {
  background: var(--ds-text-muted, #8494A7);
  border-color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

/* ── Detail Table ─────────────────────────────────────────────── */
.detail-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}

.detail-table {
  width: 100%;
  /* separate: sticky thead dengan border-collapse:collapse kehilangan border
     bawahnya di beberapa engine, jadi border ditulis per-sel. */
  border-collapse: separate;
  border-spacing: 0;
  font-size: 11px;
  font-weight: 500;
}

.detail-table th {
  color: white;
  font-weight: 700;
  padding: 4px 6px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 2;
  /* Latar harus di th, bukan di thead tr: tr ikut scroll keluar saat th
     menempel, birunya ikut hilang dan isi tbody tembus ke header. */
  background: var(--ds-primary, #0284c7);
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

.detail-table tbody tr:nth-child(even) {
  background: var(--ds-surface, #F0F3F8);
}

.detail-table tbody tr:hover td {
  background: var(--ds-primary-50, #E8EDF5);
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

/* ── Header dua lapis: judul + tombol filter per kolom ─────────── */
.th-inner {
  display: flex;
  align-items: center;
  gap: 3px;
}
.th-title {
  flex: 1 1 auto;
  min-width: 0;
}
.col-filter-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0;
  color: #ffffff;
  cursor: pointer;
}
.col-filter-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}
.col-filter-btn.active {
  background: #ffffff;
  color: var(--ds-primary, #0284c7);
  border-color: #ffffff;
}
.col-filter-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}

/* ── Toolbar di atas grid: jumlah baris + hapus filter ─────────── */
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}
.filter-count {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ds-primary, #0284c7);
}
.filter-count.muted {
  font-weight: 500;
  color: var(--ds-text-secondary, #5A6A7E);
}
.btn-filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  background: #ffffff;
  color: var(--ds-primary, #0284c7);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}
.btn-filter-clear:hover {
  background: var(--ds-primary-50, #E8EDF5);
}
.filter-note {
  margin: 0;
  padding: 3px 6px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  font-size: 10.5px;
  color: var(--ds-warning, #0284c7);
  background: #e1f5fe;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
</style>