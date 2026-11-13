<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  barangRealisasiApi,
  type BarangRealisasiRow,
  type BarangRealisasiDetailRow,
} from "@/api/laporan/barangRealisasiApi";
import TinyPivotOnly from "@/components/TinyPivotOnly.vue";
import { usePivotExport } from "@/composables/usePivotExport";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconList, IconTable, IconChartBar, IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();
// ── Export Pivot ────────────────────────────────────────────────────
const { pivotRef, isPivotExporting, doExportPivot } = usePivotExport({
  title: "Laporan Permintaan Barang vs Realisasi",
  fileName: "BarangRealisasi_Pivot",
});

// ── Tab ───────────────────────────────────────────────────────────────
const activeTab = ref<"grid" | "pivot" | "chart">("grid");

// ── Data ──────────────────────────────────────────────────────────────
// Delphi btnRefreshClick TIDAK memakai filter tanggal; query berdasarkan pb_isclosed=0
const items = ref<BarangRealisasiRow[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await barangRealisasiApi.getBrowse();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Detail (expandable rows) ─────────────────────────────────────────
const expanded = ref<Record<string, BarangRealisasiDetailRow[]>>({});
const expandedKeys = ref<any[]>([]);
const loadingDetails = ref<Set<string>>(new Set());

const handleExpanded = (val: any[]) => {
  const keys = val.map((r: any) => r?.SKU).filter(Boolean);
  keys.forEach((k) => {
    if (!(k in expanded.value)) loadDetail(k);
  });
  expandedKeys.value = val;
};

const loadDetail = async (kode: string) => {
  loadingDetails.value = new Set([...loadingDetails.value, kode]);
  try {
    expanded.value = { ...expanded.value, [kode]: await barangRealisasiApi.getDetail(kode) };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat detail.");
  } finally {
    const s = new Set(loadingDetails.value);
    s.delete(kode);
    loadingDetails.value = s;
  }
};

// ── Export ───────────────────────────────────────────────────────────
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "SKU", title: "SKU", width: 12 },
  { key: "NamaBarang", title: "Nama Barang", width: 30 },
  { key: "Minta", title: "Minta", width: 12, numFmt: "#,##0.00" },
  { key: "Terima", title: "Realisasi", width: 12, numFmt: "#,##0.00" },
  { key: "Kurang", title: "Kurang", width: 12, numFmt: "#,##0.00" },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    await exportStyledHeader({ title: "Laporan Permintaan Barang vs Realisasi", columns: exportColumns, items: items.value as unknown as Record<string, any>[], fileName: "BarangRealisasi" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

// ── Headers Master (mengikuti Delphi) ────────────────────────────────
const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "SKU", title: "SKU", width: "100px" },
  { key: "NamaBarang", title: "Nama Barang", minWidth: "200px" },
  { key: "Minta", title: "Minta", width: "100px", align: "end" },
  { key: "Terima", title: "Realisasi", width: "100px", align: "end" },
  { key: "Kurang", title: "Kurang", width: "100px", align: "end" },
];

// ── Headers Detail ───────────────────────────────────────────────────
const detailHeaders = [
  { key: "Nomor", title: "No. Permintaan", minWidth: "140px" },
  { key: "Minta", title: "Minta", align: "end" as const },
  { key: "Terima", title: "Realisasi", align: "end" as const },
  { key: "Kurang", title: "Kurang", align: "end" as const },
];

// ── Pivot Data ────────────────────────────────────────────────────────
// Delphi tidak menset pivot default; default berikut dipilih untuk laporan web
// Field pivot = semua kolom item (grid), tanpa map manual.
const pivotData = computed(() => items.value);

// ── Chart ─────────────────────────────────────────────────────────────
const chartType = ref<"column" | "bar" | "line" | "area" | "pie">("column");
const chartCanvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: any = null;

const getPivotConfig = () => ({
  rows: ["SKU"] as string[],
  cols: ["NamaBarang"] as string[],
  vals: ["Minta"] as string[],
  aggregatorName: "Sum",
});

