<script setup lang="ts">
import MsIcon from "@/components/MsIcon.vue";
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { transaksiHarian2Api, type TransaksiHarian2Row } from "@/api/laporan/transaksiHarian2Api";
import TinyPivotOnly from "@/components/TinyPivotOnly.vue";
import { usePivotExport } from "@/composables/usePivotExport";
import { IconList, IconTable, IconChartBar, IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();
// ── Export Pivot ────────────────────────────────────────────────────
const { pivotRef, isPivotExporting, doExportPivot } = usePivotExport({
  title: "List Transaksi Harian by Customer",
  subtitle: () => `Periode ${startDate.value} s/d ${endDate.value}`,
  fileName: "TransaksiHarian2_Pivot",
});

// ── Periode ───────────────────────────────────────────────────────────
const STORAGE_KEY = "laporan_periode_transaksiHarian2";
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
const filterState = ref({
  startDate: saved?.startDate ?? today,
  endDate: saved?.endDate ?? today,
  customer: saved?.customer ?? "",
});

const startDate = computed({
  get: () => filterState.value.startDate,
  set: (v) => { filterState.value = { ...filterState.value, startDate: v }; },
});
const endDate = computed({
  get: () => filterState.value.endDate,
  set: (v) => { filterState.value = { ...filterState.value, endDate: v }; },
});
const customerFilter = computed({
  get: () => filterState.value.customer,
  set: (v) => { filterState.value = { ...filterState.value, customer: v }; },
});

watch(filterState, (val) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {}
}, { deep: true });

const filterValues = computed(() => ({
  startDate: filterState.value.startDate,
  endDate: filterState.value.endDate,
  customer: filterState.value.customer || undefined,
}));

// ── Tab ───────────────────────────────────────────────────────────────
const activeTab = ref<"grid" | "pivot" | "chart">("grid");

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<TransaksiHarian2Row[]>([]);
const filteredItems = computed(() => items.value);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await transaksiHarian2Api.getBrowse(filterState.value);
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
  { key: "Tanggal", title: "Tanggal", width: "110px", align: "center" },
  { key: "Salesman", title: "Salesman", minWidth: "130px" },
  { key: "Customer", title: "Customer", minWidth: "90px" },
  { key: "Nama", title: "Nama", minWidth: "160px" },
  { key: "Tax", title: "Tax", width: "90px", align: "end" },
  { key: "Bruto", title: "Bruto", width: "110px", align: "end" },
  { key: "Disc", title: "Disc", width: "100px", align: "end" },
  { key: "Dpp", title: "Dpp", width: "110px", align: "end" },
  { key: "Pajak", title: "Pajak", width: "110px", align: "end" },
  { key: "Total", title: "Total", width: "120px", align: "end" },
  { key: "Freight", title: "Freight", width: "110px", align: "end" },
  { key: "Biaya_Promosi", title: "Biaya Promosi", width: "120px", align: "end" },
  { key: "Kontrak", title: "Kontrak", width: "110px", align: "end" },
  { key: "Retur", title: "Retur", width: "110px", align: "end" },
  { key: "Bayar_Cash", title: "Bayar Cash", width: "120px", align: "end" },
  { key: "Bayar_Transfer", title: "Bayar Transfer", width: "130px", align: "end" },
  { key: "Giro", title: "Giro", width: "120px", align: "end" },
  { key: "Deposit", title: "Deposit", width: "120px", align: "end" },
  { key: "Hutang_Internal", title: "Hutang Internal", width: "130px", align: "end" },
  { key: "Koreksi_LR", title: "Koreksi LR", width: "120px", align: "end" },
  { key: "UM_Penjualan", title: "UM Penjualan", width: "130px", align: "end" },
  { key: "PPn_Keluaran", title: "PPN Keluaran", width: "130px", align: "end" },
  { key: "PPh_22", title: "PPh 22", width: "110px", align: "end" },
  { key: "Potongan", title: "Potongan", width: "120px", align: "end" },
];

// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Tanggal", title: "Tanggal", width: 14, align: "center" },
  { key: "Salesman", title: "Salesman", width: 15 },
  { key: "Customer", title: "Customer", width: 12 },
  { key: "Nama", title: "Nama", width: 22 },
  { key: "Tax", title: "Tax", width: 8, align: "center" },
  { key: "Bruto", title: "Bruto", width: 14, numFmt: "#,##0" },
  { key: "Disc", title: "Disc", width: 12, numFmt: "#,##0" },
  { key: "Dpp", title: "Dpp", width: 14, numFmt: "#,##0" },
  { key: "Pajak", title: "Pajak", width: 14, numFmt: "#,##0" },
  { key: "Total", title: "Total", width: 14, numFmt: "#,##0" },
  { key: "Freight", title: "Freight", width: 12, numFmt: "#,##0" },
  { key: "Biaya_Promosi", title: "Biaya Promosi", width: 14, numFmt: "#,##0" },
  { key: "Kontrak", title: "Kontrak", width: 12, numFmt: "#,##0" },
  { key: "Retur", title: "Retur", width: 12, numFmt: "#,##0" },
  { key: "Bayar_Cash", title: "Bayar Cash", width: 14, numFmt: "#,##0" },
  { key: "Bayar_Transfer", title: "Bayar Transfer", width: 14, numFmt: "#,##0" },
  { key: "Giro", title: "Giro", width: 14, numFmt: "#,##0" },
  { key: "Deposit", title: "Deposit", width: 14, numFmt: "#,##0" },
  { key: "Hutang_Internal", title: "Hutang Internal", width: 14, numFmt: "#,##0" },
  { key: "Koreksi_LR", title: "Koreksi LR", width: 14, numFmt: "#,##0" },
  { key: "UM_Penjualan", title: "UM Penjualan", width: 14, numFmt: "#,##0" },
  { key: "PPn_Keluaran", title: "PPN Keluaran", width: 14, numFmt: "#,##0" },
  { key: "PPh_22", title: "PPh 22", width: 12, numFmt: "#,##0" },
  { key: "Potongan", title: "Potongan", width: 14, numFmt: "#,##0" },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r) => ({ ...r, Tanggal: fmtDate(r.Tanggal) }));
    await exportStyledHeader({ title: "List Transaksi Harian by Customer", subtitle: `Periode: ${filterState.value.startDate} s/d ${filterState.value.endDate}`, columns: exportColumns, items: exportItems as unknown as Record<string, any>[], fileName: "TransaksiHarian2" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

// Kolom uang (Delphi: right justify + format ###,###,###)
const moneyKeys = [
  "Bruto", "Disc", "Dpp", "Pajak", "Total", "Freight", "Biaya_Promosi", "Kontrak",
  "Retur", "Bayar_Cash", "Bayar_Transfer", "Giro", "Deposit", "Hutang_Internal",
  "Koreksi_LR", "UM_Penjualan", "PPn_Keluaran", "PPh_22", "Potongan",
];

const fmtMoney = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
const fmt = (v: any) => (v === null || v === undefined || v === "" ? "-" : v);

// ── Footer (Delphi: skSum utk kolom uang) ────────────────────────────
const footer = computed(() => {
  const labels = new Map<string, string>();
  labels.set("Tanggal", "Total");
  labels.set("Customer", `${items.value.length} baris`);
  return { labels };
});

// ── Pivot Data ────────────────────────────────────────────────────────
// Delphi (loaddata): SetPivotRow(['Salesman']), SetPivotColumns(['Bulan']),
// SetPivotData(['Bayar_Cash','Bayar_Transfer','Giro','Hutang_Internal','um_Penjualan'])
// Field pivot = semua kolom item (grid), tanpa map manual.
const pivotData = computed(() => items.value);

// ── Chart ─────────────────────────────────────────────────────────────
const chartType = ref<"column" | "bar" | "line" | "area" | "pie">("column");
const chartCanvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: any = null;

const getPivotConfig = () => ({
  rows: ["Salesman"] as string[],
  cols: ["Bulan"] as string[],
  vals: [
    "Bayar_Cash",
    "Bayar_Transfer",
    "Giro",
    "Hutang_Internal",
    "UM_Penjualan",
  ] as string[],
  aggregatorName: "Sum",
});

// Chart: baris pivot (Salesman) sbg label, satu dataset per nilai (multi seri)
const chartData = computed(() => {
  const { rows, vals } = getPivotConfig();
  const plainData = items.value as Record<string, any>[];
  const rowLabelField = rows[0] ?? "Salesman";

  const perLabel = new Map<string, Map<string, number>>();
  for (const item of plainData) {
    const label = String(item[rowLabelField] ?? "Unknown");
    if (!perLabel.has(label)) perLabel.set(label, new Map());
    const bucket = perLabel.get(label)!;
    for (const v of vals) {
      bucket.set(v, (bucket.get(v) ?? 0) + (Number(item[v]) || 0));
    }
  }

  // urutkan berdasarkan total semua nilai, ambil 20 terbesar
  const sorted = [...perLabel.entries()]
    .map(([label, bucket]) => ({
      label,
      total: [...bucket.values()].reduce((s, n) => s + n, 0),
      bucket,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    labels: sorted.map((r) => r.label),
    datasets: vals.map((v) => ({
      label: v.replace(/_/g, " "),
      data: sorted.map((r) => r.bucket.get(v) ?? 0),
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
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(ctx.parsed ?? 0)}` } },
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
            label: (ctx) => `${ctx.dataset.label}: ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format((isHorizontalBar ? ctx.parsed.x : ctx.parsed.y) ?? 0)}`,
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
  <div class="rp-wrap">
<fieldset class="ff-bar">
  <div class="filter-bar">

        <div class="filter-group">
          <span class="filter-lbl">Filter Periode</span>
          <DsDatePicker v-model="startDate" variant="toolbar" />
          <span class="filter-sep">s/d</span>
          <DsDatePicker v-model="endDate" variant="toolbar" />
          <span class="filter-lbl">Customer</span>
          <input v-model="customerFilter" class="cust-inp" placeholder="Gunakan kode" />
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
      title="List Transaksi Harian by Customer"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="Customer"
      :filter-values="filterValues"
      :auto-refresh="false"
      
,
      @refresh="loadData"
    >
<template #item.Tanggal="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template #item.Tax="{ value }">
        <span>{{ fmt(value) }}</span>
      </template>
      <template v-for="k in moneyKeys" :key="'cell-' + k" #[`item.${k}`]="{ value }">
        <span class="num-cell">{{ fmtMoney(value) }}</span>
      </template>

      <template #summary-row>
        <span class="sum-lbl">{{ footer.labels.get('Tanggal') }}</span>
        <span class="sum-val">{{ footer.labels.get('Customer') }}</span>
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
              class="tiny-pivot-transaksiharian2"
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
            <div class="chart-title">Pembayaran berdasarkan Salesman (20 terbesar)</div>
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
.cust-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 140px;
}
.cust-inp:focus { border-color: var(--ds-primary, #0284c7); }
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
:deep(.tiny-pivot-transaksiharian2) { flex: 1; min-height: 0; min-width: 0; }

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
.tiny-pivot-transaksiharian2.tiny-pivot-transaksiharian2 {
  --vpg-accent: var(--ds-primary, #0284c7);
  --vpg-accent-hover: var(--ds-primary-dark, #0369a1);
  --vpg-accent-soft-bg: rgba(59, 89, 152, 0.1);
  --vpg-accent-soft-text: var(--ds-primary, #0284c7);
  --vpg-focus-ring: rgba(59, 89, 152, 0.35);
}
</style>