<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconFileCheck, IconSearch, IconTrash } from "@tabler/icons-vue";
import { ttFakturFormApi, type TTFakturForm, type TTFakturDetail } from "@/api/penjualan/ttFakturFormApi";

const route = useRoute();
const router = useRouter();
const { handlePostSave } = useAfterSave({ onReset: () => { /* TODO: reset form */ } });
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<TTFakturForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  slsKode: "",
  slsNama: "",
  cusKode: "",
  cusNama: "",
  detail: [],
});

const salesmanOptions = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);

const showSalesmanModal = ref(false);
const showCustomerModal = ref(false);

const loadOptions = async () => {
  try {
    salesmanOptions.value = await ttFakturFormApi.getSalesman();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data salesman.");
  }
};

const selectSalesman = async (sls: any) => {
  form.value.slsKode = sls.kode;
  form.value.slsNama = sls.nama || "";
  showSalesmanModal.value = false;

  if (form.value.slsKode) {
    try {
      const res = await ttFakturFormApi.getNomor(form.value.slsKode);
      form.value.nomor = res.nomor;
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
    }
  }
};

const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await ttFakturFormApi.getCustomer(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari customer.");
  } finally {
    customerLoading.value = false;
  }
};

const selectCustomer = (cust: any) => {
  form.value.cusKode = cust.kode;
  form.value.cusNama = cust.nama;
  showCustomerModal.value = false;
};

