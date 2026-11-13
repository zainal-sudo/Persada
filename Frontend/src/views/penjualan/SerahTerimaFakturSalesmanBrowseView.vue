<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { serahTerimaFakturSalesmanApi, type SerahTerimaFakturSalesmanRow, type SerahTerimaFakturSalesmanDetailRow } from "@/api/penjualan/serahTerimaFakturSalesmanApi";
import { IconFileCheck, IconFileSpreadsheet } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_serah_terima_faktur_salesman";

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
} = useBrowse<SerahTerimaFakturSalesmanRow>({
  fetchApi: () => serahTerimaFakturSalesmanApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => serahTerimaFakturSalesmanApi.delete(nomor),
  getDetailApi: (nomor: string) => serahTerimaFakturSalesmanApi.getDetail(nomor),
  exportTitle: "Serah Terima Faktur Salesman",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "SlsKode", title: "Sls Kode", width: 12 },
    { key: "Note", title: "Note", width: 25 },
  ],
  detailColumns: [
    { key: "Faktur", title: "Faktur", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "JthTempo", title: "Jth Tempo", width: 12, align: "center" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Customer", title: "Customer", width: 25 },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "SlsKode", title: "Sls Kode", width: "100px" },
  { key: "Note", title: "Note", minWidth: "200px" },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, SerahTerimaFakturSalesmanDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = { ...detailMap.value, [nomor]: await serahTerimaFakturSalesmanApi.getDetail(nomor) };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/penjualan/serah-terima-faktur-salesman/create");
const onEdit = (item: SerahTerimaFakturSalesmanRow) => router.push(`/penjualan/serah-terima-faktur-salesman/edit/${encodeURIComponent(item.Nomor)}`);

const onDelete = async (item: SerahTerimaFakturSalesmanRow) => {
  try {
    await serahTerimaFakturSalesmanApi.delete(item.Nomor);
    toast.success("Data berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  }
};

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
</script>

<template>
  <BaseBrowse
    title="Serah Terima Faktur Salesman"
    :icon="IconFileCheck"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    item-value="Nomor"
    v-model:selected="selected"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.Tanggal="{ value }">{{ fmtDate(value) }}</template>

    <template #detail="{ item }">
      <div class="detail-wrap">
        <div v-if="expandedLoading[item.Nomor]" class="detail-loading">
          <v-progress-circular indeterminate color="primary" size="18" />
          <span>Memuat rincian...</span>
        </div>
        <table v-else class="detail-tbl">
          <thead>
            <tr>
              <th style="width: 170px">Faktur</th>
              <th style="width: 100px" class="tc">Tanggal</th>
              <th style="width: 100px" class="tc">Jth Tempo</th>
              <th style="width: 120px" class="tr">Nilai</th>
              <th style="min-width: 180px">Customer</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Faktur }}</td>
              <td class="tc">{{ fmtDate(d.Tanggal) }}</td>
              <td class="tc">{{ fmtDate(d.JthTempo) }}</td>
              <td class="tr bold accent">{{ fmt(d.Nilai) }}</td>
              <td>{{ d.Customer }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="5" class="empty-td">Tidak ada detail.</td>
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
    @export-header="exportHeaderOnly('SerahTerimaFakturSalesman')"
    @export-detail="exportDetailOnly('SerahTerimaFakturSalesman')"
  />
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }
.date-inp { height: 32px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 8px; font-size: 12px; outline: none; width: 130px; }
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }

.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }

.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>