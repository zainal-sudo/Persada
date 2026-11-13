<script setup lang="ts">
import MsIcon from "@/components/MsIcon.vue";
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { itemMarginMinusApi, type ItemMarginMinusRow } from "@/api/laporan/itemMarginMinusApi";
import TinyPivotOnly from "@/components/TinyPivotOnly.vue";
import { usePivotExport } from "@/composables/usePivotExport";
import { IconList, IconTable, IconChartBar, IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { useAuthStore } from "@/stores/authStore";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();
const authStore = useAuthStore();
// HPP/Lastcost/Margin hanya untuk FINANCE.
const isFinanceUser = computed(() => authStore.userKode.toUpperCase() === "FINANCE");
// ── Export Pivot ────────────────────────────────────────────────────
const { pivotRef, isPivotExporting, doExportPivot } = usePivotExport({
  title: "List Item Margin Minus (Lastcost)",
  subtitle: () => `Periode ${startDate.value} s/d ${endDate.value}`,
  fileName: "ListItemMinus_Pivot",
});

// ── Periode ───────────────────────────────────────────────────────────
const STORAGE_KEY = "laporan_periode_itemMarginMinus";
const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const now = new Date();
const today = getLocal(now);

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.startDate && s?.endDate) return s;
  } catch {}
  return null;
};
const saved = getSaved();

// Delphi FormShow: startdate & enddate default tengah = hari ini
// Filter customer di Delphi Visible=False -> hanya periode
const filterState = ref({
  startDate: saved?.startDate ?? today,
  endDate: saved?.endDate ?? today,
});

const startDate = computed({
  get: () => filterState.value.startDate,
  set: (v) => { filterState.value = { ...filterState.value, startDate: v }; },
});
const endDate = computed({
  get: () => filterState.value.endDate,
  set: (v) => { filterState.value = { ...filterState.value, endDate: v }; },
});
watch(filterState, (val) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {}
}, { deep: true });

const filterValues = computed(() => ({
  startDate: filterState.value.startDate,
  endDate: filterState.value.endDate,
}));

// ── Tab ───────────────────────────────────────────────────────────────
const activeTab = ref<"grid" | "pivot" | "chart">("grid");

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<ItemMarginMinusRow[]>([]);
const filteredItems = computed(() => items.value);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await itemMarginMinusApi.getBrowse(filterState.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Headers (mengikuti Delphi loaddata) ──────────────────────────────
const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "Kode", title: "Kode", width: "110px" },
  { key: "Nama", title: "Nama", minWidth: "200px" },
  { key: "Nomor_DO", title: "Nomor DO", width: "140px" },
  { key: "Nomor", title: "Nomor", minWidth: "130px" },
  { key: "Tanggal", title: "Tanggal", width: "110px", align: "center" },
  { key: "Customer", title: "Customer", minWidth: "170px" },
  ...(isFinanceUser.value
    ? [
        { key: "hpp", title: "HPP", width: "120px", align: "end" as const },
      ]
    : []),
  { key: "net", title: "Net", width: "130px", align: "end" },
  ...(isFinanceUser.value
    ? [
        { key: "Lastcost", title: "Lastcost", width: "130px", align: "end" as const },
      ]
    : []),
];

// Kolom uang (Delphi: rata kanan + format ###,###,###)
const moneyKeys = isFinanceUser.value ? ["hpp", "net", "Lastcost"] : ["net"];

const fmtMoney = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

// ── Footer (Delphi: skSum utk kolom uang) ────────────────────────────
const footer = computed(() => {
  const labels = new Map<string, string>();
  labels.set("Kode", "Total");
  labels.set("Nomor", `${items.value.length} baris`);
  return { labels };
});

// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Tanggal", title: "Tanggal", width: 14, align: "center" },
  { key: "Nomor", title: "Nomor", width: 16 },
  { key: "Customer", title: "Customer", width: 22 },
  { key: "Salesman", title: "Salesman", width: 14 },
  { key: "SKU", title: "SKU", width: 12 },
  { key: "NamaBarang", title: "Nama Barang", width: 25 },
  { key: "Harga", title: "Harga", width: 14, numFmt: "#,##0" },
  ...(isFinanceUser.value
    ? [
        { key: "LastCost", title: "Last Cost", width: 14, numFmt: "#,##0" },
        { key: "Margin", title: "Margin", width: 12, numFmt: "#,##0" },
      ]
    : []),
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r) => ({ ...r, Tanggal: fmtDate(r.Tanggal) }));
    await exportStyledHeader({ title: "List Item Margin Minus (Lastcost)", subtitle: `Periode: ${filterState.value.startDate} s/d ${filterState.value.endDate}`, columns: exportColumns, items: exportItems as unknown as Record<string, any>[], fileName: "ListItemMinus" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

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

// ── Pivot Data ────────────────────────────────────────────────────────
// Delphi (loaddata): SetPivot TIDAK ada (dikomentari) -> default asumsi:
// Baris Customer, nilai Net (penjualan di bawah lastcost). Bisa diubah.
// Field pivot = semua kolom item (grid), tanpa map manual.
// Field pivot = semua kolom item (grid); non-FINANCE tanpa HPP/Lastcost.
const pivotData = computed(() =>
  isFinanceUser.value
    ? items.value
    : items.value.map(({ hpp, Lastcost, ...rest }: any) => rest),
);

// ── Chart ─────────────────────────────────────────────────────────────
const chartType = ref<"column" | "bar" | "line" | "area" | "pie">("column");
const chartCanvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: any = null;

const getPivotConfig = () => ({
  rows: ["Customer"] as string[],
  cols: ["Kode"] as string[],
  vals: ["net"] as string[],
  aggregatorName: "Sum",
});

const chartData = computed(() => {
  const { vals, aggregatorName } = getPivotConfig();
  const plainData = items.value as Record<string, any>[];
  const valField = vals[0] ?? "net";

  const map = new Map<string, number>();
  for (const item of plainData) {
    const rowLabel = item["Customer"] ?? "Unknown";
    const val = Number(item[valField]) || 0;
    if (aggregatorName === "Count") map.set(rowLabel, (map.get(rowLabel) ?? 0) + 1);
    else map.set(rowLabel, (map.get(rowLabel) ?? 0) + val);
  }

  const sorted = [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    labels: sorted.map((r) => r.label),
    datasets: [{ label: "Net", data: sorted.map((r) => r.total) }],
  };
});

watch([activeTab, chartData, chartType], async ([tab]) => {
  if (tab !== "chart") return;
  await nextTick();
  if (!chartCanvasRef.value) return;

  const {
    Chart, BarController, LineController, PieController,
    BarElement, LineElement, PointElement, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend, Filler,
  } = await import("chart.js");
  Chart.register(
    BarController, LineController, PieController,
    BarElement, LineElement, PointElement, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend, Filler,
  );

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const palette = [
    { bg: "rgba(46,125,50,0.75)", border: "#2e7d32" },
    { bg: "rgba(198,40,40,0.65)", border: "#c62828" },
    { bg: "rgba(21,101,192,0.65)", border: "#1565c0" },
    { bg: "rgba(2,132,199,0.65)", border: "#0284c7" },
  ];

  const { labels, datasets } = chartData.value;

  if (chartType.value === "pie") {
    const pieData = chartData.value.labels.map((_, i) =>
      datasets.reduce((s, ds) => s + (ds.data[i] ?? 0), 0),
    );
    chartInstance = new Chart(chartCanvasRef.value, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          label: "Total",
          data: pieData,
          backgroundColor: labels.map((_, i) => palette[i % palette.length].bg),
          borderColor: labels.map((_, i) => palette[i % palette.length].border),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${new Intl.NumberFormat("id-ID").format(ctx.parsed ?? 0)}` } },
        },
      },
    });
    return;
  }

  const isHorizontalBar = chartType.value === "bar";
  const baseType = chartType.value === "line" || chartType.value === "area" ? "line" : "bar";

  chartInstance = new Chart(chartCanvasRef.value, {
    type: baseType,
    data: {
      labels,
      datasets: datasets.map((ds, idx) => {
        const color = palette[idx % palette.length];
        if (baseType === "line") {
          return {
            label: ds.label, data: ds.data,
            borderColor: color.border,
            backgroundColor: chartType.value === "area" ? color.bg : color.border,
            fill: chartType.value === "area", tension: 0.25, pointRadius: 2,
          };
        }
        return { label: ds.label, data: ds.data, backgroundColor: color.bg, borderColor: color.border, borderWidth: 1 };
      }),
    },
    options: {
      indexAxis: isHorizontalBar ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${new Intl.NumberFormat("id-ID").format((isHorizontalBar ? ctx.parsed.x : ctx.parsed.y) ?? 0)}`,
          },
        },
      },
      scales: {
        [isHorizontalBar ? "x" : "y"]: {
          ticks: { callback: (v) => new Intl.NumberFormat("id-ID", { notation: "compact" }).format(Number(v)) },
        },
        [isHorizontalBar ? "y" : "x"]: { ticks: { maxRotation: 35, font: { size: 10 } } },
      },
    },
  });
});

