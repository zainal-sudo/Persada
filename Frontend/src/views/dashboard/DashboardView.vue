<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { dashboardApi, type DashboardSummary, type CabangOption } from "@/api/dashboardApi";
import { useAuthStore } from "@/stores/authStore";
import DsDatePicker from "@/components/DsDatePicker.vue";

const authStore = useAuthStore();

// Dropdown cabang hanya untuk login Pusat (00) + FINANCE/OWNER.
const canPickBranch = computed(
  () => authStore.cabangKode === "00" && authStore.isAiUser,
);

const loading = ref(false);
const errorMsg = ref("");
const summary = ref<DashboardSummary | null>(null);
const cabangList = ref<CabangOption[]>([]);
const selectedDb = ref("");

// Helper lokal, sama seperti 20 view laporan. Diekstrak jadi util bersama baru
// layak kalau sekalian semua view dimigrasi.
const getLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Tanggal posisi acuan. Mengganti tanggal tidak langsung memuat: harus Refresh
// atau F5, sama dengan halaman laporan (:auto-refresh="false" di BaseBrowse).
const tanggal = ref(getLocal(new Date()));

const rp = (n: number | undefined | null) => {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (Math.abs(v) >= 1_000_000) return `Rp ${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
};
const num = (n: number | undefined | null) => Number(n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const bulanLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  const nama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${nama[Number(m) - 1]} ${y.slice(2)}`;
};

// "Bulan Ini" hanya sahih kalau tanggal yang dipilih ada di bulan berjalan.
// Kalau tidak, sebut bulan yang dipilih supaya angka tidak dibaca sebagai data hari ini.
const periodeLabel = computed(() => {
  const [y, m] = tanggal.value.split("-");
  const n = new Date();
  const nowYm = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  const ym = `${y}-${m}`;
  return ym === nowYm ? "Bulan Ini" : bulanLabel(ym);
});
const periodeLabelLower = computed(() => periodeLabel.value.toLowerCase());
const fmtTanggal = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};
const onDateLabel = computed(() =>
  tanggal.value === getLocal(new Date()) ? "hari ini" : fmtTanggal(tanggal.value),
);
const seriesEndLabel = computed(() => {
  const s = summary.value?.series6;
  return s?.length ? bulanLabel(s[s.length - 1].bulan) : "-";
});

let barChart: any = null;
let doughChart: any = null;
let areaChart: any = null;
let salesChart: any = null;
const barCanvas = ref<HTMLCanvasElement | null>(null);
const doughCanvas = ref<HTMLCanvasElement | null>(null);
const areaCanvas = ref<HTMLCanvasElement | null>(null);
const salesCanvas = ref<HTMLCanvasElement | null>(null);

const PALETTE = ["#0284c7", "#0ea5e9", "#0369a1", "#8494a7", "#059669", "#0284c7", "#c4cad3"];

