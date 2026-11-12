<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { getLapNeraca, type LapNeracaData } from "@/api/laporan/lapNeracaApi";
import { exportStyledBandedHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const STORAGE_KEY = "laporan_lapNeraca";
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

const data = ref<LapNeracaData>({ aktiva: [], pasiva: [] });
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    data.value = await getLapNeraca({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// Gabung aktiva & pasiva side-by-side (dua grid dxGrid di Delphi).
interface NeracaRow {
  no: number;
  aktivaAkun: string;
  aktivaNilai: number | null;
  pasivaAkun: string;
  pasivaNilai: number | null;
}

const items = computed<NeracaRow[]>(() => {
  const a = data.value.aktiva || [];
  const p = data.value.pasiva || [];
  const len = Math.max(a.length, p.length);
  const rows: NeracaRow[] = [];
  for (let i = 0; i < len; i++) {
    rows.push({
      no: i + 1,
      aktivaAkun: a[i]?.akun ?? "",
      aktivaNilai: a[i] ? a[i].nilai : null,
      pasivaAkun: p[i]?.akun ?? "",
      pasivaNilai: p[i] ? p[i].nilai : null,
    });
  }
  return rows;
});

const sum = (key: "aktiva" | "pasiva") =>
  (data.value[key] || []).reduce((s, r) => s + (r.nilai || 0), 0);

const bands = [
  { band: "Aktiva", span: 2, cols: [
    { key: "aktivaAkun", title: "Akun", align: "left" as const },
    { key: "aktivaNilai", title: "Nilai", align: "end" as const },
  ]},
  { band: "Pasiva", span: 2, cols: [
    { key: "pasivaAkun", title: "Akun", align: "left" as const },
    { key: "pasivaNilai", title: "Nilai", align: "end" as const },
  ]},
];

const headers = bands.flatMap((g) =>
  g.cols.map((c) => ({ key: c.key, title: c.title, align: c.align === "end" ? ("end" as const) : undefined })),
);
const headerKeys = headers.map((h) => h.key);

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v || 0);

const footerValues = computed<Record<string, string>>(() => ({
  aktivaNilai: fmt(sum("aktiva")),
  pasivaNilai: fmt(sum("pasiva")),
}));

const isExporting = ref(false);
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const cols: ExportColumn[] = headers.map((h) => ({
      key: h.key, title: h.title, width: 14,
      numFmt: h.key.endsWith("Nilai") ? "#,##0" : undefined,
    }));
    await exportStyledBandedHeader({
      title: "Laporan Neraca",
      subtitle: `Periode: ${palette[bulan.value - 1]} ${tahun.value}`,
      bands,
      columns: cols,
      items: items.value as unknown as Record<string, any>[],
      fileName: "LapNeraca",
    });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Laporan Neraca"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="no"
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

      <template v-for="key in headerKeys" :key="'cell-' + key" #[`item.${key}`]="{ value }">
        <span v-if="key.endsWith('Nilai')" class="num-cell">{{ value == null ? '' : fmt(value) }}</span>
        <span v-else>{{ value }}</span>
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
.band-cell { font-weight: 700; color: #1f2937; text-align: center; padding: 4px 8px; }
.sub-cell { font-weight: 600; color: #374151; }
.num-cell { font-variant-numeric: tabular-nums; }
</style>

<style>
.base-table thead tr.band-row th { position: sticky; top: 0; z-index: 2; }
</style>
