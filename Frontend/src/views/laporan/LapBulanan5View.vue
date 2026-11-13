<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { getLapBulanan5, type LapBulanan5Row } from "@/api/laporan/lapBulanan5Api";
import { exportStyledBandedHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const STORAGE_KEY = "laporan_lapBulanan5";
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
const onlySalesman = ref(true);

watch([bulan, tahun, onlySalesman], ([b, t, o]) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bulan: b, tahun: t, onlySalesman: o })); } catch {}
});

const filterValues = computed(() => ({ bulan: bulan.value, tahun: tahun.value, onlySalesman: onlySalesman.value }));

const items = ref<LapBulanan5Row[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await getLapBulanan5({ bulan: bulan.value, tahun: tahun.value, onlySalesman: onlySalesman.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Band (urutan persis dfm), hanya band visible ──────────────────
const bands = [
  { band: "Departemen", span: 1, cols: [{ key: "Departemen", title: "Departemen" }] },
  { band: "Target", span: 2, cols: [
    { key: "TargetBulanini", title: "Bulan" },
    { key: "Targetsdbulanini", title: "Sd. Bulan Ini" },
  ]},
  { band: "Omset Bulan Ini", span: 2, cols: [
    { key: "riilbulanini", title: "Riil Omset" },
    { key: "persenbulanini", title: "%" },
  ]},
  { band: "Omset sd Bulan Ini", span: 2, cols: [
    { key: "riilsdbulanini", title: "Nominal" },
    { key: "persensdbulanini", title: "%" },
  ]},
  { band: "Omset Bln ini (Thn Lalu)", span: 2, cols: [
    { key: "riilbulaninilalu", title: "Riil Omset" },
    { key: "growth", title: "Growth" },
  ]},
  { band: "Omset sd Bln ini (Thn Lalu)", span: 2, cols: [
    { key: "riilsdbulaniniLalu", title: "Nominal" },
    { key: "growth2", title: "Growth" },
  ]},
  { band: "Target Thnan", span: 1, cols: [{ key: "targettahunan", title: "Target Thnan" }] },
  { band: "Ratio", span: 1, cols: [{ key: "ratio", title: "Ratio" }] },
];

const headers = bands.flatMap((g) => g.cols.map((c) => ({
  key: c.key,
  title: c.title,
  align: c.key === "Departemen" ? (undefined as any) : "end" as const,
})));
const headerKeys = headers.map((h) => h.key);

// ── Formatting & warna (CustomDraw Delphi) ─────────────────────────
// Delphi: kolom uang ',0;(,0)' → bulat tanpa koma; % ',0.00' → 2 desimal
// Kolom target turunan (Target/Target Sd/%/Ratio) bernilai null untuk
// departemen tanpa target: tampil kosong, bukan "0", karena 0 berarti
// "punya target dan tidak tercapai".
const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const TARGET_KEYS = ["TargetBulanini", "Targetsdbulanini", "persenbulanini", "persensdbulanini", "targettahunan", "ratio"];
const cellFmt = (key: string, v: number | null) =>
  v === null || v === undefined ? "" : (TARGET_KEYS.includes(key) || ["growth", "growth2"].includes(key) ? fmtPct(v) : fmt(v));

const cls70 = (v: number) => (v < 70 ? "c-red" : v < 100 ? "c-purple" : "c-green");
const cls100 = (v: number) => (v < 100 ? "c-red" : "c-green");

const cellCls = (key: string, v: number | null) => {
  if (v === null || v === undefined) return "c-none";
  switch (key) {
    case "persenbulanini":
    case "persensdbulanini":
      return cls70(v);
    case "growth":
    case "growth2":
      return cls100(v);
    default:
      return "";
  }
};

// ── Export
const isExporting = ref(false);
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const cols: ExportColumn[] = headers.map((h) => ({ key: h.key, title: h.title, width: 14, numFmt: h.key === "Departemen" ? undefined : "#,##0" }));
    await exportStyledBandedHeader({ title: "Laporan Sales Departemen", subtitle: `Periode: ${palette[bulan.value - 1]} ${tahun.value}`, bands, columns: cols, items: items.value as unknown as Record<string, any>[], fileName: "LapBulanan5" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

// ── Footer (sum + ratio, "TOTAL" label — seperti lapBulanan4) ──────
const rowCls = (it: LapBulanan5Row) => (it.Departemen === "TOTAL" ? "row-total" : "");
// Kolom null diabaikan: `|| 0` sudah menanganinya, tapi Number(null) = 0
// eksplisit supaya kebaca. Riil tidak pernah null jadi tidak berubah.
const sumKey = (rows: LapBulanan5Row[], key: keyof LapBulanan5Row) =>
  rows.filter((r) => r.Departemen !== "TOTAL").reduce((s, r) => s + (Number(r[key]) || 0), 0);

const footerValues = computed<Record<string, string>>(() => {
  const rows = items.value;
  const tBi = sumKey(rows, "TargetBulanini");
  const tSdB = sumKey(rows, "Targetsdbulanini");
  const rB = sumKey(rows, "riilbulanini");
  const rSdB = sumKey(rows, "riilsdbulanini");
  const rBiL = sumKey(rows, "riilbulaninilalu");
  const rSdBuL = sumKey(rows, "riilsdbulaniniLalu");
  const tThn = sumKey(rows, "targettahunan");
  return {
    TargetBulanini: fmt(tBi),
    Targetsdbulanini: fmt(tSdB),
    riilbulanini: fmt(rB),
    persenbulanini: tBi > 0 ? fmtPct((rB / tBi) * 100) : "0.00",
    riilsdbulanini: fmt(rSdB),
    persensdbulanini: tSdB > 0 ? fmtPct((rSdB / tSdB) * 100) : "0.00",
    riilbulaninilalu: fmt(rBiL),
    growth: rBiL > 0 ? fmtPct((rB / rBiL) * 100) : "0.00",
    riilsdbulaniniLalu: fmt(rSdBuL),
    growth2: rSdBuL > 0 ? fmtPct((rSdB / rSdBuL) * 100) : "0.00",
    targettahunan: fmt(tThn),
    ratio: tThn > 0 ? fmtPct((rSdB / tThn) * 100) : "0.00",
  };
});
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Laporan Sales Departemen"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="ktg_kode"
      :filter-values="filterValues"
      :auto-refresh="false"
      :footer-values="footerValues"
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

      <template #filter-right>
        <label class="chk-inp">
          <input type="checkbox" v-model="onlySalesman" />
          <span>Only Salesman</span>
        </label>
      </template>

      <!-- Header banded dua baris -->
      <template #headers="{ columns }">
        <tr class="band-row">
          <template v-for="g in bands" :key="g.band">
            <th v-if="g.span === 1" rowspan="2" class="band-cell band-cell-span2">{{ g.band }}</th>
            <th v-else :colspan="g.span" class="band-cell">{{ g.band }}</th>
          </template>
        </tr>
        <tr>
          <template v-for="g in bands" :key="g.band + '-sub'">
            <template v-if="g.span > 1">
              <th v-for="col in g.cols" :key="col.key" :class="['base-th', 'sub-cell']">
                <span class="th-title">{{ col.title }}</span>
              </th>
            </template>
          </template>
        </tr>
      </template>

      <!-- Sel data + highlight row TOTAL -->
      <template #item.Departemen="{ item }">
        <span :class="rowCls(item)">{{ item.Departemen }}</span>
        <span v-if="!item.hasTarget" class="no-target" title="Belum ada target sales untuk departemen ini"> — belum ada target</span>
      </template>
      <template v-for="key in headerKeys.slice(1)" :key="'cell-' + key" #[`item.${key}`]="{ value, item }">
        <span :class="['num-cell', cellCls(key, value), rowCls(item)]">{{ cellFmt(key, value) }}</span>
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
.sel-inp:focus { border-color: var(--ds-primary, #0284c7); }
.chk-inp { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #374151; cursor: pointer; }
.chk-inp input { accent-color: var(--ds-primary, #0284c7); cursor: pointer; }

.band-row { background: var(--ds-tab-bg, #eef1f6); }
.band-cell, .sub-cell {
  border-right: 1px solid var(--ds-border, #d0d5dd);
  border-bottom: 1px solid var(--ds-border, #d0d5dd);
  white-space: nowrap; font-size: 11px;
}
.band-cell { font-weight: 700; color: #1f2937; text-align: left; padding: 4px 8px; }
.band-cell-span2 { vertical-align: middle; text-align: center; background: var(--ds-tab-bg, #eef1f6); }
.sub-cell { font-weight: 600; color: #374151; }

.row-total { background: var(--ds-moneygreen, #c7f9cc); font-weight: 700; }
.num-cell { font-variant-numeric: tabular-nums; }
.c-red { color: #c62828; font-weight: 700; }
.c-purple { color: #8e24aa; font-weight: 700; }
.c-green { color: #2e7d32; font-weight: 700; }
/* Kolom tanpa target: netral, tanpa warna capaian — bukan "0" dan bukan merah. */
.c-none { color: var(--ds-text-muted, #9ca3af); }
.no-target { color: var(--ds-text-muted, #9ca3af); font-size: 10px; font-style: italic; }
</style>

<style>
.base-table thead tr.band-row th { position: sticky; top: 0; z-index: 2; }
</style>