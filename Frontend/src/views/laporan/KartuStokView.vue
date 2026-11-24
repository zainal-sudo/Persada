<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { kartuStokApi, type KartuStokRow, type KartuStokDetailRow } from "@/api/laporan/kartuStokApi";
import { gudangApi, type GudangRow } from "@/api/persediaan/gudangApi";
import { useAuthStore } from "@/stores/authStore";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();
const authStore = useAuthStore();

// Delphi: master kolom Hbeli (idx 3) & detail kolom Hargabeli (idx 8) hanya untuk user FINANCE
const isFinance = computed(() => authStore.userKode.toUpperCase() === "FINANCE");

// ── Filter (Periode + Gudang) ────────────────────────────────────────
const STORAGE_KEY = "laporan_filter_kartuStok";

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
const today = getLocal(now);
const saved = getSaved();

// Delphi default start = awal periode, end = hari ini
const filterState = ref({
  startDate: saved?.startDate ?? getLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
  endDate: saved?.endDate ?? today,
  gudang: saved?.gudang ?? "",
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

// ── Data Master ──────────────────────────────────────────────────────
const items = ref<KartuStokRow[]>([]);
const isLoading = ref(false);
const gudangs = ref<GudangRow[]>([]);

const loadGudang = async () => {
  try {
    gudangs.value = await gudangApi.getBrowse();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data gudang.");
  }
};

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await kartuStokApi.getBrowse(filterState.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Detail (expandable rows) ─────────────────────────────────────────
// `return-object` -> `expanded` berisi objek row; detail disimpan per Kode
const expanded = ref<Record<string, KartuStokDetailRow[]>>({});
const expandedKeys = ref<any[]>([]);
const loadingDetails = ref<Set<string>>(new Set());

const handleExpanded = (val: any[]) => {
  const keys = val.map((r: any) => r?.Kode).filter(Boolean);

  keys.forEach((k) => {
    if (!(k in expanded.value)) {
      loadDetail(k);
    }
  });

  expandedKeys.value = val;
};

const loadDetail = async (kode: string) => {
  loadingDetails.value = new Set([...loadingDetails.value, kode]);
  try {
    expanded.value = { ...expanded.value, [kode]: await kartuStokApi.getDetail(kode, filterState.value) };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat detail sejarah.");
  } finally {
    const s = new Set(loadingDetails.value);
    s.delete(kode);
    loadingDetails.value = s;
  }
};

onMounted(() => {
  loadGudang();
});

// ── Headers Master (mengikuti Delphi) ────────────────────────────────
const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "Kode", title: "Kode", width: "90px" },
  { key: "Nama", title: "Nama", minWidth: "180px" },
  { key: "Kategori", title: "Kategori", minWidth: "120px" },
  { key: "Hbeli", title: "Harga Beli", width: "120px", align: "end" },
  { key: "_Awal", title: "Awal", width: "100px", align: "end" },
  { key: "_In", title: "Masuk", width: "100px", align: "end" },
  { key: "_Out", title: "Keluar", width: "100px", align: "end" },
  { key: "_Akhir", title: "Akhir", width: "100px", align: "end" },
];

// ── Headers Detail ───────────────────────────────────────────────────
const detailHeaders = [
  { key: "Tanggal", title: "Tanggal", align: "center" as const },
  { key: "Nomor", title: "Nomor", minWidth: "120px" },
  { key: "Keterangan", title: "Keterangan", minWidth: "140px" },
  { key: "Gudang", title: "Gudang", minWidth: "100px" },
  { key: "_IN", title: "Masuk", align: "end" as const, width: "100px" },
  { key: "_OUT", title: "Keluar", align: "end" as const, width: "100px" },
  { key: "Expired", title: "Expired", align: "center" as const, width: "110px" },
  { key: "Hargabeli", title: "Harga Beli", align: "end" as const, width: "120px" },
  { key: "Customer", title: "Customer", minWidth: "140px" },
  { key: "no_Faktur", title: "No. Faktur", minWidth: "100px" },
];

// Header detail yang dirender — Harga Beli hanya untuk user FINANCE,
// harus sinkron dengan <td> di body agar kolom tidak bergeser.
const visibleDetailHeaders = computed(() =>
  detailHeaders.filter((h) => h.key !== "Hargabeli" || isFinance.value)
);

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
const fmtQty = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v || 0);
// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Kode", title: "Kode", width: 12 },
  { key: "Nama", title: "Nama", width: 25 },
  { key: "Kategori", title: "Kategori", width: 15 },
  { key: "Hbeli", title: "Harga Beli", width: 14, numFmt: "#,##0" },
  { key: "_Awal", title: "Awal", width: 12, numFmt: "#,##0.00" },
  { key: "_In", title: "Masuk", width: 12, numFmt: "#,##0.00" },
  { key: "_Out", title: "Keluar", width: 12, numFmt: "#,##0.00" },
  { key: "_Akhir", title: "Akhir", width: 12, numFmt: "#,##0.00" },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    await exportStyledHeader({ title: "Kartu Stok", subtitle: `Periode: ${filterState.value.startDate} s/d ${filterState.value.endDate}`, columns: exportColumns, items: items.value as unknown as Record<string, any>[], fileName: "KartuStok" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

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
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Kartu Stok"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      item-value="Kode"
      :filter-values="filterValues"
      :auto-refresh="false"
      show-expand
      :expanded="expandedKeys"
      :loading-details="loadingDetails"
      @refresh="loadData"
      @update:expanded="handleExpanded"
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
          <DsDatePicker v-model="filterState.startDate" variant="toolbar" />
          <span class="filter-sep">s/d</span>
          <DsDatePicker v-model="filterState.endDate" variant="toolbar" />
          <span class="filter-sep" style="margin-left: 10px" />
          <span class="filter-lbl">Gudang</span>
          <select v-model="filterState.gudang" class="gdg-inp">
            <option value="">(Semua)</option>
            <option v-for="g in gudangs" :key="g.Kode" :value="g.Kode">{{ g.Nama }}</option>
          </select>
        </div>
      </template>

      <template v-if="isFinance" #item.Hbeli="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item._Awal="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item._In="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item._Out="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>
      <template #item._Akhir="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
      </template>

      <template #detail="{ item }">
        <div class="detail-wrap">
          <div class="detail-title">{{ item.Nama }} <span class="detail-kode">{{ item.Kode }}</span></div>
          <div v-if="loadingDetails.has(item.Kode)" class="detail-loading">Memuat detail...</div>
          <table v-else class="detail-table">
            <thead>
              <tr>
                <th
                  v-for="h in visibleDetailHeaders"
                  :key="h.key"
                  :style="{ textAlign: h.align || 'left', width: h.width, minWidth: h.minWidth }"
                >{{ h.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!(expanded[item.Kode] || []).length">
                <td :colspan="visibleDetailHeaders.length" class="detail-empty">Tidak ada transaksi pada periode ini.</td>
              </tr>
              <tr v-for="(d, i) in expanded[item.Kode] || []" :key="i">
                <td style="text-align: center">{{ fmtDate(d.Tanggal) }}</td>
                <td>{{ d.Nomor }}</td>
                <td>{{ d.Keterangan }}</td>
                <td>{{ d.Gudang }}</td>
                <td style="text-align: right">{{ fmtQty(d._IN) }}</td>
                <td style="text-align: right">{{ fmtQty(d._OUT) }}</td>
                <td style="text-align: center">{{ fmtDate(d.Expired) }}</td>
                <td v-if="isFinance" style="text-align: right">{{ fmt(d.Hargabeli) }}</td>
                <td>{{ d.Customer }}</td>
                <td>{{ d.no_Faktur }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseBrowse>
  </div>
</template>

<style scoped>
.grid-tab {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; }
.date-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 128px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.gdg-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 170px;
  background: white; color: #374151;
}
.gdg-inp:focus { border-color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }
.detail-wrap { padding: 8px 6px; }
.detail-title { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 6px; }
.detail-kode { font-weight: 400; color: #6b7280; margin-left: 8px; }
.detail-loading { color: #6b7280; font-size: 12px; padding: 8px 0; }
.detail-empty { text-align: center; color: #9ca3af; font-size: 12px; padding: 10px 0; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th {
  background: var(--ds-tab-bg, #eef1f6); color: #374151; font-weight: 600;
  padding: 5px 8px; border-bottom: 1px solid var(--ds-border, #d0d5dd);
  white-space: nowrap; text-align: left;
}
.detail-table td { padding: 4px 8px; border-bottom: 1px solid #eef0f4; white-space: nowrap; }
.detail-table tr:hover td { background: #f7f9fc; }
</style>