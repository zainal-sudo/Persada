<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type Ref } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { komisiSalesmanApi, type Grid1Row, type Grid2Row } from "@/api/komisi/komisiSalesmanApi";
import {
  IconCash,
  IconRefresh,
  IconSearch,
  IconDatabaseOff,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-vue";

const toast = useToast();

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const now = new Date();
const bulan = ref(now.getMonth() + 1);
const tahun = ref(now.getFullYear());
const isLoading = ref(false);

const grid1 = ref<Grid1Row[]>([]);
const grid2 = ref<Grid2Row[]>([]);

const loadData = async () => {
  isLoading.value = true;
  try {
    const d = await komisiSalesmanApi.get(bulan.value, tahun.value);
    grid1.value = d.grid1;
    grid2.value = d.grid2;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

const fmtMoney = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtRatio = (v: number) => (v ? `${Number(v).toFixed(2)}%` : "-");

// ── Pencarian instan per grid ─────────────────────────────────────
const cari1 = ref("");
const cari2 = ref("");
const grid1Search = computed(() => {
  const q = cari1.value.trim().toLowerCase();
  if (!q) return grid1.value;
  return grid1.value.filter((r) =>
    [r.rayon, r.salesman].some((x) => String(x ?? "").toLowerCase().includes(q)),
  );
});
const grid2Search = computed(() => {
  const q = cari2.value.trim().toLowerCase();
  if (!q) return grid2.value;
  return grid2.value.filter((r) => String(r.salesman ?? "").toLowerCase().includes(q));
});

// ── Band config (paritas Delphi ufrmKomisiSalesman.dfm) ───────────
type BandCol = { key: string; title: string; sortable?: boolean };
type Band = { band: string; span: number; cols: BandCol[] };

const bands1: Band[] = [
  { band: "Rayon", span: 1, cols: [{ key: "rayon", title: "Rayon", sortable: false }] },
  { band: "Salesman", span: 1, cols: [{ key: "salesman", title: "Salesman", sortable: false }] },
  { band: "Penjualan", span: 3, cols: [
    { key: "target_jual", title: "Target" },
    { key: "realisasi_jual", title: "Realisasi" },
    { key: "persentase_jual", title: "%" },
  ]},
  { band: "Penjualan Others", span: 3, cols: [
    { key: "target_other", title: "Target" },
    { key: "realisasi_other", title: "Realisasi" },
    { key: "persentase_other", title: "%" },
  ]},
  { band: "Product Focus", span: 2, cols: [
    { key: "realisasi_pf", title: "PF" },
    { key: "ratio_pf", title: "% PF" },
  ]},
  { band: "Piutang", span: 5, cols: [
    { key: "target_piutang", title: "Tgt Piutang" },
    { key: "realisasi_tempo", title: "Realisasi Tempo" },
    { key: "persentase_tempo", title: "% Tempo" },
    { key: "realisasi_all", title: "Realisasi All" },
    { key: "persentase_piutang", title: "% Inkaso" },
  ]},
];
const bands2: Band[] = [
  { band: "Salesman", span: 1, cols: [{ key: "salesman", title: "Salesman", sortable: false }] },
  { band: "Inkaso Riil", span: 1, cols: [{ key: "riil", title: "Inkaso Riil" }] },
  { band: "Giro Bulan Lalu", span: 1, cols: [{ key: "girolalu", title: "Giro Bulan Lalu" }] },
  { band: "Pengurang", span: 4, cols: [
    { key: "biaya_promosi", title: "Biaya Promosi" },
    { key: "fee_marketing", title: "Fee Marketing" },
    { key: "kontrak", title: "Kontrak" },
    { key: "batas", title: "Dasar Tagihan" },
  ]},
  { band: "Pengali", span: 4, cols: [
    { key: "pengali", title: "7-40 Hari" },
    { key: "pengali2", title: "40-60 Hari" },
    { key: "pengali3", title: ">60 Hari" },
    { key: "pengali4", title: "Cash" },
  ]},
  { band: "Komisi Penjualan", span: 1, cols: [{ key: "komisi_jual", title: "Komisi Penjualan" }] },
  { band: "Komisi Inkaso 7-40", span: 2, cols: [
    { key: "persen", title: "%" },
    { key: "nilai", title: "Nilai" },
  ]},
  { band: "Komisi Inkaso 40-60", span: 2, cols: [
    { key: "persen2", title: "%" },
    { key: "nilai2", title: "Nilai" },
  ]},
  { band: "Komisi >60", span: 2, cols: [
    { key: "persen3", title: "%" },
    { key: "nilai3", title: "Nilai" },
  ]},
  { band: "Komisi <=7", span: 2, cols: [
    { key: "persen4", title: "%" },
    { key: "nilai4", title: "Nilai" },
  ]},
  { band: "Komisi PF", span: 1, cols: [{ key: "komisipf", title: "Komisi PF" }] },
  { band: "Komisi Others", span: 1, cols: [{ key: "komisiothers", title: "Komisi Others" }] },
  { band: "Total Komisi", span: 1, cols: [{ key: "total", title: "Total Komisi" }] },
];

const head1 = bands1.flatMap((g) =>
  g.cols.map((c) => ({ key: c.key, title: c.title, sortable: c.sortable ?? true })),
);
const head2 = bands2.flatMap((g) =>
  g.cols.map((c) => ({ key: c.key, title: c.title, sortable: c.sortable ?? true })),
);
const keys1 = head1.map((h) => h.key);
const keys2 = head2.map((h) => h.key);

const money1 = new Set(["target_jual", "realisasi_jual", "target_other", "realisasi_other", "realisasi_pf", "target_piutang", "realisasi_tempo", "realisasi_all"]);
const ratio1 = new Set(["persentase_jual", "persentase_other", "ratio_pf", "persentase_piutang", "persentase_tempo"]);
const money2 = new Set(["riil", "girolalu", "biaya_promosi", "fee_marketing", "kontrak", "batas", "pengali", "pengali2", "pengali3", "pengali4", "komisi_jual", "nilai", "nilai2", "nilai3", "nilai4", "komisipf", "komisiothers", "total"]);
const ratio2 = new Set(["persen", "persen2", "persen3", "persen4"]);

const fmtCell1 = (k: string, r: Grid1Row) => {
  if (ratio1.has(k)) return fmtRatio(Number((r as any)[k]));
  if (money1.has(k)) return fmtMoney(Number((r as any)[k]));
  return String((r as any)[k] ?? "");
};
const fmtCell2 = (k: string, r: Grid2Row) => {
  if (ratio2.has(k)) return fmtRatio(Number((r as any)[k]));
  if (money2.has(k)) return fmtMoney(Number((r as any)[k]));
  return String((r as any)[k] ?? "");
};

// ── Sort manual per kolom (paritas toggleSort BaseBrowse) ─────────
const sortState = ref<{ key1: string; dir1: -1 | 1; key2: string; dir2: -1 | 1 }>({
  key1: "kode", dir1: 1, key2: "", dir2: 1,
});
const toggleSort1 = (c: BandCol) => {
  const cur = sortState.value;
  if (cur.key1 === c.key) cur.dir1 = cur.dir1 === 1 ? -1 : 1;
  else { cur.key1 = c.key; cur.dir1 = 1; }
  sortState.value = { ...cur };
};
const toggleSort2 = (c: BandCol) => {
  const cur = sortState.value;
  if (cur.key2 === c.key) cur.dir2 = cur.dir2 === 1 ? -1 : 1;
  else { cur.key2 = c.key; cur.dir2 = 1; }
  sortState.value = { ...cur };
};
const sortIcon = (key: string, idx: 1 | 2) => {
  const st = sortState.value;
  const active = idx === 1 ? st.key1 === key : st.key2 === key;
  if (!active) return "";
  return (idx === 1 ? st.dir1 : st.dir2) === 1 ? "asc" : "desc";
};

const sortRows1 = (list: Grid1Row[]) => {
  const { key1, dir1 } = sortState.value;
  if (!key1) return list;
  return [...list].sort((a, b) =>
    (Number((a as any)[key1] ?? 0) - Number((b as any)[key1] ?? 0)) * dir1,
  );
};
const sortRows2 = (list: Grid2Row[]) => {
  const { key2, dir2 } = sortState.value;
  if (!key2) return list;
  return [...list].sort((a, b) =>
    (Number((a as any)[key2] ?? 0) - Number((b as any)[key2] ?? 0)) * dir2,
  );
};

const grid1Items = computed(() => sortRows1(grid1Search.value));
const grid2Items = computed(() => sortRows2(grid2Search.value));

// ── Footer grid1 ──────────────────────────────────────────────────
const sum1 = (k: string) => grid1Search.value.reduce((s, r) => s + (Number((r as any)[k]) || 0), 0);
const foot1 = computed(() => {
  const totT = sum1("target_jual");
  const totR = sum1("realisasi_jual");
  const totUtang = sum1("target_piutang");
  const totAll = sum1("realisasi_all");
  const val: Record<string, string> = {
    rayon: "TOTAL",
    salesman: "",
    target_jual: fmtMoney(totT),
    realisasi_jual: fmtMoney(totR),
    persentase_jual: fmtRatio(totT > 0 ? (totR / totT) * 100 : 0),
    target_other: fmtMoney(sum1("target_other")),
    realisasi_other: fmtMoney(sum1("realisasi_other")),
    persentase_other: fmtRatio(sum1("persentase_other")),
    realisasi_pf: fmtMoney(sum1("realisasi_pf")),
    ratio_pf: "",
    target_piutang: fmtMoney(totUtang),
    realisasi_tempo: fmtMoney(sum1("realisasi_tempo")),
    persentase_tempo: "",
    realisasi_all: fmtMoney(totAll),
    persentase_piutang: fmtRatio(totUtang > 0 ? (totAll / totUtang) * 100 : 0),
  };
  return val;
});

// ── Footer grid2 ──────────────────────────────────────────────────
const sum2 = (k: string) => grid2Search.value.reduce((s, r) => s + (Number((r as any)[k]) || 0), 0);
const foot2 = computed(() => {
  const val: Record<string, string> = {};
  for (const k of keys2) val[k] = k === "salesman" ? "TOTAL" : fmtMoney(sum2(k));
  return val;
});

// ── Drag-resize kolom (paritas BaseBrowse) ────────────────────────
type Resize = { key: string; startX: number; startW: number } | null;
const colWidths = ref<Record<string, number>>({});
let resizing: Resize = null;

const onResizeStart = (key: string, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement;
  const currentW = th ? th.getBoundingClientRect().width : (colWidths.value[key] ?? 100);
  resizing = { key, startX: e.clientX, startW: currentW };
  const onMove = (ev: MouseEvent) => {
    if (!resizing) return;
    const w = Math.max(60, resizing.startW + ev.clientX - resizing.startX);
    colWidths.value = { ...colWidths.value, [resizing.key]: w };
  };
  const onUp = () => {
    resizing = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};

const colStyle = (key: string, title: string) => {
  // Setelah rakit resize, tetap pakai lebar hasil geser; default kosong =
  // table-layout auto (kolom melar sesuai konten).
  if (colWidths.value[key]) return { width: `${colWidths.value[key]}px`, minWidth: `${colWidths.value[key]}px` };
  if (key === "rayon") return { minWidth: "150px" };
  if (key === "salesman") return { minWidth: "170px" };
  return {};
};

// ── Lebar kolom beku (paritas LapBulanan4) ────────────────────────
// `table-layout: auto` membuat browser mengabaikan width/max-width pada
// <td>/<th>, jadi kolom Rayon melebar mengikuti isi (bisa ≥165px utk
// "KARANGANYAR - SUKOHARJO"). Offset Salesman dikunci 150px sebelumnya
// lebih kecil dari Rayon sehingga kolom menimpa. Lebar Rayon diukur
// runtime lalu dipakai via CSS var --freeze-w1 (sama dgn LapBulanan4).
const wrapRef = ref<HTMLElement | null>(null);
const freezeW1 = ref(150);
const measureFreeze = () => {
  const el = wrapRef.value?.querySelector<HTMLElement>(".freeze-2 .band-cell-frozen--1");
  if (el) freezeW1.value = Math.round(el.getBoundingClientRect().width);
};
watch([grid1Search, colWidths], () => measureFreeze(), { flush: "post" });
onMounted(() => {
  nextTick(measureFreeze);
  window.addEventListener("resize", measureFreeze);
  document.fonts?.ready.then(measureFreeze).catch(() => {});
});
onBeforeUnmount(() => window.removeEventListener("resize", measureFreeze));

// ── Baris TOTAL dibuat <tfoot> asli (paritas BaseBrowse injectTfoot) ──
// `#body.append` menaruh <tr> DI DALAM <tbody>, sehingga kena zebra tbody
// dan aturan `tbody tr {height}`; selektor freeze jadi berebut dan baris
// TOTAL tidak duduk stabil. <tfoot> asli berada di luar <tbody>, jadi
// freeze-kirinya bisa diatur khusus tanpa konflik.
const tblWrap1 = ref<HTMLElement | null>(null);
const tblWrap2 = ref<HTMLElement | null>(null);

const styleTd = (td: HTMLTableCellElement, k: string, _grid: 1 | 2) => {
  if (k === "rayon" || k === "salesman") {
    td.classList.add("tfoot-label");
  } else {
    td.classList.add("tfoot-val");
  }
};

const injectTfoot = (wrap: Ref<HTMLElement | null>, keys: string[], foot: Record<string, string>, grid: 1 | 2) => {
  nextTick(() => {
    const wrapper = wrap.value?.querySelector(".v-table__wrapper") as HTMLElement | null;
    const table = wrapper?.querySelector("table") as HTMLTableElement | null;
    if (!table) return;
    table.querySelector("tfoot")?.remove();
    const hasItems = grid === 1 ? grid1Search.value.length > 0 : grid2Search.value.length > 0;
    if (!hasItems) return;
    const tr = document.createElement("tr");
    tr.className = "comm-tfoot";
    for (const k of keys) {
      const td = document.createElement("td");
      td.className = "commit-tfoot-td";
      td.textContent = foot[k] ?? "";
      styleTd(td, k, grid);
      tr.appendChild(td);
    }
    const tfoot = document.createElement("tfoot");
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  });
};

const injectTfoot1 = () => injectTfoot(tblWrap1, keys1, foot1.value, 1);
const injectTfoot2 = () => injectTfoot(tblWrap2, keys2, foot2.value, 2);
watch([grid1Search, colWidths, foot1], injectTfoot1, { flush: "post" });
watch([grid2Search, colWidths, foot2], injectTfoot2, { flush: "post" });
onMounted(() => { nextTick(() => { injectTfoot1(); injectTfoot2(); }); });
</script>

<template>
  <PageLayout title="Komisi Salesman" :icon="IconCash" :loading="isLoading">
    <template #header-actions>
      <span class="flt-lbl">Periode</span>
      <select v-model.number="bulan" class="flt-sel">
        <option v-for="(b, i) in BULAN" :key="i" :value="i + 1">{{ b }}</option>
      </select>
      <input v-model.number="tahun" type="number" class="flt-num" min="2000" max="2099" />
      <v-btn size="small" class="tb-btn tb-btn-neutral" :loading="isLoading" @click="loadData">
        <template #prepend><IconRefresh :size="13" :stroke-width="1.8" /></template>
        Load
      </v-btn>
    </template>

    <div ref="wrapRef" class="comm-wrap" :style="{ '--freeze-w1': freezeW1 + 'px' }">
      <!-- ═══ GRID 1: Rekap Penjualan / Piutang ═══ -->
      <section class="grid-block">
        <div class="grid-bar">
          <div class="grid-bar-left">
            <span class="gb-bar-icon"><IconCash :size="13" :stroke-width="1.8" /></span>
            <span class="grid-bar-title">Rekap Penjualan, Prioritas &amp; Piutang</span>
            <span class="grid-bar-sep" />
            <div class="grid-search-wrap">
              <IconSearch :size="12" class="grid-search-icon" />
              <input v-model="cari1" type="text" placeholder="Cari rayon / salesman" class="grid-search-input" />
            </div>
          </div>
          <div class="grid-bar-right">
            <span class="page-info">Total: {{ grid1Search.length }}</span>
          </div>
        </div>
        <div ref="tblWrap1" class="table-wrap">
          <v-data-table :headers="head1" :items="grid1Items" dense hide-default-footer fixed-header class="comm-table freeze-2"
            item-value="kode" :items-per-page="-1">
            <template #headers>
              <tr class="band-row">
                <template v-for="g in bands1" :key="g.band">
                  <th v-if="g.span === 1" rowspan="2" class="band-cell band-cell-span2"
                    :class="g.cols[0].key === 'rayon' ? 'band-cell-frozen band-cell-frozen--1' : g.cols[0].key === 'salesman' ? 'band-cell-frozen band-cell-frozen--2' : ''">
                    <span class="th-title">{{ g.band }}</span>
                  </th>
                  <th v-else :colspan="g.span" class="band-cell">{{ g.band }}</th>
                </template>
              </tr>
              <tr>
                <template v-for="g in bands1" :key="g.band + '-sub'">
                  <template v-if="g.span > 1">
                    <th v-for="c in g.cols" :key="c.key" class="band-cell sub-cell"
                      :style="colStyle(c.key, c.title)">
                      <span class="th-title sortable" @click="toggleSort1(c)">
                        {{ c.title }}
                        <IconChevronUp v-if="sortIcon(c.key, 1) === 'asc'" :size="10" style="display: inline; vertical-align: middle" />
                        <IconChevronDown v-else-if="sortIcon(c.key, 1) === 'desc'" :size="10" style="display: inline; vertical-align: middle" />
                      </span>
                      <span class="col-resize-handle" @mousedown.stop="onResizeStart(c.key, $event)" />
                    </th>
                  </template>
                </template>
              </tr>
            </template>
            <template v-for="k in keys1" :key="'c1-' + k" #[`item.${k}`]="{ item }">
              <span class="cell-num">{{ fmtCell1(k, item) }}</span>
            </template>
            <template #no-data>
              <div class="empty-state">
                <IconDatabaseOff :size="36" :stroke-width="1.3" class="empty-icon" />
                <div class="empty-text">Belum ada data tersedia</div>
              </div>
            </template>
          </v-data-table>
        </div>
      </section>

      <!-- ═══ GRID 2: Rincian Komisi ═══ -->
      <section class="grid-block">
        <div class="grid-bar">
          <div class="grid-bar-left">
            <span class="gb-bar-icon"><IconCash :size="13" :stroke-width="1.8" /></span>
            <span class="grid-bar-title">Rincian Komisi Salesman</span>
            <span class="grid-bar-sep" />
            <div class="grid-search-wrap">
              <IconSearch :size="12" class="grid-search-icon" />
              <input v-model="cari2" type="text" placeholder="Cari salesman" class="grid-search-input" />
            </div>
          </div>
          <div class="grid-bar-right">
            <span class="page-info">Total: {{ grid2Search.length }}</span>
          </div>
        </div>
        <div ref="tblWrap2" class="table-wrap">
          <v-data-table :headers="head2" :items="grid2Items" dense hide-default-footer fixed-header class="comm-table freeze-1"
            item-value="no" :items-per-page="-1">
            <template #headers>
              <tr class="band-row">
                <template v-for="g in bands2" :key="g.band">
                  <th v-if="g.span === 1" rowspan="2" class="band-cell band-cell-span2"
                    :class="g.cols[0].key === 'salesman' ? 'band-cell-frozen band-cell-frozen--1' : ''">
                    <span class="th-title">{{ g.band }}</span>
                  </th>
                  <th v-else :colspan="g.span" class="band-cell">{{ g.band }}</th>
                </template>
              </tr>
              <tr>
                <template v-for="g in bands2" :key="g.band + '-sub'">
                  <template v-if="g.span > 1">
                    <th v-for="c in g.cols" :key="c.key" class="band-cell sub-cell"
                      :style="colStyle(c.key, c.title)">
                      <span class="th-title sortable" @click="toggleSort2(c)">
                        {{ c.title }}
                        <IconChevronUp v-if="sortIcon(c.key, 2) === 'asc'" :size="10" style="display: inline; vertical-align: middle" />
                        <IconChevronDown v-else-if="sortIcon(c.key, 2) === 'desc'" :size="10" style="display: inline; vertical-align: middle" />
                      </span>
                      <span class="col-resize-handle" @mousedown.stop="onResizeStart(c.key, $event)" />
                    </th>
                  </template>
                </template>
              </tr>
            </template>
            <template v-for="k in keys2" :key="'c2-' + k" #[`item.${k}`]="{ item }">
              <span class="cell-num">{{ fmtCell2(k, item) }}</span>
            </template>
            <template #no-data>
              <div class="empty-state">
                <IconDatabaseOff :size="36" :stroke-width="1.3" class="empty-icon" />
                <div class="empty-text">Belum ada data tersedia</div>
              </div>
            </template>
          </v-data-table>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<style scoped>
.comm-wrap { display: flex; flex-direction: column; height: 100%; gap: 6px; overflow: hidden; }
.grid-block {
  flex: 1 1 50%; min-height: 0; display: flex; flex-direction: column;
  border: 1px solid var(--ds-border, #A0AAB8); background: var(--ds-surface, #ffffff);
}

/* ── Grid bar (paritas BaseBrowse) ── */
.grid-bar {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 6px; padding: 4px 8px; flex-shrink: 0;
  background: var(--ds-surface-window, #E8ECF1);
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
}
.grid-bar-left, .grid-bar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
.gb-bar-icon { color: var(--ds-primary, #D97706); display: inline-flex; flex-shrink: 0; }
.grid-bar-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--ds-primary-darker, #78350F); white-space: nowrap;
}
.grid-bar-sep { width: 1px; height: 12px; background: var(--ds-border-light, #C4CAD3); flex-shrink: 0; }
.grid-search-wrap {
  display: flex; align-items: center; gap: 4px; background: #fff;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top-color: var(--ds-border-inset-edge, #7E8B9B); border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  height: 24px; padding: 0 6px;
}
.grid-search-icon { color: var(--ds-text-muted, #8494A7); flex-shrink: 0; }
.grid-search-input {
  width: 180px; height: 100%; background: transparent; border: none; outline: none;
  font-size: 11px; color: var(--ds-text, #78350F); font-family: var(--ds-font);
}
.grid-search-input::placeholder { color: var(--ds-text-muted, #8494A7); }
.page-info { font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); white-space: nowrap; }

/* ── Table (paritas BaseBrowse) ── */
.table-wrap { flex: 1; min-height: 0; overflow: auto; }
.comm-table { font-size: 12px; height: 100%; }
.comm-table :deep(.v-table__wrapper) { overflow: auto; flex: 1; min-height: 0; }

/* Banded header dua baris */
.comm-table :deep(.band-row th) { position: sticky; top: 0; z-index: 2; }
.comm-table :deep(.band-cell) {
  background: #D97706 !important; color: white !important;
  font-size: 10.5px !important; font-weight: 700 !important;
  text-transform: uppercase; letter-spacing: 0.04em;
  padding: 4px 6px; white-space: nowrap; text-align: left;
  border-right: 1px solid #B45309 !important; border-bottom: 1px solid #B45309 !important;
}
.comm-table :deep(.band-cell-span2) { vertical-align: middle; }
.comm-table :deep(.sub-cell) {
  border-top: 1px solid #B45309 !important; position: relative;
  background: #D97706 !important; color: white !important;
}
.comm-table :deep(.th-title) { display: inline-flex; align-items: center; gap: 2px; }
.comm-table :deep(.th-title.sortable) { cursor: pointer; }

/* Freeze kolom Rayon & Salesman — freeze-2 (grid1) & freeze-1 (grid2) */
.comm-table :deep(.band-cell-frozen) { position: sticky !important; z-index: 4 !important; min-width: 150px; }
.comm-table :deep(.band-cell-frozen--1) { left: 0 !important; }
.comm-table :deep(.band-cell-frozen--2) { left: var(--freeze-w1, 150px) !important; }

/* grid1: Rayon + Salesman beku */
.freeze-2 :deep(tbody td:nth-child(1)),
.freeze-2 :deep(tbody td:nth-child(2)) { position: sticky; z-index: 2; min-width: 150px; }
.freeze-2 :deep(tbody td:nth-child(1)) { left: 0; }
.freeze-2 :deep(tbody td:nth-child(2)) { left: var(--freeze-w1, 150px); }
.freeze-2 :deep(tbody tr:nth-child(odd) td:nth-child(-n+2)) { background: #F0F3F8; }
.freeze-2 :deep(tbody tr:nth-child(even) td:nth-child(-n+2)) { background: #E4EBF4; }
.freeze-2 :deep(tbody tr:hover td:nth-child(-n+2)) { background: #D8E2EF !important; }

/* grid2: hanya Salesman beku */
.freeze-1 :deep(tbody td:nth-child(1)) { position: sticky; left: 0; z-index: 2; min-width: 150px; }
.freeze-1 :deep(tbody tr:nth-child(odd) td:nth-child(1)) { background: #F0F3F8; }
.freeze-1 :deep(tbody tr:nth-child(even) td:nth-child(1)) { background: #E4EBF4; }
.freeze-1 :deep(tbody tr:hover td:nth-child(1)) { background: #D8E2EF !important; }

.comm-table :deep(tbody td) {
  font-size: 11px; font-weight: 600; color: #111827; height: 22px !important;
  padding: 0 6px !important; border-right: 1px solid var(--ds-border-light, #C4CAD3) !important;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3) !important;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
}
.comm-table :deep(tbody td:last-child) { border-right: none !important; }
.comm-table :deep(tbody tr:nth-child(odd)) { background-color: #F0F3F8; }
.comm-table :deep(tbody tr:nth-child(even)) { background-color: #E4EBF4; }
.comm-table :deep(tbody tr:hover) { background-color: #D8E2EF !important; }
.comm-table :deep(tbody tr) { height: 22px !important; max-height: 22px !important; }

/* Resize handle kolom */
.comm-table :deep(.col-resize-handle) {
  position: absolute; top: 0; right: 0; width: 5px; height: 100%;
  cursor: col-resize; z-index: 5;
}
.comm-table :deep(.sub-cell) { position: relative; }

.cell-num { font-variant-numeric: tabular-nums; }

/* ── Footer total (paritas BaseBrowse tfoot) ──
   Baris dibuat via JS (injectTfoot), jadi tanpa scope attribute — semua
   selektor tfoot harus lewat :deep(.comm-table) karena elemen tak ber-data-v. */
.comm-table :deep(.comm-tfoot) {
  background: var(--ds-surface-window, #E8ECF1); border-top: 2px solid var(--ds-border, #A0AAB8);
}
.comm-table :deep(.commit-tfoot-td) {
  font-size: 11.5px; font-weight: 800; color: var(--ds-primary-darker, #78350F);
  padding: 4px 6px !important; white-space: nowrap;
  position: sticky; bottom: 0; z-index: 3; background: var(--ds-surface-window, #E8ECF1);
}
.comm-table :deep(.commit-tfoot-td.tfoot-label) { font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; font-size: 11px; text-align: left; }
.comm-table :deep(.commit-tfoot-td.tfoot-val) { text-align: right; font-variant-numeric: tabular-nums; }

/* ── Filter periode ── */
.flt-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.flt-sel {
  height: 26px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  border-top-color: var(--ds-border-inset-edge, #7E8B9B); border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  padding: 0 8px; font-size: 12px; outline: none; background: white;
}
.flt-num {
  height: 26px; width: 74px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  border-top-color: var(--ds-border-inset-edge, #7E8B9B); border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  padding: 0 8px; font-size: 12px; outline: none;
}

/* ── Empty state ── */
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 32px 16px; gap: 6px; }
.empty-icon { color: rgba(var(--v-theme-on-surface), 0.25); margin-bottom: 4px; }
.empty-text { font-size: 13px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.55); }

@media (max-width: 1024px) {
  .grid-search-input { width: 130px; }
}
</style>

<style>
/* Baris TOTAL ikut freeze horizontal (paritas LapBulanan4). tfoot di-inject
   via JS tanpa data-v scope, jadi aturan harus global + :nth-child, bukan
   scoped :deep. Kolom beku: grid1 dua kolom pertama (Rayon, Salesman),
   grid2 kolom pertama (Salesman). Offset Salesman = --freeze-w1 yang sama
   dengan header & body supaya garis freeze lurus. */
.freeze-2 tfoot td.commit-tfoot-td:nth-child(-n+2),
.freeze-1 tfoot td.commit-tfoot-td:nth-child(1) {
  position: sticky;
  bottom: 0;
  z-index: 4;
  min-width: 150px;
  background: var(--ds-surface-window, #E8ECF1);
}
.freeze-2 tfoot td.commit-tfoot-td:nth-child(1) { left: 0; }
.freeze-2 tfoot td.commit-tfoot-td:nth-child(2) {
  left: var(--freeze-w1, 150px);
  border-left: 1px solid var(--ds-border, #A0AAB8);
}
.freeze-1 tfoot td.commit-tfoot-td:nth-child(1) { left: 0; }
</style>