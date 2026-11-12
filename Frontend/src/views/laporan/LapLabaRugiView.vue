<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { getLapLabaRugi, type LapLabaRugiData } from "@/api/laporan/lapLabaRugiApi";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const STORAGE_KEY = "laporan_lapLabaRugi";
const palette = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.tahun && s?.bulan1 && s?.bulan2) return s;
  } catch {}
  return null;
};
const saved = getSaved();

const tahun = ref(saved?.tahun ?? now.getFullYear());
const bulan1 = ref(saved?.bulan1 ?? 1);
const bulan2 = ref(saved?.bulan2 ?? now.getMonth() + 1);

watch([bulan1, bulan2, tahun], ([b1, b2, t]) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bulan1: b1, bulan2: b2, tahun: t })); } catch {}
});

const filterValues = computed(() => ({ tahun: tahun.value, bulan1: bulan1.value, bulan2: bulan2.value }));

const data = ref<LapLabaRugiData>({ months: [], rows: [] });
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    data.value = await getLapLabaRugi({
      tahun: tahun.value,
      bulan1: bulan1.value,
      bulan2: bulan2.value,
    });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

const months = computed(() => data.value.months || []);

// Headers: Keterangan + kolom bulan (dinamis sesuai rentang) + Total
const headers = computed(() => [
  { key: "keterangan", title: "Keterangan", align: undefined as any },
  ...months.value.map((m) => ({ key: `m${m.bulan}`, title: m.label, align: "end" as const })),
  { key: "total", title: "Total", align: "end" as const },
]);
const headerKeys = computed(() => headers.value.map((h) => h.key));
const monthKeys = computed(() => months.value.map((m) => `m${m.bulan}`));

const items = computed<Record<string, any>[]>(() =>
  (data.value.rows || []).map((r, i) => {
    const o: Record<string, any> = {
      no: i + 1,
      keterangan: r.keterangan,
      isTotal: r.isTotal,
      total: r.total,
    };
    for (const m of months.value) o[`m${m.bulan}`] = r.nilai?.[m.bulan] ?? 0;
    return o;
  }),
);

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v || 0);

// Delphi: baris total diberi warna; LABA BERSIH dibedakan.
const rowPropsFn = (d: any) => {
  const raw = d?.item?.raw ?? d?.item ?? d;
  if (raw?.keterangan === "LABA BERSIH") return { class: "row-net" };
  if (raw?.isTotal) return { class: "row-total" };
  return {};
};

const periodeLabel = computed(() => {
  const ms = months.value;
  if (!ms.length) return String(tahun.value);
  return `${ms[0].label} - ${ms[ms.length - 1].label} ${tahun.value}`;
});

const isExporting = ref(false);
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const cols: ExportColumn[] = headers.value.map((h) => ({
      key: h.key, title: h.title, width: 14,
      numFmt: h.key === "keterangan" ? undefined : "#,##0",
    }));
    await exportStyledHeader({
      title: "Laporan Laba Rugi",
      subtitle: `Periode: ${periodeLabel.value}`,
      columns: cols,
      items: items.value as Record<string, any>[],
      fileName: "LapLabaRugi",
    });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Laporan Laba Rugi"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="no"
      :filter-values="filterValues"
      :auto-refresh="false"
      :auto-summary="false"
      :row-props-fn="rowPropsFn"
      @refresh="loadData"
    >
      <template #extra-actions>
        <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport" :loading="isExporting">
          <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
          <span class="tb-fkey">[F8]</span> Export
        </v-btn>
      </template>
      <template #filter-left>
        <div class="filter-group">
          <span class="filter-lbl">Periode</span>
          <select v-model="bulan1" class="sel-inp">
            <option v-for="(m, i) in palette" :key="'b1-' + i" :value="i + 1">{{ m }}</option>
          </select>
          <span class="filter-sep">s/d</span>
          <select v-model="bulan2" class="sel-inp">
            <option v-for="(m, i) in palette" :key="'b2-' + i" :value="i + 1">{{ m }}</option>
          </select>
          <span class="filter-sep">Tahun</span>
          <select v-model="tahun" class="sel-inp">
            <option v-for="t in [now.getFullYear() - 1, now.getFullYear()]" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </template>

      <template v-for="key in headerKeys" :key="'cell-' + key" #[`item.${key}`]="{ value }">
        <span v-if="key === 'keterangan'">{{ value }}</span>
        <span v-else class="num-cell">{{ fmt(value) }}</span>
      </template>
    </BaseBrowse>
  </div>
</template>

<style scoped>
.grid-tab { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; }
.sel-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: white; color: #374151;
}
.sel-inp:focus { border-color: var(--ds-primary, #D97706); }
.num-cell { font-variant-numeric: tabular-nums; }
</style>

<style>
.base-table tbody tr.row-total td { font-weight: 700; }
.base-table tbody tr.row-net td { font-weight: 800; background: #E8ECF1; }
</style>
