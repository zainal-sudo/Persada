<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { listJualPerItemApi, type ListJualPerItemRow } from "@/api/penjualan/listJualPerItemApi";
import TinyPivotOnly from "@/components/TinyPivotOnly.vue";
import MsIcon from "@/components/MsIcon.vue";
import { useAuthStore } from "@/stores/authStore";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  exportStyledHeader,
  exportPivotToExcel,
  type ExportColumn,
} from "@/utils/styledExport";
import {
  IconList,
  IconTable,
  IconChartBar,
  IconFileInvoice,
  IconFileSpreadsheet,
} from "@tabler/icons-vue";

const toast = useToast();
const authStore = useAuthStore();

// Delphi: kolom hpp & margin hanya untuk user FINANCE
const isFinance = computed(() => authStore.userKode.toUpperCase() === "FINANCE");

// ── Periode ───────────────────────────────────────────────────────────
const STORAGE_KEY = "penjualan_periode_listJualPerItem";

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
const firstDay = getLocal(new Date(now.getFullYear(), now.getMonth(), 1));
const saved = getSaved();

const filterState = ref({
  startDate: saved?.startDate ?? firstDay,
  endDate: saved?.endDate ?? getLocal(now),
});

const startDate = computed({
  get: () => filterState.value.startDate,
  set: (v) => { filterState.value = { ...filterState.value, startDate: v }; },
});
const endDate = computed({
  get: () => filterState.value.endDate,
  set: (v) => { filterState.value = { ...filterState.value, endDate: v }; },
});
watch(
  filterState,
  (val) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {}
  },
  { deep: true },
);

const filterValues = computed(() => ({ ...filterState.value }));

