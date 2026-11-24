<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { fakturPajakFormApi, type FakturPajakForm, type FakturPajakFormDetail } from "@/api/penjualan/fakturPajakFormApi";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { watchUnsavedInput } from "@/composables/useUnsavedForms";
import { IconFileInvoice, IconRefresh, IconCheck, IconX } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const today = new Date().toISOString().slice(0, 10);

const form = ref<FakturPajakForm>({
  tanggal: today,
  tanggal2: today,
  nomorPajak: "",
  tanggalPajak: today,
  isManual: 0,
  detail: [],
});

const isLoading = ref(false);
const isSaving = ref(false);

// Isian form ini dicatat supaya muat ulang otomatis tidak menghapusnya.
// Form ini tidak memakai BaseForm, jadi area field-nya didaftarkan sendiri.
const filterEl = ref<HTMLElement | null>(null);
const gridEl = ref<HTMLElement | null>(null);
watchUnsavedInput(filterEl, gridEl);

const loadData = async () => {
  isLoading.value = true;
  try {
    const data = await fakturPajakFormApi.refresh(
      form.value.tanggal,
      form.value.tanggal2,
      form.value.isManual
    );
    form.value.detail = data;

    // Pola DOFormView: setelah data termuat, sorot sel Status baris pertama —
    // user tinggal Space/Enter untuk centang. setSelect = sorot saja.
    if (form.value.detail.length > 0) {
      nextTick(() => fpjSetSelect(0, "status"));
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Navigasi grid (pola DOFormView — keyboard-first) ────────────────
// Form proses batch: kolom interaktif hanya Status & Negeri (toggle).
// Enter/Space men-toggle centang; panah pindah baris/kolom (wrap).
const fpjCellId = (c: string, r: number) => `fpj-cell-${c}-${r}`;

const fpjGrid = useDetailGrid({
  cols: ["status", "negeri"],
  rowCount: () => form.value.detail.length,
  cellId: fpjCellId,
  cellPrefix: "fpj-cell",
  isToggle: (c) => c === "status" || c === "negeri",
  onToggle: (r, c) => {
    const d = form.value.detail[r];
    if (!d) return;
    if (c === "status") d.status = Number(d.status) === 1 ? 0 : 1;
    else d.negri = Number(d.negri) === 1 ? 0 : 1;
  },
});

const {
  focusCell: fpjFocusCell,
  setSelect: fpjSetSelect,
} = fpjGrid;

const isActiveCell = (r: number, c: string) =>
  fpjFocusCell.value?.r === r && fpjFocusCell.value?.c === c;

const onProses = () => {
  if (!form.value.nomorPajak.trim()) {
    toast.warning("Nomor pajak harus diisi.");
    return;
  }

  let i = 1;
  for (const d of form.value.detail) {
    if (d.status === 1) {
      let negri = "010";
      if (d.negri === 1) {
        negri = "020";
      } else if (d.isDTP === 1) {
        negri = "070";
      }

      const baseNomor = form.value.nomorPajak.substring(0, form.value.nomorPajak.length - 8);
      const lastNum = parseInt(form.value.nomorPajak.substring(form.value.nomorPajak.length - 8)) + i;
      d.noPajak = `${negri}.${baseNomor}${String(lastNum).padStart(8, "0")}`;
      d.tanggalPajak = form.value.tanggalPajak;
      i++;
    }
  }
};

const checkAll = () => {
  form.value.detail.forEach((d) => (d.status = 1));
};

const uncheckAll = () => {
  form.value.detail.forEach((d) => (d.status = 0));
};

const saveData = async () => {
  const checkedItems = form.value.detail.filter((d) => d.status === 1);
  if (checkedItems.length === 0) {
    toast.warning("Tidak ada data yang dicentang.");
    return;
  }

  isSaving.value = true;
  try {
    await fakturPajakFormApi.save(form.value);
    toast.success("Faktur pajak berhasil disimpan.");
    await loadData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

const onClose = () => {
  router.push({ name: "fakturPajakBrowse" });
};

onMounted(() => {
  loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return ;
  } catch { return val; }
};
</script>

<template>
  <PageLayout title="Input Faktur Pajak" :icon="IconFileInvoice">
    <template #header-actions>
      <v-btn size="small" class="tb-btn tb-btn-edit" @click="loadData" :loading="isLoading">
        <template #prepend><IconRefresh :size="14" :stroke-width="1.8" /></template>
        Refresh
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" @click="onProses">
        <template #prepend><IconCheck :size="14" :stroke-width="1.8" /></template>
        Proses
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-neutral" @click="saveData" :loading="isSaving">
        Simpan
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-danger" @click="onClose">
        <template #prepend><IconX :size="14" :stroke-width="2.2" /></template>
        Tutup
      </v-btn>
    </template>

    <!-- ═══ FILTER SECTION ═══ -->
    <div class="fp-filter" ref="filterEl">
      <div class="f-row">
        <label class="f-lbl">Tanggal</label>
        <DsDatePicker v-model="form.tanggal" variant="form" />
        <span class="f-sep">s/d</span>
        <DsDatePicker v-model="form.tanggal2" variant="form" />
      </div>
      <div class="f-row">
        <label class="f-lbl">Nomor Pajak</label>
        <input v-model="form.nomorPajak" class="f-inp" placeholder="Masukkan nomor pajak..." />
      </div>
      <div class="f-row">
        <label class="f-lbl">Tgl Pajak</label>
        <DsDatePicker v-model="form.tanggalPajak" variant="form" />
      </div>
      <div class="f-row">
        <label class="check-lbl">
          <input v-model="form.isManual" type="checkbox" :true-value="1" :false-value="0" @change="loadData" />
          Faktur Manual
        </label>
      </div>
      <div class="f-row">
        <v-btn size="small" variant="text" @click="checkAll">Check All</v-btn>
        <v-btn size="small" variant="text" @click="uncheckAll">Uncheck All</v-btn>
      </div>
    </div>

    <!-- ═══ GRID ═══ -->
    <div class="fp-grid" ref="gridEl">
      <table class="fp-table">
        <thead>
          <tr>
            <th style="width: 36px" class="tc">No</th>
            <th style="width: 120px">Salesman</th>
            <th style="min-width: 150px">Customer</th>
            <th style="width: 150px">Invoice</th>
            <th style="width: 100px" class="tc">Tgl Faktur</th>
            <th style="width: 100px" class="tr">PPN</th>
            <th style="width: 120px" class="tr">Nilai</th>
            <th style="width: 60px" class="tc">Status</th>
            <th style="width: 60px" class="tc">Negeri</th>
            <th style="width: 60px" class="tc">Manual</th>
            <th style="width: 150px">No Pajak</th>
            <th style="width: 100px" class="tc">Tgl Pajak</th>
            <th style="width: 50px" class="tc">DTP</th>
            <th style="width: 60px" class="tc">Retur</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, idx) in form.detail" :key="idx">
            <td class="tc">{{ idx + 1 }}</td>
            <td>{{ d.salesman }}</td>
            <td>{{ d.customer }}</td>
            <td class="mono">{{ d.invoice }}</td>
            <td class="tc">{{ d.tanggal }}</td>
            <td class="tr">{{ fmt(d.ppn) }}</td>
            <td class="tr">{{ fmt(d.nilai) }}</td>
            <td class="tc" :id="fpjCellId('status', idx)" :class="{ 'cell-active': isActiveCell(idx, 'status') }">
              <input v-model="d.status" type="checkbox" :true-value="1" :false-value="0" />
            </td>
            <td class="tc" :id="fpjCellId('negeri', idx)" :class="{ 'cell-active': isActiveCell(idx, 'negeri') }">
              <input v-model="d.negri" type="checkbox" :true-value="1" :false-value="0" />
            </td>
            <td class="tc">
              <input v-model="d.ismanual" type="checkbox" :true-value="1" :false-value="0" disabled />
            </td>
            <td class="mono">{{ d.noPajak }}</td>
            <td class="tc">{{ d.tanggalPajak ? fmtDate(d.tanggalPajak) : "-" }}</td>
            <td class="tc">{{ d.isDTP === 1 ? "Ya" : "Tidak" }}</td>
            <td class="tc">{{ d.adaRetur === 1 ? "Ya" : "Tidak" }}</td>
          </tr>
          <tr v-if="form.detail.length === 0">
            <td colspan="14" class="tc" style="color: #9e9e9e; font-style: italic; padding: 12px;">
              Klik Refresh untuk memuat data.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PageLayout>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   FAKTUR PAJAK INPUT — Classic Desktop Layout
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.fp-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 12px;
  background: var(--ds-surface, #F0F3F8);
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  flex-shrink: 0;
  align-items: center;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.f-lbl {
  width: 70px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.f-inp {
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  min-width: 130px;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-sep {
  font-size: 11px;
  color: #9ca3af;
}

.check-lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  cursor: pointer;
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 14px;
  height: 14px;
}

.fp-grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px;
}

.fp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-weight: 500;
}

.fp-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.fp-table th {
  color: white;
  font-weight: 700;
  padding: 4px 6px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
  border-bottom: 1px solid var(--ds-primary-dark, #0369a1);
}

.fp-table th:last-child {
  border-right: none;
}

.fp-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle;
  white-space: nowrap;
}

.fp-table td:last-child {
  border-right: none;
}

.fp-table tbody tr:nth-child(odd) {
  background: #F0F3F8;
}

.fp-table tbody tr:nth-child(even) {
  background: #E4EBF4;
}

.fp-table tbody tr:hover td {
  background: #D8E2EF;
}

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
</style>