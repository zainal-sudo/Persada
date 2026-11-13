<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconTruck, IconRefresh, IconPlus, IconTrash } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  tagihanEkspedisiFormApi,
  type TagihanEkspedisiForm,
  type TagihanEkspedisiDetail,
} from "@/api/persediaan/tagihanEkspedisiFormApi";

const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const { handlePostSave } = useAfterSave({ onReset: () => resetForm() });

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<TagihanEkspedisiForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  tg1: today,
  tg2: today,
  namaEkspedisi: "",
  keterangan: "",
  detail: [],
});

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
    const data = await tagihanEkspedisiFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data tagihan ekspedisi.");
  } finally {
    isLoading.value = false;
  }
};

// Paritas Delphi getmaxkode: prefix KODE cabang, tanpa fallback.
const loadMaxNomor = async () => {
  try {
    form.value.nomor = await tagihanEkspedisiFormApi.getMaxNomor(
      form.value.tanggal,
      authStore.cabangKode
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor tagihan.");
  }
};

const addRow = () => {
  form.value.detail.push({
    no: form.value.detail.length + 1,
    nomor: "",
    nama: "",
    tanggal: today,
    nilai: 0,
    biaya: 0,
    uoc: 0,
  });
};

// ── Load FP ──────────────────────────────────────────────────────────
const loadFP = async () => {
  try {
    const items = await tagihanEkspedisiFormApi.loadFP(form.value.tg1, form.value.tg2);
    form.value.detail = items.map((item, i) => ({
      no: i + 1,
      nomor: item.nomor,
      nama: item.nama,
      tanggal: item.tanggal,
      nilai: Number(item.nilai),
      biaya: 0,
      uoc: 0,
    }));
    toast.success(`${items.length} data FP berhasil dimuat.`);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load data FP.");
  }
};

// ── Auto calculate UOC ───────────────────────────────────────────────
const hitungUOC = (d: TagihanEkspedisiDetail) => {
  d.uoc = d.nilai > 0 ? (d.biaya / d.nilai) * 100 : 0;
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Navigasi grid detail (ala Excel) — pola DOFormView ───────────────
const colToElId = (c: string, r: number) => `te-cell-${c}-${r}`;

const doTypeEdit = (r: number, c: string, key: string) => {
  const el = document.getElementById(colToElId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  if (c === "biaya") rawInputValues[`biaya-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const grid = useDetailGrid({
  cols: ["nomor", "nama", "tanggal", "biaya"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "te-cell",
  typeEditCols: ["nomor", "nama", "biaya"],
  onTypeEdit: doTypeEdit,
});

const {
  focusCell,
  gridBlur,
  onGridCellFocus,
} = grid;

const isActiveCell = (r: number, c: string) =>
  focusCell.value?.r === r && focusCell.value?.c === c;

// ── Input numerik Biaya — bebas ketik + auto UOC ─────────────────────
const rawInputValues: Record<string, string> = {};

const getInputValue = (key: string, modelValue: number, decimals = 0) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startBiayaEdit = (idx: number, e: Event, biaya: number) => {
  const key = `biaya-${idx}`;
  const val = biaya === 0 ? "" : String(biaya);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
  onGridCellFocus("biaya", idx);
};

const onBiayaInput = (e: Event, d: TagihanEkspedisiDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues[`biaya-${idx}`] = el.value;
  d.biaya = Number(el.value.replace(/,/g, "")) || 0;
  hitungUOC(d);
};

const endBiayaEdit = (key: string, e: Event, raw: number, d: TagihanEkspedisiDetail, idx: number) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(raw || 0);
  hitungUOC(d);
  gridBlur();
};

// ── Validasi ─────────────────────────────────────────────────────────
const validateSave = (): boolean => {
  if (!form.value.namaEkspedisi.trim()) {
    toast.warning("Nama Ekspedisi harus diisi.");
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
    await tagihanEkspedisiFormApi.save(form.value);
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
  form.value = { isEdit: false, nomor: "", tanggal: today, tg1: today, tg2: today, namaEkspedisi: "", keterangan: "", detail: [] };
  loadMaxNomor();
};

// ── Detail table column widths — header & body sinkron ───────────────
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'nomor', width: 130 },
  { key: 'nama', width: 220 },
  { key: 'tanggal', width: 100 },
  { key: 'nilai', width: 120 },
  { key: 'biaya', width: 100 },
  { key: 'uoc', width: 80 },
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
const fmtUOC = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

// ── Baris total (grand total) detail ──────────────────────────────────
const sumNilai = computed(() =>
  form.value.detail.reduce((s, d) => s + (Number(d.nilai) || 0), 0),
);
const sumBiaya = computed(() =>
  form.value.detail.reduce((s, d) => s + (Number(d.biaya) || 0), 0),
);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Tagihan Ekspedisi' : 'Tambah Tagihan Ekspedisi Baru'"
    :icon="IconTruck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="te-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="te-header-grid">
        <fieldset class="te-groupbox">
          <legend class="te-legend">Informasi Tagihan</legend>
          <div class="te-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Nama Ekspedisi <span class="req">*</span></label>
              <input v-model="form.namaEkspedisi" class="f-inp" maxlength="300" placeholder="Nama ekspedisi..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Keterangan</label>
              <input v-model="form.keterangan" class="f-inp" maxlength="300" placeholder="Keterangan..." />
            </div>
          </div>
        </fieldset>

        <fieldset class="te-groupbox">
          <legend class="te-legend">Periode FP</legend>
          <div class="te-groupbody">
            <div class="f-row">
              <label class="f-lbl">Tanggal Awal</label>
              <DsDatePicker v-model="form.tg1" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal Akhir</label>
              <DsDatePicker v-model="form.tg2" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl"></label>
              <button class="btn-load" type="button" @click="loadFP">
                <IconRefresh :size="13" /> Load
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="te-groupbox te-detail-group">
        <legend class="te-legend">Detail Tagihan</legend>
        <div class="te-detail-actions">
          <button class="btn-add-detail" type="button" @click="addRow">
            <IconPlus :size="13" /> Tambah Detail
          </button>
        </div>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('nomor')">Nomor</th>
                  <th :style="detailColWidthStyle('nama')">Nama Customer</th>
                  <th :style="detailColWidthStyle('tanggal')" class="tc">Tanggal</th>
                  <th :style="detailColWidthStyle('nilai')" class="tr">Nilai Belum PPn</th>
                  <th :style="detailColWidthStyle('biaya')" class="tr">Biaya</th>
                  <th :style="detailColWidthStyle('uoc')" class="tr">UOC</th>
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
                  <td :style="detailColWidthStyle('nomor')">
                    <input v-model="d.nomor" class="cell-inp" :id="'te-cell-nomor-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'nomor') }" @focus="onGridCellFocus('nomor', idx)" @blur="gridBlur()" />
                  </td>
                  <td :style="detailColWidthStyle('nama')">
                    <input v-model="d.nama" class="cell-inp" :id="'te-cell-nama-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'nama') }" @focus="onGridCellFocus('nama', idx)" @blur="gridBlur()" />
                  </td>
                  <td :style="detailColWidthStyle('tanggal')">
                    <DsDatePicker v-model="d.tanggal" variant="cell" :id="'te-cell-tanggal-' + idx" @focus="onGridCellFocus('tanggal', idx)" @blur="gridBlur()" />
                  </td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('nilai')">{{ fmt(d.nilai) }}</td>
                  <td :style="detailColWidthStyle('biaya')">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :id="'te-cell-biaya-' + idx" :class="{ 'cell-active': isActiveCell(idx, 'biaya') }" :value="getInputValue('biaya-' + idx, d.biaya, 0)" @focus="startBiayaEdit(idx, $event, d.biaya)" @input="onBiayaInput($event, d, idx)" @blur="endBiayaEdit('biaya-' + idx, $event, d.biaya, d, idx)" />
                  </td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('uoc')">{{ fmtUOC(d.uoc) }}</td>
                  <td class="tc" :style="detailColWidthStyle('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length" class="te-total-row">
                  <td colspan="4" class="tr">TOTAL</td>
                  <td class="tr">{{ fmt(sumNilai) }}</td>
                  <td class="tr">{{ fmt(sumBiaya) }}</td>
                  <td colspan="2" />
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="8" class="empty-state">Belum ada detail. Klik <strong>"+ Tambah Detail"</strong> atau <strong>Load</strong>.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   TAGIHAN EKSPEDISI — Classic Desktop Layout (pola DO/SO/FP Form)
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.te-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
  background: #FDFDFE;
}

.te-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.te-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.te-legend {
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

.te-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.te-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.te-detail-group .te-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.req { color: red; }

.btn-load {
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
  gap: 4px;
}

.btn-load:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.te-detail-actions {
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

/* Baris grand total detail (Σ Nilai & Σ Biaya) */
.detail-table tbody tr.te-total-row td {
  background: #E8ECF1;
  font-weight: 700;
  color: #0c4a6e;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}
.detail-table tbody tr.te-total-row:hover td {
  background: #E8ECF1;
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

@media (max-width: 1024px) {
  .te-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .te-layout {
    padding: 4px;
    gap: 4px;
  }
  .te-groupbody {
    padding: 6px;
    gap: 4px;
  }
}
</style>