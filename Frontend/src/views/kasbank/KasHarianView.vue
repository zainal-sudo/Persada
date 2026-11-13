<script setup lang="ts">
import MsIcon from "@/components/MsIcon.vue";
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { kasHarianApi, type KasHarianRow } from "@/api/kasbank/kasHarianApi";
import TinyPivotOnly from "@/components/TinyPivotOnly.vue";
import { usePivotExport } from "@/composables/usePivotExport";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  IconBook,
  IconTable,
  IconChartBar,
  IconFileSpreadsheet,
} from "@tabler/icons-vue";

const toast = useToast();
// ── Export Pivot ────────────────────────────────────────────────────
const { pivotRef, isPivotExporting, doExportPivot } = usePivotExport({
  title: "Kas Harian",
  subtitle: () => `Periode ${tanggal.value}`,
  fileName: "KasHarian_Pivot",
});

// ── Periode & Rekening ───────────────────────────────────────────────
const STORAGE_KEY = "kasbank_periode_kas_harian";

const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.tanggal) return s;
  } catch {}
  return null;
};

const now = new Date();
const saved = getSaved();

const filterState = ref({
  tanggal: saved?.tanggal ?? getLocal(now),
  rekkode: saved?.rekkode ?? "",
  reknama: saved?.reknama ?? "",
});

const tanggal = computed({
  get: () => filterState.value.tanggal,
  set: (v) => { filterState.value = { ...filterState.value, tanggal: v }; },
});
const rekkode = computed({
  get: () => filterState.value.rekkode,
  set: (v) => { filterState.value = { ...filterState.value, rekkode: v }; },
});

watch(filterState, (val) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {}
}, { deep: true });

const filterValues = computed(() => ({ ...filterState.value }));

// ── Tab ───────────────────────────────────────────────────────────────
const activeTab = ref<"grid" | "pivot" | "chart">("grid");

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<KasHarianRow[]>([]);
const filteredItems = computed(() => items.value);
const isLoading = ref(false);
const isExporting = ref(false);
const rekeningOptions = ref<{ kode: string; nama: string }[]>([]);

// ── Headers ───────────────────────────────────────────────────────────
const headers = [
  { key: "Keterangan", title: "Keterangan", width: "200px" },
  { key: "Debet", title: "Debet", width: "120px", align: "right" as const },
  { key: "Kredit", title: "Kredit", width: "120px", align: "right" as const },
  { key: "Saldo", title: "Saldo", width: "120px", align: "right" as const },
];

// ── Load Rekening ─────────────────────────────────────────────────────
const loadRekening = async () => {
  try {
    rekeningOptions.value = await kasHarianApi.getRekening();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data rekening.");
  }
};