const hasChartData = computed(() => chartData.value.labels.length > 0);
</script>

<template>
  <div class="rp-wrap">
<fieldset class="ff-bar">
  <div class="filter-bar">

        <div class="filter-group">
          <span class="filter-lbl">Filter Periode</span>
          <DsDatePicker v-model="startDate" variant="toolbar" />
          <span class="filter-sep">s/d</span>
          <DsDatePicker v-model="endDate" variant="toolbar" />
        </div>
      
      
        <div class="filter-divider" />
        <div class="tab-wrap">
          <button class="tab-btn" :class="{ active: activeTab === 'grid' }" @click="activeTab = 'grid'">
            <IconTable :size="13" :stroke-width="1.8" /> Grid Data
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'pivot' }" @click="activeTab = 'pivot'">
            <IconList :size="13" :stroke-width="1.8" /> Pivot
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'chart' }" @click="activeTab = 'chart'">
            <IconChartBar :size="13" :stroke-width="1.8" /> Grafik
          </button>
        </div>
      

      <v-btn class="tb-btn tb-btn-neutral" size="small" :loading="isLoading" @click="loadData">
        <template #prepend><MsIcon name="refresh" :size="13" /></template>
        <span class="tb-fkey">[F5]</span> Load
      </v-btn>

      <v-spacer />

      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" :loading="activeTab === 'grid' ? isExporting : isPivotExporting" @click="activeTab === 'grid' ? doExport() : doExportPivot()">
        <template #prepend><IconFileSpreadsheet :size="14" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
  </div>
</fieldset>
  <!-- ── Grid tab ── -->
  <div v-show="activeTab === 'grid'" class="grid-tab">
    <BaseBrowse
      :show-filter-bar="false"
      title="List Item Margin Minus (Lastcost)"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="Nomor"
      :filter-values="filterValues"
      :auto-refresh="false"
      
,
      @refresh="loadData"
    >
<template #item.Tanggal="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template v-for="k in moneyKeys" :key="'cell-' + k" #[`item.${k}`]="{ value }">
        <span class="num-cell">{{ fmtMoney(value) }}</span>
      </template>

      <template #summary-row>
        <span class="sum-lbl">{{ footer.labels.get('Kode') }}</span>
        <span class="sum-val">{{ footer.labels.get('Nomor') }}</span>
      </template>
    </BaseBrowse>
  </div>

  <!-- ── Pivot & Chart tab ── -->
  <div v-show="activeTab !== 'grid'" class="rp-panel">
    

    <div v-show="activeTab === 'pivot'" class="tab-inner">
        <div v-if="isLoading" class="tab-loading">
          <v-progress-circular indeterminate color="primary" size="36" />
          <span>Memuat data...</span>
        </div>
        <div v-else-if="!items.length" class="tab-empty">
          Tidak ada data untuk periode ini.
        </div>
        <div v-else class="pivot-wrapper">
          <div class="pivot-container">
            <TinyPivotOnly
              ref="pivotRef"
              :data="pivotData"
              theme="light"
              font-size="sm"
              class="tiny-pivot-itemmarginminus"
            />
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div v-show="activeTab === 'chart'" class="tab-inner">
        <div v-if="isLoading" class="tab-loading">
          <v-progress-circular indeterminate color="primary" size="36" />
        </div>
        <div v-else-if="!hasChartData" class="tab-empty">
          Tidak ada data untuk periode ini.
        </div>
        <div v-else class="chart-wrap">
          <div class="chart-header">
            <div class="chart-title">Net penjualan below-cost berdasarkan Customer (20 terbesar)</div>
            <select v-model="chartType" class="chart-type-select">
              <option value="column">Column</option>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          <div class="chart-container">
            <canvas ref="chartCanvasRef" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-tab { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; }
