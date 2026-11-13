<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  jurnalUmumApi,
  type JurnalUmumRow,
  type JurnalUmumDetailRow,
} from "@/api/bukubesar/jurnalUmumApi";
import { useBrowse } from "@/composables/useBrowse";
import ExportDialog from "@/components/ExportDialog.vue";
import { IconBook2, IconFileSpreadsheet, IconPrinter } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

// ── Periode (sessionStorage persist) ─────────────────────────────────
const STORAGE_KEY = "bukubesar_periode_jurnal_umum";

const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.startDate && s?.endDate) return s;
  } catch {}
  return null;
};

const now = new Date();
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const saved = getSaved();

const startDate = ref(saved?.startDate ?? getLocal(firstDay));
const endDate = ref(saved?.endDate ?? getLocal(now));

// ── useBrowse (Permission + Data) ────────────────────────────────────
const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  showExportDialog,
  isExporting,
  handleExport,
  exportHeaderOnly,
  exportDetailOnly,
  fetchData,
} = useBrowse<JurnalUmumRow>({
  fetchApi: () => jurnalUmumApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => jurnalUmumApi.delete(nomor),
  getDetailApi: (nomor: string) => jurnalUmumApi.getDetail(nomor),
  exportTitle: "Jurnal Umum",
  columns: [
    { key: "Nomor", title: "Nomor", width: 15 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Keterangan", title: "Keterangan", width: 30 },
    { key: "IsClosed", title: "Closed", width: 10, align: "center" },
    { key: "NilaiDebet", title: "Nilai Debet", width: 16, numFmt: "#,##0" },
    { key: "NilaiKredit", title: "Nilai Kredit", width: 16, numFmt: "#,##0" },
  ],
  detailColumns: [
    { key: "Account", title: "Account", width: 12 },
    { key: "AccountName", title: "Nama Account", width: 30 },
    { key: "Debet", title: "Debet", width: 16, numFmt: "#,##0" },
    { key: "Kredit", title: "Kredit", width: 16, numFmt: "#,##0" },
    { key: "CostCenter", title: "Cost Center", width: 15 },
  ],
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "100px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Keterangan", title: "Keterangan", width: "200px" },
  { key: "IsClosed", title: "Closed", width: "80px", align: "center" as const },
  { key: "NilaiDebet", title: "Nilai Debet", width: "120px", align: "right" as const },
  { key: "NilaiKredit", title: "Nilai Kredit", width: "120px", align: "right" as const },
];

// ── Watch periode → fetch data ───────────────────────────────────────
watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startDate: s, endDate: e })
    );
  } catch {}
});

// ── Expand Detail ────────────────────────────────────────────────────
const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, JurnalUmumDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = {
        ...detailMap.value,
        [nomor]: await jurnalUmumApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

// ── Actions ──────────────────────────────────────────────────────────
const onAdd = () => {
  router.push({ name: "jurnalUmumCreate" });
};

const onEdit = (item: JurnalUmumRow) => {
  router.push({
    name: "jurnalUmumEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

const onDelete = async (item: JurnalUmumRow) => {
  try {
    await jurnalUmumApi.delete(item.Nomor);
    toast.success("Data berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  }
};

// ── Cetak (browser A5 print view terpisah, pola PenerimaanLain/PembayaranLain) ──
const doCetak = () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data jurnal terlebih dahulu.");
    return;
  }
  const item = (selected.value as any[])[0];
  router.push(`/bukubesar/jurnal-umum/print/${encodeURIComponent(item.Nomor)}`);
};

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch { return val; }
};


</script>

<template>
  <BaseBrowse
    title="Jurnal Umum"
    :icon="IconBook2"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Nomor"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    search-placeholder="Cari jurnal umum..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
    :print-fn="() => doCetak()"
  >
    <!-- Filter Periode -->
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        class="tb-btn tb-btn-edit"
        :disabled="!isSingleSelected"
        @click="doCetak"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F12]</span> Cetak
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <!-- Custom Cells -->
    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.IsClosed="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
      </span>
    </template>

    <template #item.NilaiDebet="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>

    <template #item.NilaiKredit="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>

    <!-- Expanded Detail -->
    <template #detail="{ item }">
      <div class="detail-wrap">
        <div v-if="expandedLoading[item.Nomor]" class="detail-loading">
          <v-progress-circular indeterminate color="primary" size="18" />
          <span>Memuat rincian...</span>
        </div>
        <table v-else class="detail-tbl">
          <thead>
            <tr>
              <th style="width: 80px">Nomor</th>
              <th style="width: 80px">Account</th>
              <th style="min-width: 200px">Nama Account</th>
              <th style="width: 100px" class="tr">Debet</th>
              <th style="width: 100px" class="tr">Kredit</th>
              <th style="width: 120px">Cost Center</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td>{{ d.Nomor }}</td>
              <td class="mono">{{ d.Account }}</td>
              <td class="bold">{{ d.AccountName }}</td>
              <td class="tr">{{ fmt(d.Debet) }}</td>
              <td class="tr">{{ fmt(d.Kredit) }}</td>
              <td>{{ d.CostCenter }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="6" class="empty-td">Tidak ada detail.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <!-- Export Dialog -->
  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('JurnalUmum')"
    @export-detail="exportDetailOnly('JurnalUmum')"
  />
</template>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-lbl {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.filter-sep {
  font-size: 12px;
  color: #9ca3af;
}

.date-inp {
  height: 32px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  width: 130px;
}

.date-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.badge-closed {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #616161;
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}

.badge-open {
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #0284c7);
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}

.num-cell {
  font-variant-numeric: tabular-nums;
}

.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }

.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>