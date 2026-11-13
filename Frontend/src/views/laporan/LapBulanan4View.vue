<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { lapBulanan4Api, type LapBulanan4Row } from "@/api/laporan/lapBulanan4Api";
import { exportStyledBandedHeader, type ExportColumn } from "@/utils/styledExport";
import {
  IconFileInvoice,
  IconFileSpreadsheet,
  IconFilter,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-vue";
import ColumnFilter, {
  type ColumnFilterValue,
  type TextFilter,
} from "@/components/ColumnFilter.vue";

const toast = useToast();

// ── Filter (Bulan + Tahun) ───────────────────────────────────────────
const STORAGE_KEY = "laporan_lapBulanan4";

const palette = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();

// Delphi: edtTahun default tahun berjalan; cbbBulan default itemindex (bulan sekarang)
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

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<LapBulanan4Row[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await lapBulanan4Api.getBrowse({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Kolom (persis urutan band Delphi) ────────────────────────────────
// setiap grup: { band: nama band, sub: { key, title }[] }
const bands = [
  { band: "Rayon", span: 1, cols: [{ key: "rayon", title: "Rayon" }] },
  { band: "Salesman", span: 1, cols: [{ key: "salesman", title: "Salesman" }] },
  { band: "Target", span: 2, cols: [
    { key: "targetbulanini", title: "Bulan" },
    { key: "targetsdbulanini", title: "Sd. Bulan Ini" },
  ]},
  { band: "Omset Bulan Ini", span: 2, cols: [
    { key: "riilbulanini", title: "Riil Omset" },
    { key: "persenbulanini", title: "%" },
  ]},
  { band: "Omset sd Bulan Ini", span: 2, cols: [
    { key: "riilsdbulanini", title: "Riil Omset" },
    { key: "persensdbulanini", title: "%" },
  ]},
  { band: "Omset Bln ini (Thn Lalu)", span: 2, cols: [
    { key: "riilbulaninilalu", title: "Riil Omset" },
    { key: "growth", title: "Growth" },
  ]},
  { band: "Omset sd Bln ini (Thn Lalu)", span: 2, cols: [
    { key: "riilsdbulaninilalu", title: "Riil Omset" },
    { key: "growth2", title: "Growth" },
  ]},
  { band: "Target Thnan", span: 1, cols: [{ key: "targettahunan", title: "Target Thnan" }] },
  { band: "Ratio", span: 1, cols: [{ key: "ratio", title: "Ratio" }] },
  { band: "Piutang", span: 4, cols: [
    { key: "targetpiutang", title: "Target" },
    { key: "realisasipiutang", title: "Realisasi Tempo" },
    { key: "returpiutang", title: "Retur" },
    { key: "ratiopiutang", title: "Ratio" },
  ]},
  { band: "Plus Tunai", span: 4, cols: [
    { key: "targetallpiutang", title: "Target All" },
    { key: "realisasiall", title: "Realisasi All" },
    { key: "returallpiutang", title: "Retur All" },
    { key: "allratio", title: "Ratio All" },
  ]},
  { band: "Omset Other Bulan Ini", span: 1, cols: [
    { key: "riilbulanininonn3", title: "Riil Omset" },
  ]},
  { band: "Omset Other sd Bulan Ini", span: 1, cols: [
    { key: "riilsdbulanininonn3", title: "Riil Omset" },
  ]},
  { band: "Omset Other Bulan Ini (Thn Lalu)", span: 2, cols: [
    { key: "riilbulaninilalunonn3", title: "Riil Omset" },
    { key: "growthnonn3", title: "Growth" },
  ]},
  { band: "Omset Other sd Bln ini (Thn Lalu)", span: 2, cols: [
    { key: "riilsdbulaninilalunonn3", title: "Riil Omset" },
    { key: "growth2nonn3", title: "Growth" },
  ]},
  { band: "New Customer", span: 1, cols: [{ key: "newcustomer", title: "New Customer" }] },
  { band: "Rs,Pusk, Klinik", span: 1, cols: [{ key: "rsklinik", title: "Rs,Pusk, Klinik" }] },
];

// flatten headers utk BaseBrowse (butuh key + title)
const headers = bands.flatMap((g) =>
  g.cols.map((c) => ({ key: c.key, title: c.title, align: "end" as const })),
);
// pastikan kolom teks rata kiri
const textKeys = new Set(["rayon", "salesman"]);
const headersFinal = headers.map((h) =>
  textKeys.has(h.key) ? { ...h, align: undefined as any } : h,
);
const headerKeys = headersFinal.map((h) => h.key);

// ── Formating ────────────────────────────────────────────────────────
// Delphi: kolom uang pakai ',0;(,0)' → bulat tanpa koma; % pakai ',0.00'
const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// Delphi CustomDraw coloring
// baris warna: <70 merah, 70-100 ungu, >=100 hijau (persen & ratio)
const clsGe100 = (v: number) => (v < 100 ? "c-red" : "c-green");
const cls70 = (v: number) => (v < 70 ? "c-red" : v < 100 ? "c-purple" : "c-green");
const cls30 = (v: number) => (v < 30 ? "c-red" : "c-green");

const cellCls = (key: string, v: number) => {
  switch (key) {
    case "persenbulanini":
    case "persensdbulanini":
    case "persenbulanininonn3":
      return cls70(v);
    case "growth":
    case "growth2":
    case "growthnonn3":
    case "growth2nonn3":
      return clsGe100(v);
    case "ratiopiutang":
    case "allratio":
      return cls70(v);
    case "pfratio":
      return cls30(v);
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
    const cols: ExportColumn[] = headersFinal.map((h) => ({
      key: h.key, title: h.title, width: 12,
      numFmt: textKeys.has(h.key) ? undefined : "#,##0",
    }));
    await exportStyledBandedHeader({ title: "Laporan Sales Bulanan New", subtitle: `Periode: ${palette[bulan.value - 1]} ${tahun.value}`, bands, columns: cols, items: items.value as unknown as Record<string, any>[], fileName: "LapBulanan4" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

const cellFmt = (key: string, v: any) => {
  if (textKeys.has(key) || key === "newcustomer" || key === "rsklinik") return String(v ?? "");
  const pct = ["persenbulanini","persensdbulanini","growth","growth2","ratio","ratiopiutang",
    "allratio","pfratio","persenbulanininonn3","persensdbulanininonn3","growthnonn3","growth2nonn3"];
  if (pct.includes(key)) return fmtPct(v);
  return fmt(v);
};

// ── Filter kolom Rayon & Salesman ────────────────────────────────────
// Replikasi mesin filter BaseBrowse utk header banded custom (slot #headers
// menimpa header bawaan, jadi tombol filter dirender sendiri di sini).
const columnFilters = ref<Record<string, ColumnFilterValue>>({});
const activeFilterCol = ref<string | null>(null);
const filterDropdownStyle = ref<Record<string, string>>({});

const hasColFilter = (key: string) =>
  columnFilters.value[key] !== null && columnFilters.value[key] !== undefined;

const openColFilter = (key: string, e: MouseEvent) => {
  if (activeFilterCol.value === key) {
    activeFilterCol.value = null;
    return;
  }
  const btn = e.currentTarget as HTMLElement;
  const rect = btn.getBoundingClientRect();
  const POPUP_WIDTH = 190; // sama dengan lebar .cf-dropdown
  filterDropdownStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${Math.min(rect.left, window.innerWidth - POPUP_WIDTH - 8)}px`,
    zIndex: "300",
  };
  activeFilterCol.value = key;
};
const closeColFilter = () => {
  activeFilterCol.value = null;
};

const onFilterUpdate = (key: string | null, val: ColumnFilterValue | null) => {
  if (!key) return;
  if (val === null) {
    const next = { ...columnFilters.value };
    delete next[key];
    columnFilters.value = next;
  } else {
    columnFilters.value = { ...columnFilters.value, [key]: val };
  }
};

// Identik matchTextFilter BaseBrowse (operator contains/equals/starts_with/dll.)
const matchTextFilter = (val: any, f: TextFilter): boolean => {
  const s = String(val ?? "").toLowerCase();
  const fv = f.value.toLowerCase();
  switch (f.operator) {
    case "contains":
    case "search": return s.includes(fv);
    case "equals": return s === fv;
    case "not_contains": return !s.includes(fv);
    case "starts_with": return s.startsWith(fv);
    case "ends_with": return s.endsWith(fv);
    case "empty": return s === "";
    case "not_empty": return s !== "";
    default: return true;
  }
};

const filteredItems = computed<LapBulanan4Row[]>(() => {
  let result = items.value;
  for (const [key, filter] of Object.entries(columnFilters.value)) {
    if (!filter) continue;
    if ("allowed" in filter) {
      const allowed = filter.allowed as Set<string>;
      result = result.filter((r) => allowed.has(String((r as any)[key] ?? "")));
    } else if ("operator" in filter) {
      result = result.filter((r) => matchTextFilter((r as any)[key], filter as TextFilter));
    }
  }
  return result;
});

// ── Footer total (seperti Delphi: skSum + OnGetText ratio) ─────────────
// Sumber total = hasil filter, supaya TOTAL selalu cocok dgn baris terlihat.
const sum = (k: string) => filteredItems.value.reduce((s, r) => s + (Number((r as any)[k]) || 0), 0);
const ratio = (num: string, den: string) => (sum(den) > 0 ? (sum(num) / sum(den)) * 100 : 0);

const footerValues = computed<Record<string, string>>(() => {
  const sums: Record<string, string> = {
    targetbulanini: fmt(sum("targetbulanini")),
    targetsdbulanini: fmt(sum("targetsdbulanini")),
    riilbulanini: fmt(sum("riilbulanini")),
    persenbulanini: fmtPct(ratio("riilbulanini", "targetbulanini")),
    riilsdbulanini: fmt(sum("riilsdbulanini")),
    persensdbulanini: fmtPct(ratio("riilsdbulanini", "targetsdbulanini")),
    riilbulaninilalu: fmt(sum("riilbulaninilalu")),
    growth: fmtPct(ratio("riilbulanini", "riilbulaninilalu")),
    riilsdbulaninilalu: fmt(sum("riilsdbulaninilalu")),
    growth2: fmtPct(ratio("riilsdbulanini", "riilsdbulaninilalu")),
    targettahunan: fmt(sum("targettahunan")),
    ratio: fmtPct(ratio("riilsdbulanini", "targettahunan")),
targetpiutang: fmt(sum("targetpiutang")),
    targetallpiutang: fmt(sum("targetallpiutang")),
    realisasipiutang: fmt(sum("realisasipiutang")),
    returpiutang: fmt(sum("returpiutang")),
    returallpiutang: fmt(sum("returallpiutang")),
    // ratiopiutang pembilangnya Realisasi Tempo + Retur, jadi tidak bisa
    // pakai helper ratio() yang hanya menerima dua key.
    ratiopiutang: fmtPct(
      sum("targetpiutang") > 0
        ? ((sum("realisasipiutang") + sum("returpiutang")) / sum("targetpiutang")) * 100
        : 0,
    ),
    realisasiall: fmt(sum("realisasiall")),
    // allratio memakai Target All sebagai pembagi, sama seperti backend.
    allratio: fmtPct(
      sum("targetallpiutang") > 0
        ? (sum("realisasiall") / sum("targetallpiutang")) * 100
        : 0,
    ),
    riilbulanininonn3: fmt(sum("riilbulanininonn3")),
    riilsdbulanininonn3: fmt(sum("riilsdbulanininonn3")),
    riilbulaninilalunonn3: fmt(sum("riilbulaninilalunonn3")),
    growthnonn3: fmtPct(ratio("riilbulanininonn3", "riilbulaninilalunonn3")),
    riilsdbulaninilalunonn3: fmt(sum("riilsdbulaninilalunonn3")),
    growth2nonn3: fmtPct(ratio("riilsdbulanininonn3", "riilsdbulaninilalunonn3")),
    newcustomer: String(sum("newcustomer")),
  };
  return sums;
});

// ── Lebar kolom beku ───────────────────────────────────────────────────
// BaseBrowse memakai table-layout auto (fixed-layout=false), dan itu membuat
// browser mengabaikan width/max-width pada <td>/<th>. Kolom Rayon karena itu
// melebar mengikuti isi — "KARANGANYAR - SUKOHARJO" ≈ 165px, bukan 140px.
// Offset Salesman yang dikunci 140px jadi lebih kecil dari Rayon sehingga kolom
// menimpa. Lebar Rayon diukur lalu dipakai untuk offset Salesman lewat CSS var
// --freeze-w.
//
// Node <th> dibuang & dibuat ulang Vuetify setiap items berubah (pola yang sama
// dipakai injectTfoot di BaseBrowse), jadi ResizeObserver yang memegang node
// lama tidak pernah kedar. Karena itu pengukuran dipicu dari events yang pasti.
const wrapRef = ref<HTMLElement | null>(null);
const freezeW = ref(140);
const measureFreeze = () => {
  const el = wrapRef.value?.querySelector<HTMLElement>(".band-cell-frozen--1");
  if (el) freezeW.value = Math.round(el.getBoundingClientRect().width);
};

// ── Resize kolom (mirror BaseBrowse) ────────────────────────────────────
const colWidths = ref<Record<string, number>>({});
let resizing: { key: string; startX: number; startW: number } | null = null;
const MIN_COL = 50;
const onResizeStart = (key: string, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement;
  const currentW = th ? th.getBoundingClientRect().width : (colWidths.value[key] ?? 120);
  resizing = { key, startX: e.clientX, startW: currentW };
  const onMove = (ev: MouseEvent) => {
    if (!resizing) return;
    colWidths.value = {
      ...colWidths.value,
      [resizing.key]: Math.max(MIN_COL, resizing.startW + ev.clientX - resizing.startX),
    };
    if (resizing.key === "rayon" || resizing.key === "salesman") measureFreeze();
  };
  const onUp = () => {
    resizing = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    measureFreeze();
  };
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};
const colStyle = (key: string) => {
  const w = colWidths.value[key];
  return w ? { width: `${w}px`, minWidth: `${w}px` } : {};
};
// CSS var di wrapper: lebar kolom beku utk body (nth-child 1..2) + offset Salesman.
const freezeVars = computed<Record<string, string>>(() => ({
  "--freeze-w": `${freezeW.value}px`,
  "--fcol-rayon": `${colWidths.value.rayon || 140}px`,
  "--fcol-salesman": `${colWidths.value.salesman || 140}px`,
}));

// flush:"post" -> jalan setelah DOM ter-render, jadi nextTick tidak perlu.
// filteredItems ikut dipantau karena filter kolom beku mengubah isi tabel
// tanpa mengubah `items`.
watch([items, filteredItems], () => measureFreeze(), { flush: "post" });

onMounted(() => {
  nextTick(measureFreeze);
  window.addEventListener("resize", measureFreeze);
  // Font Google dimuat belakangan; sampai selesai kolom terukur dengan font
  // fallback yang lebih sempit.
  document.fonts?.ready.then(measureFreeze).catch(() => {});
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", measureFreeze);
});
</script>

<template>
  <div class="grid-tab" ref="wrapRef" :style="freezeVars">
    <BaseBrowse
      title="Laporan Sales Bulanan New"
      :icon="IconFileInvoice"
      :headers="headersFinal"
      :items="filteredItems"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="rayon"
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

      <!-- Header banded dua baris (persis group band Delphi) -->
      <template #headers="{ columns }">
        <tr class="band-row">
          <template v-for="g in bands" :key="g.band">
            <!-- Single-span: rowspan 2, no sub-header needed -->
            <th
              v-if="g.span === 1"
              rowspan="2"
              class="band-cell band-cell-span2"
              :style="colStyle(g.cols[0].key)"
              :class="[
                g.band.startsWith('Omset Other') ? 'band-special' : '',
                g.cols[0].key === 'rayon' ? 'band-cell-frozen band-cell-frozen--1' : '',
                g.cols[0].key === 'salesman' ? 'band-cell-frozen band-cell-frozen--2' : '',
              ]"
            >
              <!-- Kolom beku diberi tombol filter seperti header bawaan BaseBrowse -->
              <div
                v-if="g.cols[0].key === 'rayon' || g.cols[0].key === 'salesman'"
                class="th-inner-freeze"
              >
                <span class="th-title">{{ g.band }}</span>
                <button
                  type="button"
                  class="col-filter-btn-clone"
                  :class="{ active: hasColFilter(g.cols[0].key) }"
                  :title="`Filter ${g.band}`"
                  @click.stop="openColFilter(g.cols[0].key, $event)"
                >
                  <IconFilter v-if="hasColFilter(g.cols[0].key)" :size="11" :stroke-width="2.2" />
                  <IconAdjustmentsHorizontal v-else :size="11" :stroke-width="2.2" />
                </button>
              </div>
              <template v-else>{{ g.band }}</template>
              <div class="col-resize-handle" @mousedown.stop="onResizeStart(g.cols[0].key, $event)" />
            </th>
            <!-- Multi-span: colspan only, sub-header below -->
            <th
              v-else
              :colspan="g.span"
              class="band-cell"
              :class="{ 'band-special': g.band.startsWith('Omset Other') }"
            >
              {{ g.band }}
            </th>
          </template>
        </tr>
        <tr>
          <template v-for="g in bands" :key="g.band + '-sub'">
            <template v-if="g.span > 1">
              <th
                v-for="col in g.cols"
                :key="col.key"
                :style="colStyle(col.key)"
                :class="['base-th', 'sub-cell']"
              >
                <span class="th-title">{{ col.title }}</span>
                <div class="col-resize-handle" @mousedown.stop="onResizeStart(col.key, $event)" />
              </th>
            </template>
          </template>
        </tr>
      </template>

      <template v-for="key in headerKeys" :key="'cell-' + key" #[`item.${key}`]="{ value }">
        <span :class="['num-cell', cellCls(key, value)]">{{ cellFmt(key, value) }}</span>
      </template>
    </BaseBrowse>

    <Teleport to="body">
      <ColumnFilter
        v-if="activeFilterCol"
        filter-type="select"
        :column-key="activeFilterCol"
        :title="activeFilterCol === 'rayon' ? 'Rayon' : 'Salesman'"
        :items="items"
        :model-value="activeFilterCol ? columnFilters[activeFilterCol] ?? null : null"
        :dropdown-style="filterDropdownStyle"
        @update:model-value="onFilterUpdate(activeFilterCol, $event)"
        @close="closeColFilter"
      />
    </Teleport>
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

.band-row { background: var(--ds-tab-bg, #eef1f6); }
.band-cell, .sub-cell {
  position: relative;
  border-right: 1px solid var(--ds-border, #d0d5dd);
  border-bottom: 1px solid var(--ds-border, #d0d5dd);
  white-space: nowrap; font-size: 11px;
}
.band-cell { font-weight: 700; color: #1f2937; text-align: left; padding: 4px 8px; }
.band-cell-span2 { vertical-align: middle; text-align: center; background: var(--ds-tab-bg, #eef1f6); }
.band-special { color: var(--ds-primary, #0284c7); }
.sub-cell { font-weight: 600; color: #374151; }

.num-cell { font-variant-numeric: tabular-nums; }
.c-red { color: #c62828; font-weight: 700; }
.c-purple { color: #8e24aa; font-weight: 700; }
.c-green { color: #2e7d32; font-weight: 700; }

/* ── Freeze kolom Rayon & Salesman ────────────────────────────────────
   Kolom tetap terlihat saat tabel digulir horizontal. Lebar Rayon TIDAK bisa
   dipatok di sini: table-layout auto mengabaikan width/max-width pada sel,
   jadi hanya min-width yang berlaku. Offset Salesman diambil dari --freeze-w
   (Lebar Rayon terukur runtime), bukan angka tetap. */
.band-cell-frozen {
  position: sticky !important;
  z-index: 3 !important;
  min-width: 140px;
}
.band-cell-frozen--1 { left: 0 !important; }
.band-cell-frozen--2 { left: var(--freeze-w, 140px) !important; }

:deep(.base-table tbody td:nth-child(1)),
:deep(.base-table tbody td:nth-child(2)) {
  position: sticky;
  z-index: 3;
}
:deep(.base-table tbody td:nth-child(1)) {
  left: 0;
  min-width: var(--fcol-rayon, 140px);
}
:deep(.base-table tbody td:nth-child(2)) {
  left: var(--freeze-w, 140px);
  min-width: var(--fcol-salesman, 140px);
}

/* Grip resize kolom (di tepi kanan header sel) */
.col-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  border-right: 2px solid #9AA6B5;
}
.col-resize-handle:hover,
.col-resize-handle:active {
  border-right-color: #0284c7;
}

/* Latar kolom beku mengikuti zebra baris (lihat di bawah) — tetap opaque,
   kalau tidak baris lain bocor ke bawahnya saat digulir. Hover menang atas
   zebra, sama seperti aturan BaseBrowse. */
:deep(.base-table tbody tr:nth-child(odd) td:nth-child(-n+2)) { background: #F0F3F8; }
:deep(.base-table tbody tr:nth-child(even) td:nth-child(-n+2)) { background: #E4EBF4; }
:deep(.base-table tbody tr:hover td:nth-child(-n+2)) {
  background: #D8E2EF !important;
}

/* Tombol filter di header beku (varian terang, band header latar terang) */
.th-inner-freeze {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
}
.col-filter-btn-clone {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 1px solid #A0AAB8;
  border-radius: 0;
  background: #F0F3F8;
  color: #0284c7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.col-filter-btn-clone:hover {
  background: #E8EDF5;
  border-color: #0369a1;
  color: #0369a1;
}
.col-filter-btn-clone.active {
  background: #7dd3fc;
  border-color: #7dd3fc;
  color: #1a1a1a;
}
</style>

<style>
/* pastikan header banded rata atas tabel */
.base-table thead tr.band-row th { position: sticky; top: 0; z-index: 2; }

/* Footer TOTAL ikut beku di kolom Rayon & Salesman. Offset Salesman memakai
   --freeze-w yang sama dengan header & body supaya garis freeze lurus. */
.base-table tfoot td.summary-tfoot-td:nth-child(-n+2) {
  position: sticky;
  bottom: 0;
  z-index: 3;
  background: var(--ds-surface-window, #E8ECF1);
}
.base-table tfoot td.summary-tfoot-td:nth-child(1) {
  left: 0;
  min-width: var(--fcol-rayon, 140px);
}
.base-table tfoot td.summary-tfoot-td:nth-child(2) {
  left: var(--freeze-w, 140px);
  min-width: var(--fcol-salesman, 140px);
  border-left: 1px solid var(--ds-border, #A0AAB8);
}
</style>