const renderCharts = async () => {
  await nextTick();
  if (!summary.value) return;
  const {
    Chart, BarController, PieController, BarElement, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend,
  } = await import("chart.js");
  Chart.register(
    BarController, PieController, BarElement, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend,
  );

  if (barChart) { barChart.destroy(); barChart = null; }
  if (doughChart) { doughChart.destroy(); doughChart = null; }
  if (areaChart) { areaChart.destroy(); areaChart = null; }
  if (salesChart) { salesChart.destroy(); salesChart = null; }

  if (barCanvas.value) {
    barChart = new Chart(barCanvas.value, {
      type: "bar",
      data: {
        labels: summary.value.series6.map((s) => bulanLabel(s.bulan)),
        datasets: [{
          label: "Omzet",
          data: summary.value.series6.map((s) => s.omzet),
          backgroundColor: "#0284c7",
          borderColor: "#0369a1",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => rp(ctx.parsed?.y ?? 0),
            },
          },
        },
        scales: {
          y: {
            ticks: { callback: (v: any) => (v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)} M` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)} jt` : v) },
          },
        },
      },
    });
  }

  if (doughCanvas.value && summary.value.kategori.length) {
    doughChart = new Chart(doughCanvas.value, {
      type: "pie",
      data: {
        labels: summary.value.kategori.map((d) => d.nama),
        datasets: [{
          data: summary.value.kategori.map((d) => d.nilai),
          backgroundColor: summary.value.kategori.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: "#fff",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${rp(ctx.parsed ?? 0)}` } },
        },
      },
    });
  }

  if (areaCanvas.value && summary.value.area.length) {
    areaChart = new Chart(areaCanvas.value, {
      type: "bar",
      data: {
        labels: summary.value.area.map((d) => d.nama),
        datasets: [{
          label: "Omzet",
          data: summary.value.area.map((d) => d.nilai),
          backgroundColor: "#0ea5e9",
          borderColor: "#0369a1",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => rp(ctx.parsed?.x ?? 0) } },
        },
        scales: {
          x: {
            ticks: { callback: (v: any) => (Math.abs(v) >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)} M` : Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)} jt` : v) },
          },
        },
      },
    });
  }

  if (salesCanvas.value && summary.value.salesman.length) {
    salesChart = new Chart(salesCanvas.value, {
      type: "bar",
      data: {
        labels: summary.value.salesman.map((d) => d.nama),
        datasets: [{
          label: "Omzet",
          data: summary.value.salesman.map((d) => d.nilai),
          backgroundColor: "#059669",
          borderColor: "#0369a1",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => rp(ctx.parsed?.x ?? 0) } },
        },
        scales: {
          x: {
            ticks: { callback: (v: any) => (Math.abs(v) >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)} M` : Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)} jt` : v) },
          },
        },
      },
    });
  }
};

const load = async () => {
  loading.value = true;
  errorMsg.value = "";
  try {
    summary.value = await dashboardApi.getSummary(selectedDb.value || undefined, tanggal.value);
    await renderCharts();
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || e?.message || "Gagal memuat dashboard.";
  } finally {
    loading.value = false;
  }
};

const loadCabang = async () => {
  if (!canPickBranch.value) return;
  try {
    cabangList.value = await dashboardApi.getCabang();
    const erp = cabangList.value.find((c) => c.reachable && c.kode !== "00");
    selectedDb.value = erp?.dbase || "";
  } catch {
    cabangList.value = [];
  }
};

const onPickCabang = () => {
  load();
};

// F5 sudah dipancarkan global oleh useHotkeys; dashboard belum pernah
// mendengarkannya. Satu listener supaya tidak perlu mouse untuk refresh.
const onHotkey = (e: Event) => {
  if ((e as CustomEvent<string>).detail === "refresh") load();
};

onMounted(async () => {
  await loadCabang();
  await load();
  document.addEventListener("erp:hotkey", onHotkey);
});

onBeforeUnmount(() => {
  document.removeEventListener("erp:hotkey", onHotkey);
  if (barChart) barChart.destroy();
  if (doughChart) doughChart.destroy();
  if (areaChart) areaChart.destroy();
  if (salesChart) salesChart.destroy();
});

const deltaLabel = computed(() => {
  const d = summary.value?.penjualan.deltaPct;
  if (d === null || d === undefined) return "-";
  return `${d > 0 ? "+" : ""}${d}%`;
});
const deltaClass = computed(() => {
  const d = summary.value?.penjualan.deltaPct;
  if (d === null || d === undefined || d === 0) return "";
  return d > 0 ? "up" : "down";
});
</script>

<template>
  <div class="db-page" tabindex="0">
    <div class="db-toolbar">
      <div>
        <div class="db-title">Dashboard {{ summary?.cabang || authStore.userCabang }}</div>
        <div class="db-sub">Posisi per {{ summary?.asOfDate || tanggal }}</div>
      </div>
      <div class="db-pick">
        <label class="db-pick-lbl">Posisi</label>
        <DsDatePicker v-model="tanggal" variant="toolbar" />
        <button class="db-btn" :disabled="loading" @click="load">
          {{ loading ? "Memuat..." : "Refresh" }}
        </button>
        <template v-if="canPickBranch">
          <span class="db-pick-sep"></span>
          <label class="db-pick-lbl">Cabang</label>
          <select v-model="selectedDb" class="db-pick-sel" :disabled="loading" @change="onPickCabang">
            <option v-for="c in cabangList" :key="c.kode" :value="c.dbase" :disabled="!c.reachable">
              {{ c.nama }}{{ c.reachable ? "" : " (belum terkoneksi)" }}
            </option>
          </select>
        </template>
      </div>
    </div>

    <div v-if="errorMsg" class="db-error">{{ errorMsg }}</div>
    <div v-else-if="loading && !summary" class="db-loading">Memuat dashboard...</div>

    <template v-if="summary">
      <!-- KPI -->
      <div class="db-kpis">
        <div class="kpi">
          <div class="kpi-lbl">Omzet {{ periodeLabel }}</div>
          <div class="kpi-val">{{ rp(summary.penjualan.omzet) }}</div>
          <div class="kpi-sub">
            <span :class="deltaClass">{{ deltaLabel }}</span> vs bulan lalu ({{ rp(summary.penjualan.omzetPrev) }})
          </div>
          <div class="kpi-foot">{{ num(summary.penjualan.faktur) }} faktur · {{ onDateLabel }} {{ rp(summary.penjualan.onDate.omzet) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Piutang s/d {{ summary.asOfDate ? fmtTanggal(summary.asOfDate) : "-" }}</div>
          <div class="kpi-val">{{ rp(summary.piutang.totalSisa) }}</div>
          <div class="kpi-sub warn">lewat 120 hari: {{ rp(summary.piutang.gt120.total) }} ({{ num(summary.piutang.gt120.count) }} faktur)</div>
          <div class="kpi-foot" v-if="summary.piutang.topOverdue">
            tertinggi: {{ summary.piutang.topOverdue.customer }} ({{ rp(summary.piutang.topOverdue.sisa) }})
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Inkaso {{ periodeLabel }}</div>
          <div class="kpi-val good">{{ rp(summary.inkaso.total) }}</div>
          <div class="kpi-sub">{{ num(summary.inkaso.count) }} penerimaan (CR)</div>
        </div>
        <div class="kpi">
          <div class="kpi-lbl">Retur {{ periodeLabel }}</div>
          <div class="kpi-val">{{ rp(summary.retur.total) }}</div>
          <div class="kpi-sub">{{ num(summary.retur.count) }} retur</div>
        </div>
        <!-- Stok dihitung dari snapshot tbarang saat ini, jadi nilainya tidak
             mengikuti tanggal posisi di atas. Label menyebut "sekarang" supaya
             tidak dibaca sebagai kondisi pada tanggal tersebut. -->
        <div class="kpi">
          <div class="kpi-lbl">Posisi Stok Sekarang</div>
          <div class="kpi-val">{{ rp(summary.stok.nilaiPersediaan) }}</div>
          <div class="kpi-sub" :class="{ warn: summary.stok.negatifCount > 0 }">
            kritis: {{ num(summary.stok.kritisCount) }} item · negatif: {{ num(summary.stok.negatifCount) }}
          </div>
        </div>
      </div>

      <!-- Grafik -->
      <div class="db-charts">
        <div class="panel">
          <div class="panel-title">Omzet 6 Bulan s/d {{ seriesEndLabel }}</div>
          <div class="chart-box"><canvas ref="barCanvas"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-title">Komposisi Omzet per Kategori ({{ periodeLabelLower }})</div>
          <div class="chart-box"><canvas ref="doughCanvas"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-title">Omzet per Area ({{ periodeLabelLower }})</div>
          <div class="chart-box"><canvas ref="areaCanvas"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-title">Omzet per Salesman ({{ periodeLabelLower }})</div>
          <div class="chart-box"><canvas ref="salesCanvas"></canvas></div>
        </div>
      </div>

      <!-- Tabel -->
      <div class="db-tables">
        <div class="panel">
          <div class="panel-title">Top 5 Customer ({{ periodeLabelLower }})</div>
          <table class="db-table">
            <thead>
              <tr><th>Customer</th><th class="r">Qty</th><th class="r">Nilai</th><th v-if="summary.topCustomer.some((c) => c.margin !== undefined)" class="r">Margin</th></tr>
            </thead>
            <tbody>
              <tr v-if="!summary.topCustomer.length"><td colspan="4" class="empty">Belum ada transaksi bulan ini.</td></tr>
              <tr v-for="c in summary.topCustomer" :key="c.nama">
                <td>{{ c.nama }}</td>
                <td class="r">{{ num(c.qty) }}</td>
                <td class="r">{{ rp(c.nilai) }}</td>
                <td v-if="c.margin !== undefined" class="r" :class="c.margin < 0 ? 'neg' : ''">{{ rp(c.margin) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-title">Top 5 Item ({{ periodeLabelLower }})</div>
          <table class="db-table">
            <thead>
              <tr><th>Item</th><th class="r">Qty</th><th class="r">Nilai</th><th v-if="summary.topItem.some((i) => i.margin !== undefined)" class="r">Margin</th></tr>
            </thead>
            <tbody>
              <tr v-if="!summary.topItem.length"><td colspan="4" class="empty">Belum ada transaksi bulan ini.</td></tr>
              <tr v-for="i in summary.topItem" :key="i.nama">
                <td>{{ i.nama }}</td>
                <td class="r">{{ num(i.qty) }}</td>
                <td class="r">{{ rp(i.nilai) }}</td>
                <td v-if="i.margin !== undefined" class="r" :class="i.margin < 0 ? 'neg' : ''">{{ rp(i.margin) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-title">Stok Kritis (paling parah)</div>
          <table class="db-table">
            <thead>
              <tr><th>Item</th><th class="r">Stok</th><th class="r">Min</th></tr>
            </thead>
            <tbody>
              <tr v-if="!summary.stok.kritisTop.length"><td colspan="3" class="empty">Tidak ada item kritis.</td></tr>
              <tr v-for="s in summary.stok.kritisTop" :key="s.nama">
                <td>{{ s.nama }}</td>
                <td class="r" :class="s.stok <= 0 ? 'neg' : ''">{{ num(s.stok) }}</td>
                <td class="r">{{ num(s.min) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Satu-satunya halaman yang isinya lebih tinggi dari viewport: shell dan
   TabView memakai overflow:hidden, jadi dashboard harus jadi scroll container
   sendiri. Halaman lain tidak terpengaruh: scroll internal mereka tetap di
   tabel/pivot masing-masing. tabindex="0" agar area ini bisa discroll dengan
   keyboard saat tidak ada kontrol fokus di bawah lipatan. */
.db-page {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  background: #e8ecf1;
  font-size: 11px;
  color: #0c4a6e;
}
.db-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.db-title {
  font-size: 14px;
  font-weight: 700;
}
.db-sub {
  font-size: 10px;
  color: #5a6a7e;
}
.db-pick {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.db-pick-sep {
  width: 1px;
  align-self: stretch;
  background: #c4cad3;
  margin: 2px 4px;
}
.db-pick-lbl {
  font-weight: 600;
  font-size: 11px;
  color: #5a6a7e;
}
.db-pick-sel {
  border: 1px solid #a0aab8;
  background: #fff;
  padding: 4px 6px;
  font-size: 11px;
  font-family: inherit;
  color: #0c4a6e;
  min-width: 180px;
}
.db-pick-sel:focus {
  outline: none;
  border-color: #0284c7;
}
/* Tombol datar dengan garis 1px, sama seperti .db-pick-sel di toolbar yang sama
   supaya grup kontrol tanggal+cabang terbaca satu blok. Radius 0 (DESIGN.md),
   tanpa shadow. Sesuai MOTION 1, hover hanya mengubah warna border. */
.db-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #a0aab8;
  border-radius: 0;
  background: #f0f3f8;
  color: #0c4a6e;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.db-btn:hover:not(:disabled) {
  background: #e0e4ea;
  border-color: #0284c7;
}
.db-btn:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 1px;
}
.db-btn:disabled {
  background: #e8ecf1;
  color: #5a6a7e;
  cursor: default;
}
.db-loading {
  padding: 40px;
  text-align: center;
  color: #5a6a7e;
}
.db-error {
  background: #ffebee;
  border: 1px solid #ef9a9a;
  color: #b71c1c;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.db-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.kpi {
  background: #f0f3f8;
  border: 1px solid #a0aab8;
  border-top: 3px solid #0284c7;
  padding: 8px 10px;
}
.kpi-lbl {
  font-size: 10px;
  font-weight: 600;
  color: #5a6a7e;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.kpi-val {
  font-size: 17px;
  font-weight: 700;
  margin: 3px 0 2px;
  color: #0c4a6e;
}
.kpi-sub {
  font-size: 10px;
  color: #5a6a7e;
}
.kpi-sub .up { color: #059669; font-weight: 700; }
.kpi-sub .down { color: #c62828; font-weight: 700; }
.kpi-sub.warn { color: #0284c7; font-weight: 600; }
.kpi-foot {
  font-size: 10px;
  color: #8494a7;
  margin-top: 2px;
}
.good { color: #059669; }

.db-charts {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 8px;
  margin-bottom: 8px;
}
.panel {
  background: #fff;
  border: 1px solid #a0aab8;
  padding: 8px 10px;
}
.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: #0369a1;
  margin-bottom: 6px;
  border-bottom: 1px solid #c4cad3;
  padding-bottom: 4px;
}
.chart-box {
  height: 210px;
  position: relative;
}

.db-tables {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8px;
}
.db-table {
  width: 100%;
  border-collapse: collapse;
}
.db-table th,
.db-table td {
  border: 1px solid #c4cad3;
  padding: 4px 6px;
  font-size: 11px;
  text-align: left;
}
.db-table th {
  background: #0284c7;
  color: #fff;
  font-weight: 600;
}
.db-table tbody tr:nth-child(even) {
  background: #f0f3f8;
}
.db-table .r {
  text-align: right;
}
.db-table .neg {
  color: #c62828;
  font-weight: 600;
}
.db-table .empty {
  text-align: center;
  color: #8494a7;
  font-style: italic;
}

@media (max-width: 900px) {
  .db-charts {
    grid-template-columns: 1fr;
  }
}
</style>
