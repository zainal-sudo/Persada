<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  penyesuaianStokApi,
  type PenyesuaianStokRow,
  type PenyesuaianStokDetailRow,
} from "@/api/persediaan/penyesuaianStokApi";
import { useBrowse } from "@/composables/useBrowse";
import ExportDialog from "@/components/ExportDialog.vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileSpreadsheet } from "@tabler/icons-vue";
import { IconAdjustments } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const STORAGE_KEY = "persediaan_periode_penyesuaian_stok";
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

const isFinance = computed(() => authStore.userKode?.toUpperCase() === "FINANCE");

const {
  items, isLoading, selected, canInsert, canExport, fetchData,
} = useBrowse<PenyesuaianStokRow>({
  fetchApi: () => penyesuaianStokApi.getBrowse(startDate.value, endDate.value),
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "100px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Gudang", title: "Gudang", width: "200px" },
  { key: "Keterangan", title: "Keterangan", width: "200px" },
  ...(isFinance.value
    ? [
        { key: "Total", title: "Total", width: "80px", align: "right" as const },
        { key: "Total_Price", title: "Total Price", width: "80px", align: "right" as const },
      ]
    : []),
];

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, PenyesuaianStokDetailRow[]>>({});
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
        [nomor]: await penyesuaianStokApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => {
  router.push({ name: "penyesuaianStokCreate" });
};

const onEdit = (item: PenyesuaianStokRow) => {
  router.push({
    name: "penyesuaianStokEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
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

// ── Export ───────────────────────────────────────────────────────────
const showExportDialog = ref(false);
const isExporting = ref(false);

const headerCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"Tanggal","title":"Tanggal","width":12,"align":"center"},{"key":"Gudang","title":"Gudang","width":25},{"key":"Keterangan","title":"Keterangan","width":25},{"key":"Total","title":"Total","width":14,"numFmt":"#,##0"}];
const detailCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"Kode","title":"Kode","width":15},{"key":"Nama","title":"Nama","width":30},{"key":"Expired","title":"Expired","width":12,"align":"center"},{"key":"Satuan","title":"Satuan","width":10,"align":"center"},{"key":"QtyKorksi","title":"Qty Koreksi","width":12,"numFmt":"#,##0"},{"key":"Nilai","title":"Nilai","width":14,"numFmt":"#,##0"}];

const doExportHeader = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r: any) => ({
      ...r,
      Tanggal: r.Tanggal ? fmtDate(r.Tanggal) : r.Tanggal,
      Expired: r.Expired ? fmtDate(r.Expired) : r.Expired,
    }));
    exportStyledHeader({
      title: "Penyesuaian Stok",
      columns: headerCols,
      items: exportItems,
      fileName: `PenyesuaianStok_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Penyesuaian Stok",
    });
  } finally { isExporting.value = false; }
};

const doExportDetail = async () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const allDetail: any[] = [];
    for (const item of items.value) {
      try {
        const d = await penyesuaianStokApi.getDetail(item.Nomor);
        allDetail.push(...d);
      } catch { /* skip */ }
    }
    exportStyledHeader({
      title: "Penyesuaian Stok",
      columns: detailCols,
      items: allDetail,
      fileName: `PenyesuaianStok_Detail_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Penyesuaian Stok - Detail",
    });
  } finally { isExporting.value = false; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Penyesuaian Stok"
    :icon="IconAdjustments"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Nomor"
    :can-insert="canInsert"
    :can-edit="false"
    :can-delete="false"
    :can-export="canExport"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    :summary-key="isFinance ? 'Total' : ''"
    summary-label="Total"
    search-placeholder="Cari penyesuaian stok..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="showExportDialog = true">
        <template #prepend>
          <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>
    <template #item.Total="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template v-if="isFinance" #item.Total_Price="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>

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
              <th style="width: 80px">Kode</th>
              <th style="min-width: 200px">Nama</th>
              <th style="width: 80px" class="tc">Expired</th>
              <th style="width: 70px" class="tc">Satuan</th>
              <th style="width: 80px" class="tr">Qty Koreksi</th>
              <th v-if="isFinance" style="width: 100px" class="tr">Nilai</th>
              <th v-if="isFinance" style="width: 100px" class="tr">Nilai Price</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td>{{ d.Nomor }}</td>
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tc">{{ fmtDate(d.Expired) }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmt(d.QtyKorksi) }}</td>
              <td v-if="isFinance" class="tr">{{ fmt(d.Nilai) }}</td>
              <td v-if="isFinance" class="tr">{{ fmt(d.Nilai_Price) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td :colspan="isFinance ? 8 : 6" class="empty-td">Tidak ada detail.</td>
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
    @export-header="doExportHeader"
    @export-detail="doExportDetail"
  />
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; }
.filter-lbl { font-size: 12px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); white-space: nowrap; }
.filter-sep { font-size: 12px; color: var(--ds-text-muted, #8494A7); }
.date-inp {
  height: 32px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 130px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: var(--ds-text-muted, #8494A7); }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: var(--ds-primary-50, #E8EDF5); }
.empty-td { text-align: center; color: var(--ds-text-muted, #8494A7); font-style: italic; padding: 12px; }
</style>