<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { estimasiSalesApi, type EstimasiSalesRow } from "@/api/laporan/estimasiSalesApi";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconReportMoney, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const now = new Date();
const bulan = ref(now.getMonth() + 1);
const tahun = ref(now.getFullYear());
const isLoading = ref(false);
const items = ref<EstimasiSalesRow[]>([]);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await estimasiSalesApi.getBrowse({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "no", title: "No", width: "44px", align: "center" },
  { key: "salesman", title: "Salesman", minWidth: "100px" },
  { key: "marketing", title: "Marketing", minWidth: "100px" },
  { key: "nama", title: "Nama Customer", minWidth: "180px" },
  { key: "pf", title: "PF", width: "110px", align: "end" },
  { key: "targetsales", title: "Target Sales", width: "110px", align: "end" },
  { key: "estimasisales", title: "Estimasi Sales", width: "110px", align: "end" },
  { key: "avgsales", title: "Avg Sales", width: "110px", align: "end" },
  { key: "realisasisales", title: "Realisasi Sales", width: "110px", align: "end" },
  { key: "ratiosales", title: "Ratio %", width: "80px", align: "end" },
  { key: "targetinkaso", title: "Target Inkaso", width: "110px", align: "end" },
  { key: "estimasiinkaso", title: "Estimasi Inkaso", width: "110px", align: "end" },
  { key: "realisasiinkaso", title: "Realisasi Inkaso", width: "110px", align: "end" },
  { key: "ratioinkaso", title: "Ratio %", width: "80px", align: "end" },
];

const moneyKeys = [
  "pf", "targetsales", "estimasisales", "avgsales", "realisasisales",
  "targetinkaso", "estimasiinkaso", "realisasiinkaso",
];

const ratioKeys = ["ratiosales", "ratioinkaso"];

const fmtMoney = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtRatio = (v: number) => v ? `${Number(v).toFixed(2)}%` : "-";

// Footer: sum for money columns + computed ratio
const summaryColumns = computed(() => {
  const cols = moneyKeys.map((k) => ({ key: k }));
  return cols;
});

// Manual footer: ratio = total realisasi / total target * 100
const totalTargetSales = computed(() => items.value.reduce((s, r) => s + (Number(r.targetsales) || 0), 0));
const totalRealisasiSales = computed(() => items.value.reduce((s, r) => s + (Number(r.realisasisales) || 0), 0));
const totalTargetInkaso = computed(() => items.value.reduce((s, r) => s + (Number(r.targetinkaso) || 0), 0));
const totalRealisasiInkaso = computed(() => items.value.reduce((s, r) => s + (Number(r.realisasiinkaso) || 0), 0));
const ratioSalesFooter = computed(() =>
  totalTargetSales.value > 0 ? ((totalRealisasiSales.value / totalTargetSales.value) * 100).toFixed(2) + "%" : "-"
);
const ratioInkasoFooter = computed(() =>
  totalTargetInkaso.value > 0 ? ((totalRealisasiInkaso.value / totalTargetInkaso.value) * 100).toFixed(2) + "%"
  : "-"
);

// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "no", title: "No", width: 6, align: "center" },
  { key: "salesman", title: "Salesman", width: 15 },
  { key: "marketing", title: "Marketing", width: 15 },
  { key: "nama", title: "Nama Customer", width: 25 },
  { key: "pf", title: "PF", width: 14, numFmt: "#,##0" },
  { key: "targetsales", title: "Target Sales", width: 14, numFmt: "#,##0" },
  { key: "estimasisales", title: "Estimasi Sales", width: 14, numFmt: "#,##0" },
  { key: "avgsales", title: "Avg Sales", width: 14, numFmt: "#,##0" },
  { key: "realisasisales", title: "Realisasi Sales", width: 14, numFmt: "#,##0" },
  { key: "ratiosales", title: "Ratio %", width: 10 },
  { key: "targetinkaso", title: "Target Inkaso", width: 14, numFmt: "#,##0" },
  { key: "estimasiinkaso", title: "Estimasi Inkaso", width: 14, numFmt: "#,##0" },
  { key: "realisasiinkaso", title: "Realisasi Inkaso", width: 14, numFmt: "#,##0" },
  { key: "ratioinkaso", title: "Ratio %", width: 10 },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r, i) => ({ ...r, no: i + 1 }));
    await exportStyledHeader({ title: "Laporan Estimasi Salesman vs Realisasi", subtitle: `Periode: ${BULAN[bulan.value - 1]} ${tahun.value}`, columns: exportColumns, items: exportItems as unknown as Record<string, any>[], fileName: "EstimasiSales" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};
</script>

<template>
  <BaseBrowse
    title="Laporan Estimasi Salesman vs Realisasi"
    :icon="IconReportMoney"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    item-value="kode_salesman"
    :auto-refresh="false"
    :summary-columns="summaryColumns"
    @refresh="loadData"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <select v-model.number="bulan" class="sel-inp">
          <option v-for="(b, i) in BULAN" :key="i" :value="i + 1">{{ b }}</option>
        </select>
        <span class="filter-lbl">Tahun</span>
        <input v-model.number="tahun" type="number" class="num-inp" min="2000" max="2099" />
      </div>
    </template>

    <template v-for="k in moneyKeys" :key="'cell-' + k" #[`item.${k}`]="{ value }">
      <span class="num-cell">{{ fmtMoney(value) }}</span>
    </template>
    <template #item.ratiosales="{ value }">
      <span class="num-cell">{{ fmtRatio(value) }}</span>
    </template>
    <template #item.ratioinkaso="{ value }">
      <span class="num-cell">{{ fmtRatio(value) }}</span>
    </template>

    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
    <template #summary-row>
      <span class="sum-lbl">TOTAL</span>
      <span class="sum-val">{{ ratioSalesFooter }}</span>
      <span class="sum-val">{{ ratioInkasoFooter }}</span>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.sel-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: white;
}
.sel-inp:focus { border-color: var(--ds-primary, #D97706); }
.num-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 72px;
}
.num-inp:focus { border-color: var(--ds-primary, #D97706); }
.num-cell { font-variant-numeric: tabular-nums; }
.sum-lbl { font-size: 12px; font-weight: 600; color: #374151; }
.sum-val { font-size: 12px; font-weight: 700; color: var(--ds-primary, #D97706); margin-left: 10px; }
</style>
