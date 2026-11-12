<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { getLapYtd, type LapYtdRow } from "@/api/laporan/lapYTDApi";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const STORAGE_KEY = "laporan_lapYtd";
const palette = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.bulan && s?.tahun) return s;
  } catch {}
  return null;
};
const saved = getSaved();

const tahun = ref(saved?.tahun ?? now.getFullYear());
const bulan = ref(saved?.bulan ?? now.getMonth() + 1);

watch([bulan, tahun], ([b, t]) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bulan: b, tahun: t })); } catch {}
});

const filterValues = computed(() => ({ bulan: bulan.value, tahun: tahun.value }));

const items = ref<LapYtdRow[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await getLapYtd({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// Bands (urutan dfm)
const bands = [
  { band: "Tahun", span: 1, cols: [{ key: "tahun", title: "Tahun" }] },
  { band: "Bulan", span: 1, cols: [{ key: "bulan", title: "Bulan" }] },
  { band: "Target", span: 1, cols: [{ key: "target", title: "Target" }] },
  { band: "Riil", span: 1, cols: [{ key: "pencapaian", title: "Riil" }] },
  { band: "%", span: 1, cols: [{ key: "presentase", title: "%" }] },
  { band: "Riil Tahun Lalu", span: 1, cols: [{ key: "pencapaianlalu", title: "Riil Tahun Lalu" }] },
  { band: "Growth", span: 1, cols: [{ key: "growth", title: "Growth" }] },
];

const headers = bands.map((b) => ({
  key: b.cols[0].key,
  title: b.cols[0].title,
  align: /^(tahun|bulan)$/.test(b.cols[0].key) ? (undefined as any) : "end" as const,
}));
const headerKeys = headers.map((h) => h.key);

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtPct = (v: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const cellFmt = (key: string, v: number) => {
  if (key === "presentase" || key === "growth") return fmtPct(v);
  return fmt(v);
};

// ── Export
const isExporting = ref(false);
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const cols: ExportColumn[] = headers.map((h) => ({ key: h.key, title: h.title, width: 14, numFmt: /^(tahun|bulan)$/.test(h.key) ? undefined : "#,##0" }));
    await exportStyledHeader({ title: "Laporan Year to Date", subtitle: `Periode: ${palette[bulan.value - 1]} ${tahun.value}`, columns: cols, items: items.value as unknown as Record<string, any>[], fileName: "LapYtd" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

// Footer (sum + ratio, persis dfm skSum & GetText)
const footer = computed(() => {
  const rows = items.value;
  const sTgt = rows.reduce((s, r) => s + (r.Target || 0), 0);
  const sRil = rows.reduce((s, r) => s + (r.Pencapaian || 0), 0);
  const sLalu = rows.reduce((s, r) => s + (r.PencapaianLalu || 0), 0);
  return [
    { key: "tahun", value: "Sub Total" },
    { key: "bulan", value: "" },
    { key: "target", value: fmt(sTgt) },
    { key: "pencapaian", value: fmt(sRil) },
    { key: "presentase", value: sTgt > 0 ? fmtPct((sRil / sTgt) * 100) : "0.00" },
    { key: "pencapaianlalu", value: fmt(sLalu) },
    { key: "growth", value: sLalu > 0 ? fmtPct((sRil / sLalu) * 100) : "0.00" },
  ];
});
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Laporan Year to Date"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="bulan"
      :filter-values="filterValues"
      :auto-refresh="false"
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
          <select v-model="bulan" class="sel-inp">
            <option v-for="(m, i) in palette" :key="i" :value="i + 1">{{ m }}</option>
          </select>
          <span class="filter-sep">Tahun</span>
          <select v-model="tahun" class="sel-inp">
            <option v-for="t in [now.getFullYear() - 1, now.getFullYear()]" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </template>

      <template #headers="{ columns }">
        <tr class="band-row">
          <template v-for="g in bands" :key="g.band">
            <th :colspan="g.span" class="band-cell">{{ g.band }}</th>
          </template>
        </tr>
        <tr>
          <template v-for="col in columns" :key="col.key">
            <th :class="['base-th', col.align ? `text-${col.align}` : '']" class="sub-cell">
              <span class="th-title">{{ col.title }}</span>
            </th>
          </template>
        </tr>
      </template>

      <template #item.bulan="{ value }">
        <span>{{ value }}</span>
      </template>
      <template v-for="key in headerKeys" :key="'cell-' + key" #[`item.${key}`]="{ value }">
        <span v-if="key !== 'tahun' && key !== 'bulan'" class="num-cell">{{ cellFmt(key, value) }}</span>
      </template>

      <template #summary-row>
        <template v-for="f in footer" :key="f.key">
          <span class="sum-cell" :class="{ 'sum-lbl': f.key === 'tahun' }">{{ f.value }}</span>
        </template>
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

.band-row { background: var(--ds-tab-bg, #eef1f6); }
.band-cell, .sub-cell {
  border-right: 1px solid var(--ds-border, #d0d5dd);
  border-bottom: 1px solid var(--ds-border, #d0d5dd);
  white-space: nowrap; font-size: 11px;
}
.band-cell { font-weight: 700; color: #1f2937; text-align: left; padding: 4px 8px; }
.sub-cell { font-weight: 600; color: #374151; }

.num-cell { font-variant-numeric: tabular-nums; }
.sum-cell { font-variant-numeric: tabular-nums; font-size: 12px; }
.sum-lbl { font-weight: 600; color: #374151; }
</style>

<style>
.base-table thead tr.band-row th { position: sticky; top: 0; z-index: 2; }
</style>