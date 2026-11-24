<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { stokExpiredApi, type StokExpiredRow } from "@/api/laporan/stokExpiredApi";
import { gudangApi, type GudangRow } from "@/api/persediaan/gudangApi";
import { useAuthStore } from "@/stores/authStore";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();
const authStore = useAuthStore();

// Delphi: kolom HargaBeli hanya untuk user FINANCE
const isFinance = computed(() => authStore.userKode.toUpperCase() === "FINANCE");

// ── Filter (Tanggal Expired + Gudang) ────────────────────────────────
const STORAGE_KEY = "laporan_filter_stokExpired";

const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.startDate) return s;
  } catch {}
  return null;
};

const now = new Date();
const today = getLocal(now);
const saved = getSaved();

// Delphi btnRefresh memakai startdate sebagai batas tanggal expired; default hari ini
const filterState = ref({
  startDate: saved?.startDate ?? today,
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

// ── Data ──────────────────────────────────────────────────────────────
const items = ref<StokExpiredRow[]>([]);
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
    items.value = await stokExpiredApi.getBrowse(filterState.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadGudang();
});

// ── Headers (mengikuti Delphi btnRefreshClick) ───────────────────────
const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", minWidth: "220px" },
  { key: "Expired", title: "Tanggal Expired", width: "130px", align: "center" },
  { key: "HargaBeli", title: "Harga Beli", width: "120px", align: "end" },
  { key: "Stok", title: "Stok", width: "100px", align: "end" },
];

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
const fmtQty = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v || 0);
// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Kode", title: "Kode", width: 12 },
  { key: "Nama", title: "Nama", width: 25 },
  { key: "Satuan", title: "Satuan", width: 10, align: "center" },
  { key: "IdBatch", title: "ID Batch", width: 14 },
  { key: "Expired", title: "Expired", width: 14, align: "center" },
  { key: "Gudang", title: "Gudang", width: 14 },
  { key: "Stok", title: "Stok", width: 10, numFmt: "#,##0.00" },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r) => ({ ...r, Expired: fmtDate(r.Expired) }));
    await exportStyledHeader({ title: "Stok Expired", subtitle: `S/d: ${filterState.value.startDate}`, columns: exportColumns, items: exportItems as unknown as Record<string, any>[], fileName: "StokExpired" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

const fmtDate = (val: string) => {
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
      title="Stok Expired"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      :fixed-layout="false"
      item-value="Kode"
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
          <span class="filter-lbl">Tanggal Expired</span>
          <DsDatePicker v-model="filterState.startDate" variant="toolbar" />
          <span class="filter-sep" style="margin-left: 10px" />
          <span class="filter-lbl">Gudang</span>
          <select v-model="filterState.gudang" class="gdg-inp">
            <option value="">(Semua)</option>
            <option v-for="g in gudangs" :key="g.Kode" :value="g.Kode">{{ g.Nama }}</option>
          </select>
        </div>
      </template>

      <template #item.Expired="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template v-if="isFinance" #item.HargaBeli="{ value }">
        <span class="num-cell">{{ fmt(value) }}</span>
      </template>
      <template #item.Stok="{ value }">
        <span class="num-cell">{{ fmtQty(value) }}</span>
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
</style>