.date-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 128px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.filter-divider {
  width: 1px; height: 24px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0; margin: 0 4px;
}

.tab-wrap {
  display: flex; align-items: center; gap: 2px;
  background: rgba(var(--v-border-color), 0.06);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 3px;
}
.tab-btn {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 10px;
  border: none; background: transparent; font-size: 11px; font-weight: 600;
  color: #6b7280; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.tab-btn:hover { background: rgba(59, 89, 152, 0.08); color: var(--ds-primary, #0284c7); }
.tab-btn.active { background: var(--ds-primary, #0284c7); color: white; }

.lap-layout { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 8px 12px; gap: 6px; }
.ff-bar {
  border: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
  border-radius: 0; padding: 4px; margin: 0;
  flex-shrink: 0; box-shadow: none; min-width: 0;
}
.ff-bar .filter-bar {
  display: flex; align-items: center; gap: 8px;
  background: transparent; border: none; border-radius: 0;
  padding: 0; flex-shrink: 0; min-height: 24px;
  flex-wrap: wrap; row-gap: 4px; column-gap: 8px; box-shadow: none;
}
.ff-bar :deep(.v-btn) { min-height: 24px; height: 24px; }
.ff-bar :deep(.v-btn .v-btn__content) { font-size: 11px; }

.lap-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 36px; }
.lap-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lap-card {
  flex: 1; min-height: 0;
  background: rgb(var(--v-theme-surface));
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 3px solid var(--ds-primary, #0284c7);
  display: flex; flex-direction: column; overflow: hidden;
}
.filter-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; flex-shrink: 0;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
}
.tab-inner { flex: 1; min-height: 0; overflow: auto; }
.tab-loading, .tab-empty {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; height: 200px; font-size: 12px; color: #9e9e9e;
}
.pivot-wrapper { height: 100%; display: flex; flex-direction: column; }.pivot-container { flex: 1; min-height: 0; overflow: hidden; padding: 4px; display: flex; flex-direction: column; }
:deep(.tiny-pivot-itemmarginminus) { flex: 1; min-height: 0; min-width: 0; }

.chart-wrap { padding: 12px; flex: 1; display: flex; flex-direction: column; }
.chart-container { flex: 1; min-height: 350px; position: relative; }
.chart-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; flex-shrink: 0;
}
.chart-title { font-size: 12px; font-weight: 700; color: #374151; }
.chart-type-select {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0 8px; font-size: 11px; font-weight: 600;
  outline: none; background: white; color: #374151; cursor: pointer;
}

.sum-lbl { font-size: 12px; font-weight: 600; color: #374151; }
.sum-val { font-size: 12px; font-weight: 700; color: var(--ds-primary, #0284c7); margin-left: 10px; }
.num-cell { font-variant-numeric: tabular-nums; }
</style>

<style>
.tiny-pivot-itemmarginminus.tiny-pivot-itemmarginminus {
  --vpg-accent: var(--ds-primary, #0284c7);
  --vpg-accent-hover: var(--ds-primary-dark, #0369a1);
  --vpg-accent-soft-bg: rgba(59, 89, 152, 0.1);
  --vpg-accent-soft-text: var(--ds-primary, #0284c7);
  --vpg-focus-ring: rgba(59, 89, 152, 0.35);
}
</style>