// ── Load Data ─────────────────────────────────────────────────────────
const loadData = async () => {
  if (!filterState.value.rekkode) return;
  isLoading.value = true;
  try {
    items.value = await kasHarianApi.getKasHarian(
      filterState.value.rekkode,
      filterState.value.tanggal,
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await loadRekening();
  if (filterState.value.rekkode) {
    await loadData();
  }
});

// ── Pivot Data ────────────────────────────────────────────────────────
// Field pivot = semua kolom item (grid), tanpa map manual.
const pivotData = computed(() => items.value);

// ── Chart ─────────────────────────────────────────────────────────────
const chartType = ref<"column" | "bar" | "line" | "area" | "pie">("column");
const chartCanvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: any = null;

const getPivotConfig = () => ({
  rows: ["Keterangan"],
  cols: [],
  vals: ["Debet"],
  aggregatorName: "Sum",
});

const chartData = computed(() => {
  const { rows, cols, vals, aggregatorName } = getPivotConfig();
  const plainData = pivotData.value;
  const valField = vals[0] ?? "Debet";
  const rowKey = rows[0] ?? "Keterangan";

  const map = new Map<string, Map<string, number>>();
  const colSet = new Set<string>();

  for (const item of plainData as Record<string, any>[]) {
    const rowLabel = rows.length
      ? rows.map((r) => item[r] ?? "").join(" / ")
      : (item[rowKey] ?? "");
    const colLabel = cols.length
      ? cols.map((c) => item[c] ?? "").join(" / ")
      : "Total";
    colSet.add(colLabel);

    if (!map.has(rowLabel)) map.set(rowLabel, new Map());
    const colMap = map.get(rowLabel)!;
    const val = Number(item[valField]) || 0;

    if (aggregatorName === "Count") {
      colMap.set(colLabel, (colMap.get(colLabel) ?? 0) + 1);
    } else {
      colMap.set(colLabel, (colMap.get(colLabel) ?? 0) + val);
    }
  }

  const rowLabels = [...map.entries()]
    .map(([label, colMap]) => ({
      label,
      total: [...colMap.values()].reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)
    .map((r) => r.label);

  const colLabels = [...colSet.values()].sort();

  return {
    labels: rowLabels,
    colLabels,
    datasets: colLabels.map((col) => ({
      label: col,
      data: rowLabels.map((row) => map.get(row)?.get(col) ?? 0),
    })),
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

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const palette = [
    { bg: "rgba(46,125,50,0.75)", border: "#2e7d32" },
    { bg: "rgba(21,101,192,0.65)", border: "#1565c0" },
    { bg: "rgba(2,132,199,0.65)", border: "#0284c7" },
    { bg: "rgba(106,27,154,0.65)", border: "#6a1b9a" },
    { bg: "rgba(198,40,40,0.65)", border: "#c62828" },
    { bg: "rgba(0,105,92,0.65)", border: "#00695c" },
  ];

  const { labels, datasets } = chartData.value;

  if (chartType.value === "pie") {
    const pieData = chartData.value.labels.map((_, i) =>
      datasets.reduce((s, ds) => s + (ds.data[i] ?? 0), 0),
    );
    const pieColors = labels.map((_, i) => palette[i % palette.length]);
    chartInstance = new Chart(chartCanvasRef.value, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          label: "Total",
          data: pieData,
          backgroundColor: pieColors.map((c) => c.bg),
          borderColor: pieColors.map((c) => c.border),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.label}: ${new Intl.NumberFormat("id-ID").format(ctx.parsed ?? 0)}`,
            },
          },
        },
      },
    });
    return;
  }

  const isHorizontalBar = chartType.value === "bar";
  const baseType =
    chartType.value === "line" || chartType.value === "area" ? "line" : "bar";

  chartInstance = new Chart(chartCanvasRef.value, {
    type: baseType,
    data: {
      labels,
      datasets: datasets.map((ds, idx) => {
        const color = palette[idx % palette.length];
        if (baseType === "line") {
          return {
            label: ds.label,
            data: ds.data,
            borderColor: color.border,
            backgroundColor: chartType.value === "area" ? color.bg : color.border,
            fill: chartType.value === "area",
            tension: 0.25,
            pointRadius: 2,
          };
        }
        return {
          label: ds.label,
          data: ds.data,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
        };
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
            label: (ctx) =>
              `${ctx.dataset.label}: ${new Intl.NumberFormat("id-ID").format(
                (isHorizontalBar ? ctx.parsed.x : ctx.parsed.y) ?? 0,
              )}`,
          },
        },
      },
      scales: {
        [isHorizontalBar ? "x" : "y"]: {
          ticks: {
            callback: (v) =>
              new Intl.NumberFormat("id-ID", { notation: "compact" }).format(Number(v)),
          },
        },
        [isHorizontalBar ? "y" : "x"]: {
          ticks: { maxRotation: 35, font: { size: 10 } },
        },
      },
    },
  });
});

const hasChartData = computed(() => chartData.value.labels.length > 0);

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

// ── Export ───────────────────────────────────────────────────────────
const exportCols: ExportColumn[] = [
  { key: "Keterangan", title: "Keterangan", width: 30 },
  { key: "Debet", title: "Debet", width: 16, numFmt: "#,##0" },
  { key: "Kredit", title: "Kredit", width: 16, numFmt: "#,##0" },
  { key: "Saldo", title: "Saldo", width: 16, numFmt: "#,##0" },
];

const doExport = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  exportStyledHeader({
    title: "Kas Harian",
    columns: exportCols,
    items: items.value,
    fileName: `KasHarian_${filterState.value.tanggal}.xlsx`,
    subtitle: `Tanggal: ${filterState.value.tanggal} | Rekening: ${filterState.value.reknama || filterState.value.rekkode}`,
  });
};
</script>

<template>
  <div class="rp-wrap">
<fieldset class="ff-bar">
  <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-lbl">Tanggal</span>
        <DsDatePicker v-model="tanggal" variant="toolbar" />
      </div>
      <div class="filter-group">
        <span class="filter-lbl">Rekening</span>
        <select v-model="rekkode" class="rekening-select" @change="loadData">
          <option v-for="r in rekeningOptions" :key="r.kode" :value="r.kode">{{ r.kode }} - {{ r.nama }}</option>
        </select>
      </div>
    <div class="filter-divider" />

    <div class="tab-wrap">
      <button class="tab-btn" :class="{ active: activeTab === 'grid' }" @click="activeTab = 'grid'"><IconTable :size="13" :stroke-width="1.8" /> Grid Data</button>
      <button class="tab-btn" :class="{ active: activeTab === 'pivot' }" @click="activeTab = 'pivot'"><IconList :size="13" :stroke-width="1.8" /> Pivot</button>
      <button class="tab-btn" :class="{ active: activeTab === 'chart' }" @click="activeTab = 'chart'"><IconChartBar :size="13" :stroke-width="1.8" /> Grafik</button>
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
      title="Kas Harian"
      :icon="IconBook"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="Keterangan"
      :filter-values="filterValues"
      :exclude-summary-keys="['Saldo']"
      @refresh="loadData"
    >
      

      

      <template #item.Debet="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Kredit="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      
          

      <template #item.Saldo="{ value }">
        <span class="num-cell" :style="{ fontWeight: '700' }">{{ fmt(value) }}</span>
      </template>

      <template #summary-row="{ filteredItems }">
        <span class="summary-lbl">Total Debet</span>
        <span class="summary-val">
          {{ fmt(filteredItems.filter((r: any) => r.Keterangan !== 'Saldo Awal').reduce((s: number, r: any) => s + Number(r.Debet), 0)) }}
        </span>
        <span class="summary-lbl" style="margin-left: 20px">Total Kredit</span>
        <span class="summary-val">
          {{ fmt(filteredItems.filter((r: any) => r.Keterangan !== 'Saldo Awal').reduce((s: number, r: any) => s + Number(r.Kredit), 0)) }}
        </span>
      </template>
    </BaseBrowse>
  </div>

  <!-- ── Pivot & Chart tab ── -->
  <div v-show="activeTab !== 'grid'" class="rp-panel">
    <!-- Pivot -->
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
              class="tiny-pivot-finance"
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
            <div class="chart-title">
              {{ getPivotConfig().rows.join(" / ") }}
            </div>
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
.grid-tab {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

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
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-divider {
  width: 1px; height: 24px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0; margin: 0 4px;
}
.date-inp {
  height: 32px; border: 1px solid #d1d5db; border-radius: 6px;
  padding: 0 8px; font-size: 12px; outline: none; width: 130px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.rekening-select {
  height: 32px; border: 1px solid #d1d5db; border-radius: 6px;
  padding: 0 8px; font-size: 12px; outline: none; min-width: 200px;
  background: white; cursor: pointer;
}
.rekening-select:focus { border-color: var(--ds-primary, #0284c7); }

.tab-wrap {
  display: flex; align-items: center; gap: 2px;
  background: rgba(var(--v-border-color), 0.06);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px; padding: 3px;
}
.tab-btn {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 10px;
  border: none; border-radius: 4px;
  background: transparent; font-size: 11px; font-weight: 600;
  color: #6b7280; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.tab-btn:hover { background: rgba(59, 89, 152, 0.08); color: var(--ds-primary, #0284c7); }
.tab-btn.active { background: #28a745; color: white; }

.lap-layout {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
  padding: 8px 12px; gap: 6px;
}
.lap-header {
  flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; min-height: 36px; flex-wrap: wrap; row-gap: 4px;
}
.lap-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lap-card {
  flex: 1; min-height: 0;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-top: 3px solid var(--ds-primary, #0284c7); border-radius: 6px;
  display: flex; flex-direction: column; overflow: hidden;
}
.filter-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.tab-inner { flex: 1; min-height: 0; overflow: auto; }
.tab-loading, .tab-empty {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; height: 200px; font-size: 12px; color: #9e9e9e;
}

.pivot-wrapper { height: 100%; display: flex; flex-direction: column; }.pivot-container {
  flex: 1; min-height: 0; overflow: hidden;
  padding: 4px; display: flex; flex-direction: column;
}

:deep(.tiny-pivot-finance) {
  flex: 1; min-height: 0; min-width: 0;
}

.chart-wrap { padding: 12px; flex: 1; display: flex; flex-direction: column; }
.chart-container { flex: 1; min-height: 350px; position: relative; }
.num-cell { font-variant-numeric: tabular-nums; }

.chart-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; flex-shrink: 0;
}
.chart-title { font-size: 12px; font-weight: 700; color: #374151; }
.chart-type-select {
  height: 30px; border: 1px solid #d1d5db; border-radius: 6px;
  padding: 0 8px; font-size: 11px; font-weight: 600;
  outline: none; background: white; color: #374151; cursor: pointer;
}
.chart-type-select:focus { border-color: var(--ds-primary, #0284c7); }
</style>

<style>
.tiny-pivot-finance.tiny-pivot-finance {
  --vpg-accent: var(--ds-primary, #0284c7);
  --vpg-accent-hover: #2d4a80;
  --vpg-accent-soft-bg: rgba(59, 89, 152, 0.1);
  --vpg-accent-soft-text: var(--ds-primary, #0284c7);
  --vpg-focus-ring: rgba(59, 89, 152, 0.35);
}
</style>