const chartData = computed(() => {
  const { vals, aggregatorName } = getPivotConfig();
  const plainData = items.value as Record<string, any>[];
  const valField = vals[0] ?? "Minta";

  const map = new Map<string, number>();
  for (const item of plainData) {
    const rowLabel = item["SKU"] ?? "Unknown";
    const val = Number(item[valField]) || 0;
    if (aggregatorName === "Count") {
      map.set(rowLabel, (map.get(rowLabel) ?? 0) + 1);
    } else {
      map.set(rowLabel, (map.get(rowLabel) ?? 0) + val);
    }
  }

  const sorted = [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    labels: sorted.map((r) => r.label),
    datasets: [{
      label: "Total Permintaan (Minta)",
      data: sorted.map((r) => r.total),
    }],
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

const fmtQty = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <!-- ── Grid tab ── -->
  <div v-show="activeTab === 'grid'" class="grid-tab">
    <BaseBrowse
      title="Laporan Permintaan Barang vs Realisasi"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="SKU"
      :filter-values="{}"
      :auto-refresh="false"
      show-expand
      :expanded="expandedKeys"
      :loading-details="loadingDetails"
      :summary-columns="[
        { key: 'Minta', label: 'Total', numFmt: 'qty' },
        { key: 'Terima', numFmt: 'qty' },
        { key: 'Kurang', numFmt: 'qty' },
      ]"
      @refresh="loadData"
      @update:expanded="handleExpanded"
    >
      <template #filter-right-prepend>
        <div class="filter-divider" />
        <div class="tab-wrap">
          <button class="tab-btn active">
            <IconTable :size="13" :stroke-width="1.8" /> Grid Data
          </button>
          <button class="tab-btn" @click="activeTab = 'pivot'">
            <IconList :size="13" :stroke-width="1.8" /> Pivot
          </button>
          <button class="tab-btn" @click="activeTab = 'chart'">
            <IconChartBar :size="13" :stroke-width="1.8" /> Grafik
          </button>
        </div>
      </template>
      <template #extra-actions>
        <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport" :loading="isExporting">
          <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
          <span class="tb-fkey">[F8]</span> Export
        </v-btn>
      </template>

      <template #item.Minta="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item.Terima="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item.Kurang="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>

      <template #detail="{ item }">
        <div class="detail-wrap">
          <div class="detail-title">
            {{ item.NamaBarang }} <span class="detail-kode">{{ item.SKU }}</span>
          </div>
          <div v-if="loadingDetails.has(item.SKU)" class="detail-loading">Memuat detail...</div>
          <table v-else class="detail-table">
            <thead>
              <tr>
                <th v-for="h in detailHeaders" :key="h.key" :style="{ textAlign: h.align || 'left' }">{{ h.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!(expanded[item.SKU] || []).length">
                <td :colspan="detailHeaders.length" class="detail-empty">Tidak ada data permintaan.</td>
              </tr>
              <tr v-for="(d, i) in expanded[item.SKU] || []" :key="i">
                <td>{{ d.Nomor }}</td>
                <td class="num-cell" style="text-align: right">{{ fmtQty(d.Minta) }}</td>
                <td class="num-cell" style="text-align: right">{{ fmtQty(d.Terima) }}</td>
                <td class="num-cell" style="text-align: right">{{ fmtQty(d.Kurang) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseBrowse>
  </div>

  <!-- ── Pivot & Chart tab ── -->
  <div v-show="activeTab !== 'grid'" class="lap-layout">
    <div class="lap-header">
      <div class="page-title-section">
        <div class="title-icon-wrap">
          <IconFileInvoice :size="16" :stroke-width="1.8" />
        </div>
        <h1 class="page-title">Laporan Permintaan Barang vs Realisasi</h1>
      </div>
      <div class="lap-actions">
        <v-btn
          size="small"
          v-if="activeTab === 'pivot'"
          class="tb-btn tb-btn-success"
          @click="doExportPivot"
          :loading="isPivotExporting"
        >
          <template #prepend>
            <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
          </template>
          Export
        </v-btn>
      </div>
    </div>

    <div class="lap-card">
      <div class="filter-bar">
        <v-btn size="small" color="primary" variant="tonal" :loading="isLoading" @click="loadData">
          Tampilkan
        </v-btn>
        <div class="tab-wrap">
          <button class="tab-btn" @click="activeTab = 'grid'">
            <IconTable :size="13" :stroke-width="1.8" /> Grid Data
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'pivot' }" @click="activeTab = 'pivot'">
            <IconList :size="13" :stroke-width="1.8" /> Pivot
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'chart' }" @click="activeTab = 'chart'">
            <IconChartBar :size="13" :stroke-width="1.8" /> Grafik
          </button>
        </div>
      </div>

      <!-- Pivot -->
      <div v-show="activeTab === 'pivot'" class="tab-inner">
        <div v-if="isLoading" class="tab-loading">
          <v-progress-circular indeterminate color="primary" size="36" />
          <span>Memuat data...</span>
        </div>
        <div v-else-if="!items.length" class="tab-empty">Tidak ada data.</div>
        <div v-else class="pivot-wrapper">
          <div class="pivot-container">
            <TinyPivotOnly
              ref="pivotRef"
              :data="pivotData"
              theme="light"
              font-size="sm"
              class="tiny-pivot-laporan-barangrealisasi"
            />
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div v-show="activeTab === 'chart'" class="tab-inner">
        <div v-if="isLoading" class="tab-loading">
          <v-progress-circular indeterminate color="primary" size="36" />
        </div>
        <div v-else-if="!hasChartData" class="tab-empty">Tidak ada data.</div>
        <div v-else class="chart-wrap">
          <div class="chart-header">
            <div class="chart-title">SKU berdasarkan Total Permintaan (Minta)</div>
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
.lap-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; flex-wrap: wrap; row-gap: 4px; }
.page-title-section { display: flex; align-items: center; gap: 8px; }
.lap-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.title-icon-wrap {
  width: 28px; height: 28px; border-radius: 0;
  background: var(--ds-primary, #0284c7); color: #ffffff;
  display: flex; align-items: center; justify-content: center;
}
.page-title { font-size: 0.95rem; font-weight: 700; color: rgb(var(--v-theme-on-surface)); margin: 0; letter-spacing: 0.01em; white-space: nowrap; }

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
:deep(.tiny-pivot-laporan-barangrealisasi) { flex: 1; min-height: 0; min-width: 0; }

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

.num-cell { font-variant-numeric: tabular-nums; }
.detail-wrap { padding: 8px 6px; }
.detail-title { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 6px; }
.detail-kode { font-weight: 400; color: #6b7280; margin-left: 8px; }
.detail-loading { color: #6b7280; font-size: 12px; padding: 8px 0; }
.detail-empty { text-align: center; color: #9ca3af; font-size: 12px; padding: 10px 0; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th {
  background: var(--ds-tab-bg, #eef1f6); color: #374151; font-weight: 600;
  padding: 5px 8px; border-bottom: 1px solid var(--ds-border, #d0d5dd);
  white-space: nowrap; text-align: left;
}
.detail-table td { padding: 4px 8px; border-bottom: 1px solid #eef0f4; white-space: nowrap; }
.detail-table tr:hover td { background: #f7f9fc; }
</style>

<style>
.tiny-pivot-laporan-barangrealisasi.tiny-pivot-laporan-barangrealisasi {
  --vpg-accent: var(--ds-primary, #0284c7);
  --vpg-accent-hover: var(--ds-primary-dark, #0369a1);
  --vpg-accent-soft-bg: rgba(59, 89, 152, 0.1);
  --vpg-accent-soft-text: var(--ds-primary, #0284c7);
  --vpg-focus-ring: rgba(59, 89, 152, 0.35);
}
</style>