// ── Tab ───────────────────────────────────────────────────────────────
const activeTab = ref<"grid" | "pivot" | "chart">("grid");

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<ListJualPerItemRow[]>([]);
const filteredItems = computed(() => items.value);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await listJualPerItemApi.getBrowse(filterState.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Headers ───────────────────────────────────────────────────────────
const headers = computed(() => {
  const base = [
    { key: "Nomor", title: "Nomor", width: "150px" },
    { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
    { key: "Bulan", title: "Bulan", width: "50px", align: "center" as const },
    { key: "Tahun", title: "Tahun", width: "60px", align: "center" as const },
    { key: "Rayon", title: "Rayon", width: "110px" },
    { key: "Salesman", title: "Salesman", width: "110px" },
    { key: "Marketing", title: "Marketing", width: "110px" },
    { key: "Outlet", title: "Outlet", minWidth: "150px" },
    { key: "Golongan", title: "Golongan", width: "80px" },
    { key: "JenisCustomer", title: "Jenis Customer", width: "110px" },
    { key: "Kode", title: "Kode", width: "90px" },
    { key: "Nama", title: "Nama", minWidth: "200px" },
    { key: "Satuan", title: "Satuan", width: "70px" },
    { key: "Merk", title: "Merk", width: "100px" },
    { key: "Kategori", title: "Kategori", width: "110px" },
    { key: "Departemen", title: "Departemen", width: "110px" },
    { key: "SubDepartemen", title: "Sub Departemen", width: "110px" },
    { key: "Divisi", title: "Divisi", width: "80px" },
    { key: "fpd_cn", title: "CN", width: "70px", align: "end" as const },
    { key: "Qty", title: "Qty", width: "80px", align: "end" as const },
    { key: "Nilai", title: "Nilai", width: "120px", align: "end" as const },
    { key: "Nilaiblmppn", title: "Nilai Blm Ppn", width: "120px", align: "end" as const },
    { key: "Kontrak", title: "Kontrak", width: "100px", align: "end" as const },
  ];

  if (isFinance.value) {
    base.push(
      { key: "hpp", title: "HPP", width: "120px", align: "end" as const },
      { key: "margin", title: "Margin", width: "120px", align: "end" as const },
    );
  }

  base.push(
    { key: "biaya_promosi", title: "Biaya Promosi", width: "120px", align: "end" as const },
    { key: "fee_marketing", title: "Fee Marketing", width: "120px", align: "end" as const },
    { key: "Nilai_Net", title: "Nilai Net", width: "120px", align: "end" as const },
    { key: "NilaiEkspedisi", title: "Nilai Ekspedisi", width: "110px", align: "end" as const },
    { key: "Group_produk", title: "Group Produk", width: "120px" },
    { key: "Pajak", title: "Pajak", width: "70px", align: "end" as const },
    { key: "StatusHet", title: "Status Het", width: "110px" },
    { key: "IsPf", title: "IsPF", width: "80px", align: "center" as const },
    { key: "Eceran", title: "Eceran", width: "80px", align: "center" as const },
    { key: "isCatalog", title: "Catalog", width: "80px", align: "center" as const },
  );

  return base;
});

// ── Pivot Data ────────────────────────────────────────────────────────
// Pakai SEMUA kolom item (= kolom yang tampil di grid) supaya panel
// "Field tersedia" di pivot menampilkan semua kolom, termasuk kolom baru
// yang nanti ditambahkan tanpa perlu meng-update map manual di sini.
// Engine agregasi sudah mengonversi string-angka (extractNumericValue).
const pivotData = computed(() => items.value);

// ── Chart ─────────────────────────────────────────────────────────────
const chartType = ref<"column" | "bar" | "line" | "area" | "pie">("column");
const chartCanvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: any = null;

const getPivotConfig = () => ({
  rows: ["Nama"] as string[],
  cols: ["Rayon"] as string[],
  vals: ["Nilai"] as string[],
  aggregatorName: "Sum",
});

const buildPlainData = () => {
  return items.value.map((r) => ({
    Nama: r.Nama,
    Rayon: r.Rayon,
    Marketing: r.Marketing,
    Salesman: r.Salesman,
    Outlet: r.Outlet,
    Nilai: Number(r.Nilai),
    Nilaiblmppn: Number(r.Nilaiblmppn),
    Kontrak: Number(r.Kontrak),
    hpp: Number(r.hpp ?? 0),
    margin: Number(r.margin ?? 0),
    biaya_promosi: Number(r.biaya_promosi),
    fee_marketing: Number(r.fee_marketing),
  }));
};

const chartData = computed(() => {
  const { rows, vals, aggregatorName } = getPivotConfig();
  const plainData = buildPlainData() as Record<string, any>[];
  const valField = vals[0] ?? "Nilai";
  const rowKey = rows[0] ?? "Nama";

  const map = new Map<string, number>();

  for (const item of plainData) {
    const rowLabel = item[rowKey] ?? "Unknown";
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
      label: "Total Nilai",
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
                `${ctx.label}: ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(ctx.parsed ?? 0)}`,
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
              `${ctx.dataset.label}: ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
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

const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Export ───────────────────────────────────────────────────────────
const isExporting = ref(false);

const exportCols = computed<ExportColumn[]>(() => {
  const cols: ExportColumn[] = [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Bulan", title: "Bulan", width: 8, align: "center" },
    { key: "Tahun", title: "Tahun", width: 8, align: "center" },
    { key: "Group_produk", title: "Group Produk", width: 15 },
    { key: "Marketing", title: "Marketing", width: 15 },
    { key: "Rayon", title: "Rayon", width: 15 },
    { key: "Salesman", title: "Salesman", width: 15 },
    { key: "Outlet", title: "Outlet", width: 25 },
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama", width: 30 },
    { key: "Merk", title: "Merk", width: 12 },
    { key: "Kategori", title: "Kategori", width: 15 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Qty", title: "Qty", width: 12, numFmt: "#,##0" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Nilaiblmppn", title: "Nilai Blm Ppn", width: 16, numFmt: "#,##0" },
    { key: "Kontrak", title: "Kontrak", width: 14, numFmt: "#,##0" },
  ];

  if (isFinance.value) {
    cols.push(
      { key: "hpp", title: "HPP", width: 16, numFmt: "#,##0" },
      { key: "margin", title: "Margin", width: 16, numFmt: "#,##0" },
    );
  }

  cols.push(
    { key: "biaya_promosi", title: "Biaya Promosi", width: 16, numFmt: "#,##0" },
    { key: "fee_marketing", title: "Fee Marketing", width: 16, numFmt: "#,##0" },
    { key: "Nilai_Net", title: "Nilai Net", width: 16, numFmt: "#,##0" },
    { key: "NilaiEkspedisi", title: "Nilai Ekspedisi", width: 16, numFmt: "#,##0" },
    { key: "Group_produk", title: "Group Produk", width: 15 },
    { key: "Pajak", title: "Pajak", width: 8, numFmt: "#,##0" },
    { key: "StatusHet", title: "Status Het", width: 12 },
    { key: "IsPf", title: "IsPF", width: 8, align: "center" },
    { key: "Eceran", title: "Eceran", width: 8, align: "center" },
    { key: "isCatalog", title: "Catalog", width: 8, align: "center" },
    { key: "Golongan", title: "Golongan", width: 10 },
    { key: "JenisCustomer", title: "Jenis Customer", width: 14 },
    { key: "SubDepartemen", title: "Sub Departemen", width: 14 },
    { key: "Departemen", title: "Departemen", width: 14 },
    { key: "Divisi", title: "Divisi", width: 10 },
    { key: "fpd_cn", title: "CN", width: 8, numFmt: "#,##0" },
  );

  return cols;
});

const doExport = () => {
  if (!items.value.length) {
    toast.info("Tidak ada data untuk diexport.");
    return;
  }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r) => ({
      ...r,
      Tanggal: fmtDate(r.Tanggal),
    }));
    exportStyledHeader({
      title: "List Jual Per Item",
      subtitle: `Periode ${startDate.value} s/d ${endDate.value}`,
      columns: exportCols.value,
      items: exportItems as unknown as Record<string, any>[],
      fileName: `ListJualPerItem_${startDate.value}_sd_${endDate.value}.xlsx`,
    });
  } finally {
    isExporting.value = false;
  }
};

// ── Export Pivot (sesuai tampilan pivot) ────────────────────────────
const pivotRef = ref<InstanceType<typeof TinyPivotOnly> | null>(null);
const isPivotExporting = ref(false);

const doExportPivot = async () => {
  const pivot = pivotRef.value;
  if (!pivot) return;
  const result = pivot.pivotResult;
  if (!result || !result.rowHeaders.length) {
    toast.info("Tidak ada data pivot untuk diexport.");
    return;
  }
  isPivotExporting.value = true;
  try {
    await exportPivotToExcel({
      title: "List Jual Per Item — Pivot",
      subtitle: `Periode ${startDate.value} s/d ${endDate.value}`,
      rowFields: pivot.rowFields ?? [],
      valueFields: (pivot.valueFields ?? []).map((vf: any) => ({
        field: vf.field,
        label: vf.label,
        aggregation: vf.aggregation,
      })),
      columnHeaders: result.headers,
      rowHeaders: result.rowHeaders,
      data: result.data,
      rowTotals: result.rowTotals,
      columnTotals: result.columnTotals,
      grandTotal: result.grandTotal,
      fileName: `ListJualPerItem_Pivot_${startDate.value}_sd_${endDate.value}`,
    });
    toast.success("Berhasil export pivot ke Excel.");
  } catch {
    toast.error("Gagal melakukan export Excel.");
  } finally {
    isPivotExporting.value = false;
  }
};
</script>

<template>
  <div class="rp-wrap">
  <!-- ── Bar filter tunggal (Grid/Pivot/Grafik) — paritas penuh dgn Grid Data ── -->
  <fieldset class="ff-bar">
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
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

      <v-btn
        size="small"
        class="tb-btn tb-btn-success"
        data-fkey="export"
        :loading="activeTab === 'grid' ? isExporting : isPivotExporting"
        @click="activeTab === 'grid' ? doExport() : doExportPivot()"
      >
        <template #prepend><IconFileSpreadsheet :size="14" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </div>
  </fieldset>

  <!-- ── Grid tab ── -->
  <div v-show="activeTab === 'grid'" class="grid-tab">
    <BaseBrowse
      title="List Jual Per Item"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      :show-filter-bar="false"
      item-value="Nomor"
      :filter-values="filterValues"
      :auto-refresh="false"
      @refresh="loadData"
    >

      <template #item.Tanggal="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template #item.fpd_cn="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Qty="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item.Pajak="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.StatusHet="{ value }">
        <span :class="value === 'Bawah Het' ? 'badge-bawah' : 'badge-diatas'">{{ value }}</span>
      </template>
      <template #item.Nilai="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Nilaiblmppn="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Kontrak="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template v-if="isFinance" #item.hpp="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template v-if="isFinance" #item.margin="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.biaya_promosi="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.fee_marketing="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Nilai_Net="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.NilaiEkspedisi="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>

      <template #summary-row="{ filteredItems }">
        <span class="summary-lbl">Total Nilai</span>
        <span class="summary-val">
          {{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Nilai), 0)) }}
        </span>
        <span class="summary-lbl" style="margin-left: 20px">Nilai Blm Ppn</span>
        <span class="summary-val">
          {{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Nilaiblmppn), 0)) }}
        </span>
        <span class="summary-lbl" style="margin-left: 20px">Nilai Net</span>
        <span class="summary-val">
          {{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Nilai_Net), 0)) }}
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
              :default-row-fields="['Salesman']"
              :default-column-fields="['Bulan']"
              :default-value-fields="[{ field: 'Nilai', aggregation: 'sum' }]"
              class="tiny-pivot-penjualan"
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
              {{ getPivotConfig().rows.join(" / ") }} berdasarkan {{ getPivotConfig().cols.join(" / ") }}
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
/* Bar filter tunggal — selaras dgn bar BaseBrowse (ff-bar). */
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
.filter-group.chek { gap: 12px; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; }
.filter-divider {
  width: 1px; height: 24px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0; margin: 0 4px;
}
.date-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 128px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.text-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none;
}
.text-inp:focus { border-color: var(--ds-primary, #0284c7); }
.checkbox-label { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; user-select: none; white-space: nowrap; }
.checkbox-label input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; accent-color: var(--ds-primary, #0284c7); }

.tab-wrap {
  display: flex; align-items: center; gap: 2px;
  background: rgba(var(--v-border-color), 0.06);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0; padding: 3px;
}
.tab-btn {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 10px;
  border: none; border-radius: 0;
  background: transparent; font-size: 11px; font-weight: 600;
  color: #6b7280; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.tab-btn:hover { background: rgba(59, 89, 152, 0.08); color: var(--ds-primary, #0284c7); }
.tab-btn.active { background: var(--ds-primary, #0284c7); color: white; }

.lap-layout {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0; padding: 8px 12px; gap: 6px;
}
.lap-header {
  flex-shrink: 0; display: flex; align-items: center;
  justify-content: flex-end;
  gap: 16px; min-height: 36px;
}
.lap-actions {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.lap-card {
  flex: 1; min-height: 0;
  background: rgb(var(--v-theme-surface));
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 3px solid var(--ds-primary, #0284c7); border-radius: 0;
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

.pivot-wrapper { height: 100%; display: flex; flex-direction: column; }.pivot-container {
  flex: 1; min-height: 0; overflow: hidden;
  padding: 4px; display: flex; flex-direction: column;
}

:deep(.tiny-pivot-penjualan) {
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
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 11px; font-weight: 600;
  outline: none; background: white; color: #374151; cursor: pointer;
}
.chart-type-select:focus { border-color: var(--ds-primary, #0284c7); }

.summary-lbl { font-size: 12px; font-weight: 600; color: #374151; }
.summary-val { font-size: 12px; font-weight: 700; color: var(--ds-primary, #0284c7); margin-left: 10px; }
.badge-bawah {
  background: rgba(220, 38, 38, 0.1); color: #DC2626; padding: 1px 8px;
  font-size: 10px; font-weight: 700;
}
.badge-diatas {
  background: rgba(5, 150, 105, 0.1); color: #059669; padding: 1px 8px;
  font-size: 10px; font-weight: 700;
}
</style>

<style>
.tiny-pivot-penjualan.tiny-pivot-penjualan {
  --vpg-accent: var(--ds-primary, #0284c7);
  --vpg-accent-hover: var(--ds-primary-dark, #0369a1);
  --vpg-accent-soft-bg: rgba(59, 89, 152, 0.1);
  --vpg-accent-soft-text: var(--ds-primary, #0284c7);
  --vpg-focus-ring: rgba(59, 89, 152, 0.35);
}
</style>