const loadInvoice = async () => {
  if (!form.value.cusKode) {
    toast.warning("Pilih customer dahulu.");
    return;
  }

  try {
    const data = await ttFakturFormApi.getInvoice(form.value.cusKode);
    form.value.detail = data;

    // Pola DOFormView: setelah invoice termuat, sorot sel Check baris pertama —
    // user tinggal Space/Enter untuk centang (nilai TT auto = nilai faktur),
    // panah ke Nilai TT untuk koreksi. setSelect = sorot saja.
    if (form.value.detail.length > 0) {
      nextTick(() => ttfSetSelect(0, "check"));
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

const onCheckChange = (d: TTFakturDetail) => {
  if (d.check === true) {
    d.nilai2 = d.nilai;
  } else {
    d.nilai2 = 0;
  }
};

// ── Detail column widths (shared by thead & tbody so they stay aligned) ──
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'nomorFaktur', width: null },   // takes the remaining width
  { key: 'tanggal', width: 100 },
  { key: 'nilai', width: 120 },
  { key: 'check', width: 60 },
  { key: 'nilai2', width: 130 },
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

const onNilai2Input = (e: Event, d: TTFakturDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['nilai2-' + idx] = el.value;
  d.nilai2 = parseInput(el.value);
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif TTF: check (toggle — nilai TT auto = nilai faktur)
// dan nilai2 (input). Urutan cols mengikuti urutan visual kolom tabel.
const ttfCellId = (c: string, r: number) => `ttf-cell-${c}-${r}`;

const ttfTypeEdit = (r: number, c: string, key: string) => {
  if (c !== "nilai2") return;
  const d = form.value.detail[r];
  if (!d) return;
  // Baris belum dicentang → alihkan sorotan ke kolom Check.
  if (d.check !== true) {
    ttfSetSelect(r, "check");
    return;
  }
  const el = document.getElementById(ttfCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`nilai2-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const ttfGrid = useDetailGrid({
  cols: ["check", "nilai2"],
  rowCount: () => form.value.detail.length,
  cellId: ttfCellId,
  cellPrefix: "ttf-cell",
  isToggle: (c) => c === "check",
  onToggle: (r) => {
    const d = form.value.detail[r];
    if (!d) return;
    d.check = d.check === true ? false : true;
    onCheckChange(d); // check=true → nilai2 = nilai; false → 0
  },
  typeEditCols: ["nilai2"],
  onTypeEdit: ttfTypeEdit,
});

const {
  focusCell: ttfFocusCell,
  gridBlur: ttfGridBlur,
  onGridCellFocus: ttfOnGridFocus,
  setSelect: ttfSetSelect,
  enterEdit: ttfEnterEdit,
} = ttfGrid;

const isActiveCell = (r: number, c: string) =>
  ttfFocusCell.value?.r === r && ttfFocusCell.value?.c === c;

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
};

const validateSave = () => {
  if (!form.value.slsKode) {
    toast.warning("Salesman harus diisi.");
    return;
  }
  if (!form.value.cusKode) {
    toast.warning("Customer harus diisi.");
    return;
  }

  const checkedItems = form.value.detail.filter((d) => d.check === true);
  if (checkedItems.length === 0) {
    toast.warning("Minimal satu faktur harus dicentang.");
    return;
  }

};

const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await ttFakturFormApi.save(form.value);
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
    return;
  }

  isLoading.value = true;
  try {
    const data = await ttFakturFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = data;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await loadOptions();
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah TT Faktur' : 'Tambah TT Faktur Baru'"
    :icon="IconFileCheck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="ttf-layout">
      <!-- ═══ HEADER ═══ -->
      <fieldset class="ttf-groupbox">
        <legend class="ttf-legend">Informasi TT Faktur</legend>
        <div class="ttf-groupbody">
          <div class="f-row">
            <label class="f-lbl">Nomor</label>
            <input :value="form.nomor" class="f-inp readonly-bg" readonly />
          </div>
          <div class="f-row">
            <label class="f-lbl">Salesman</label>
            <div class="search-group">
              <input :value="form.slsKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
              <input :value="form.slsNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Salesman..." />
              <button class="btn-search" type="button" @click="showSalesmanModal = true" :disabled="isEdit">
                <IconSearch :size="13" />
              </button>
            </div>
          </div>
          <div class="f-row">
            <label class="f-lbl">Customer</label>
            <div class="search-group">
              <input :value="form.cusKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
              <input :value="form.cusNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Customer..." />
              <button class="btn-search" type="button" @click="showCustomerModal = true; searchCustomer('')" :disabled="isEdit">
                <IconSearch :size="13" />
              </button>
            </div>
            <button class="btn-load" type="button" @click="loadInvoice" :disabled="!form.cusKode || isEdit">
              Load
            </button>
          </div>
        </div>
      </fieldset>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="ttf-groupbox ttf-detail-group">
        <legend class="ttf-legend">Daftar Faktur</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('nomorFaktur')">Nomor Faktur</th>
                  <th :style="detailColWidthStyle('tanggal')" class="tc">Tanggal</th>
                  <th :style="detailColWidthStyle('nilai')" class="tr">Nilai</th>
                  <th :style="detailColWidthStyle('check')" class="tc">Check</th>
                  <th :style="detailColWidthStyle('nilai2')" class="tr">Nilai TT</th>
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
                  <td class="mono" :style="detailColWidthStyle('nomorFaktur')">{{ d.nomorFaktur }}</td>
                  <td class="tc" :style="detailColWidthStyle('tanggal')">{{ d.tanggal }}</td>
                  <td class="tr" :style="detailColWidthStyle('nilai')">{{ fmt(d.nilai) }}</td>
                  <td class="tc" :id="ttfCellId('check', idx)" :class="{ 'cell-active': isActiveCell(idx, 'check') }" :style="detailColWidthStyle('check')">
                    <input v-model="d.check" type="checkbox" @change="onCheckChange(d)" />
                  </td>
                  <td :style="detailColWidthStyle('nilai2')">
                    <input
                      type="text"
                      inputmode="decimal"
                      class="cell-inp cell-inp-full tr bold accent"
                      :id="ttfCellId('nilai2', idx)"
                      :class="{ 'cell-active': isActiveCell(idx, 'nilai2') }"
                      :value="getInputValue('nilai2-' + idx, d.nilai2)"
                      @focus="ttfOnGridFocus('nilai2', idx); startEdit('nilai2-' + idx, $event, d.nilai2)"
                      @input="onNilai2Input($event, d, idx)"
                      @blur="endEdit('nilai2-' + idx, $event, d.nilai2); ttfGridBlur()"
                    />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" @click="removeRow(idx)">✕</button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="7" class="empty-state">
                    Pilih customer dan klik Load untuk memuat data.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

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

  <!-- ═══ MODAL CUSTOMER ═══ -->
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
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   TT FAKTUR — Classic Desktop Layout
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.ttf-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.ttf-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.ttf-legend {
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

.ttf-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.ttf-detail-group {
  flex: 1;
  min-height: 0;
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

/* ── Search Group ─────────────────────────────────────────────── */
.search-group {
  display: flex;
  gap: 2px;
  max-width: 300px;
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

.btn-search:disabled {
  background: var(--ds-text-muted, #8494A7);
  border-color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
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

.btn-del {
  background: none;
  border: none;
  color: var(--ds-danger, #c62828);
  cursor: pointer;
  font-weight: bold;
  padding: 2px 4px;
}

/* ── Cell Input ───────────────────────────────────────────────── */
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

.cell-inp-full {
  width: 100%;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
</style>