<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  getLapLabaRugi,
  type LapLabaRugiData,
  type LapLabaRugiRow,
} from "@/api/laporan/lapLabaRugiApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<LapLabaRugiData>({ months: [], rows: [] });
const isLoading = ref(true);

const now = new Date();
const intParam = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const tahun = intParam(route.query.tahun, now.getFullYear());
const bulan1 = intParam(route.query.bulan1, 1);
const bulan2 = intParam(route.query.bulan2, now.getMonth() + 1);

const months = computed(() => data.value.months || []);
const periodeLabel = computed(() => {
  const ms = months.value;
  if (!ms.length) return String(tahun);
  return `${ms[0].label} - ${ms[ms.length - 1].label} ${tahun}`;
});

const nilai = (row: LapLabaRugiRow, bulan: number) => Number(row.nilai?.[bulan] ?? 0);
const fmt = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value || 0);
const fmtCell = (row: LapLabaRugiRow, value: number) => (row.isGroup ? "" : fmt(value));

const totalClassByLabel: Record<string, string> = {
  "TOTAL PENJUALAN": "row-total-penjualan",
  "LABA KOTOR": "row-total-laba-kotor",
  "TOTAL BIAYA": "row-total-biaya",
  "TOTAL PENDAPATAN": "row-total-pendapatan",
};
const rowClass = (row: LapLabaRugiRow) => {
  if (row.isGroup) return "row-group";
  if (row.keterangan === "LABA BERSIH") return "row-net";
  if (row.isTotal) return totalClassByLabel[row.keterangan] || "row-total";
  return "";
};

const doPrint = () => window.print();

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push("/laporan/lap-laba-rugi");
};

onMounted(async () => {
  try {
    data.value = await getLapLabaRugi({ tahun, bulan1, bulan2 });
    if (data.value.rows.length) setTimeout(() => window.print(), 300);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data cetak.");
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button class="tb" :disabled="isLoading || !data.rows.length" @click="doPrint">Cetak</button>
      <button class="tb tb-secondary" @click="goBack">Tutup</button>
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <div class="lr-doc">
      <div class="lr-title">LAPORAN LABA RUGI</div>
      <div class="lr-sub">Periode: {{ periodeLabel }}</div>

      <p v-if="!data.rows.length && !isLoading" class="empty">Tidak ada data untuk periode ini.</p>

      <table v-if="data.rows.length" class="lr-table">
        <colgroup>
          <col class="col-ket" />
          <col v-for="m in months" :key="m.bulan" />
          <col class="col-total" />
        </colgroup>
        <thead>
          <tr>
            <th class="tl">Keterangan</th>
            <th v-for="m in months" :key="m.bulan">{{ m.label }}</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in data.rows"
            :key="i"
            :class="rowClass(row)"
          >
            <td class="tl">{{ row.keterangan }}</td>
            <td v-for="m in months" :key="m.bulan" class="tr">{{ fmtCell(row, nilai(row, m.bulan)) }}</td>
            <td class="tr">{{ fmtCell(row, row.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #fff;
}

.lr-doc {
  padding: 8mm 6mm;
  color: #000;
  background: #fff;
  font-family: Tahoma, Arial, Helvetica, sans-serif;
  font-size: 10px;
}

.lr-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.lr-sub {
  margin: 4px 0 10px;
  text-align: center;
  font-size: 11px;
}

.lr-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.lr-table th,
.lr-table td {
  border: 1px solid #000;
  padding: 2px 4px;
  line-height: 1.25;
}

.lr-table thead {
  display: table-header-group;
}

.lr-table th {
  text-align: center;
  font-weight: 700;
}

.lr-table .tl {
  text-align: left;
}

.lr-table .tr {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.lr-table tbody tr.row-group td {
  font-weight: 800;
  background: #ddebf7;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.lr-table tbody tr.row-total td {
  font-weight: 700;
  background: #f1f3f5;
}

.lr-table tbody tr.row-total-penjualan td {
  font-weight: 700;
  background: #e3f2fd;
}

.lr-table tbody tr.row-total-laba-kotor td {
  font-weight: 700;
  background: #fff3e0;
}

.lr-table tbody tr.row-total-biaya td {
  font-weight: 700;
  background: #fde2e2;
}

.lr-table tbody tr.row-total-pendapatan td {
  font-weight: 700;
  background: #e0f7fa;
}

.lr-table tbody tr.row-net td {
  font-weight: 800;
  background: #c7f9cc;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}

.col-ket {
  width: 22%;
}

.col-total {
  width: 10%;
}

.print-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f0f3f8;
  border-bottom: 1px solid #c4cad3;
}

.tb {
  padding: 6px 18px;
  background: #0284c7;
  color: #fff;
  border: 1px solid #0369a1;
  border-radius: 0;
  cursor: pointer;
  font-size: 13px;
}

.tb:disabled {
  opacity: 0.5;
  cursor: default;
}

.tb-secondary {
  background: #fff;
  color: #0c4a6e;
}

.tb-loading,
.empty {
  font-size: 12px;
  color: #5a6a7e;
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-page {
    min-height: 0;
  }

  .lr-doc {
    padding: 0;
  }

  .lr-table {
    font-size: 8.5px;
  }

  .lr-table tr {
    page-break-inside: avoid;
  }
}
</style>

<style>
@page {
  size: A4 landscape;
  margin: 8mm;
}
</style>
