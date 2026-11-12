<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  historyHargaJualApi,
  type HistoryHargaJualRow,
  type HistoryHargaJualDetailRow,
} from "@/api/laporan/historyHargaJualApi";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const STORAGE_KEY = "laporan_historyHargaJual";
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

watch([bulan, tahun], () => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bulan: bulan.value, tahun: tahun.value })); } catch {}
  resetExpanded();
});

const filterValues = computed(() => ({ bulan: bulan.value, tahun: tahun.value }));

const items = ref<HistoryHargaJualRow[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await historyHargaJualApi.getBrowse({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Detail (expandable rows) ─────────────────────────────────────────
const expanded = ref<Record<string, HistoryHargaJualDetailRow[]>>({});
const expandedKeys = ref<any[]>([]);
const loadingDetails = ref<Set<string>>(new Set());

const resetExpanded = () => {
  expanded.value = {};
  expandedKeys.value = [];
  loadingDetails.value = new Set();
};

const handleExpanded = (val: any[]) => {
  const keys = val.map((r: any) => r?.Kode).filter(Boolean);
  keys.forEach((k) => {
    if (!(k in expanded.value)) loadDetail(k);
  });
  expandedKeys.value = val;
};

const loadDetail = async (kode: string) => {
  loadingDetails.value = new Set([...loadingDetails.value, kode]);
  try {
    const rows = await historyHargaJualApi.getDetail(kode, { bulan: bulan.value, tahun: tahun.value });
    expanded.value = { ...expanded.value, [kode]: rows };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat detail.");
  } finally {
    const s = new Set(loadingDetails.value);
    s.delete(kode);
    loadingDetails.value = s;
  }
};

// ── Headers Master ───────────────────────────────────────────────────
const headers = [
  { key: "Kode", title: "Kode", width: "90px" },
  { key: "Nama", title: "Nama", minWidth: "220px" },
  { key: "Satuan", title: "Satuan", width: "90px" },
  { key: "Kategori", title: "Kategori", width: "150px" },
  { key: "Merk", title: "Merk", minWidth: "130px" },
];

const detailHeaders = [
  { key: "Customer", title: "Customer", minWidth: "220px" },
  { key: "Harga", title: "Harga", width: "110px", align: "end" as const },
  { key: "Disc", title: "Disc", width: "80px", align: "end" as const },
  { key: "Kontrak", title: "Kontrak", width: "90px", align: "end" as const },
  { key: "HargaNet", title: "Harga Net", width: "120px", align: "end" as const },
  { key: "Salesman", title: "Salesman", minWidth: "130px" },
  { key: "Status", title: "Status", width: "100px" },
];

const fmtMoney = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtPct = (v: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Kode", title: "Kode", width: 12 },
  { key: "Nama", title: "Nama", width: 30 },
  { key: "Satuan", title: "Satuan", width: 10 },
  { key: "Kategori", title: "Kategori", width: 18 },
  { key: "Merk", title: "Merk", width: 15 },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    await exportStyledHeader({ title: "Browse History Harga Jual", subtitle: `Periode: ${palette[bulan.value - 1]} ${tahun.value}`, columns: exportColumns, items: items.value as unknown as Record<string, any>[], fileName: "HistoryHargaJual" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

const cellFmt = (d: HistoryHargaJualDetailRow, key: string, v: any) => {
  if (key === "Disc" || key === "Kontrak") return `${fmtPct(v)}%`;
  if (key === "Harga" || key === "HargaNet") return fmtMoney(v);
  return v ?? "-";
};
</script>

<template>
  <div class="grid-tab">
    <BaseBrowse
      title="Browse History Harga Jual"
      :icon="IconFileInvoice"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      show-expand
      :expanded="expandedKeys"
      :loading-details="loadingDetails"
      item-value="Kode"
      :filter-values="filterValues"
      :auto-refresh="false"
      @update:expanded="handleExpanded"
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

      <template #detail="{ item }">
        <div class="detail-wrap">
          <div class="detail-title">
            {{ item.Nama }} <span class="detail-kode">{{ item.Kode }}</span>
          </div>
          <div v-if="loadingDetails.has(item.Kode)" class="detail-loading">Memuat detail...</div>
          <table v-else class="detail-table">
            <thead>
              <tr>
                <th v-for="h in detailHeaders" :key="h.key" :style="{ textAlign: h.align || 'left' }">{{ h.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!(expanded[item.Kode] || []).length">
                <td :colspan="detailHeaders.length" class="detail-empty">Tidak ada harga jual untuk barang ini.</td>
              </tr>
              <tr v-for="(d, i) in expanded[item.Kode] || []" :key="i">
                <td>{{ d.Customer }}</td>
                <td style="text-align: right">{{ cellFmt(d, 'Harga', d.Harga) }}</td>
                <td style="text-align: right">{{ cellFmt(d, 'Disc', d.Disc) }}</td>
                <td style="text-align: right">{{ cellFmt(d, 'Kontrak', d.Kontrak) }}</td>
                <td style="text-align: right">{{ cellFmt(d, 'HargaNet', d.HargaNet) }}</td>
                <td>{{ d.Salesman }}</td>
                <td>{{ d.Status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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

.detail-wrap { padding: 8px 6px; }
.detail-title { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 6px; }
.detail-kode { font-weight: 400; color: #6b7280; margin-left: 8px; }
.detail-loading { font-size: 12px; color: #6b7280; padding: 4px 0; }
.detail-empty { padding: 8px; color: #6b7280; font-size: 12px; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th {
  text-align: left; background: var(--ds-tab-bg, #eef1f6); color: #374151;
  font-weight: 600; padding: 5px 8px; border-bottom: 1px solid var(--ds-border, #d0d5dd);
}
.detail-table td { padding: 5px 8px; border-bottom: 1px solid #eceff4; color: #1f2937; }
</style>