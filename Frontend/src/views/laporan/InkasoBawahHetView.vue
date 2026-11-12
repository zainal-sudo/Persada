<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  inkasoBawahHetApi,
  type InkasoBawahHetRow,
  type InkasoBawahHetDetailRow,
} from "@/api/laporan/inkasoBawahHetApi";
import { IconCashOff, IconFileSpreadsheet } from "@tabler/icons-vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";

const toast = useToast();

const STORAGE_KEY = "laporan_inkasoBawahHet";
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
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

const items = ref<InkasoBawahHetRow[]>([]);
const isLoading = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    items.value = await inkasoBawahHetApi.getBrowse({ bulan: bulan.value, tahun: tahun.value });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

// ── Detail (expandable per Noreferensi) ─────────────────────────────
const expanded = ref<Record<string, InkasoBawahHetDetailRow[]>>({});
const expandedKeys = ref<any[]>([]);
const loadingDetails = ref<Set<string>>(new Set());

const resetExpanded = () => {
  expanded.value = {};
  expandedKeys.value = [];
  loadingDetails.value = new Set();
};

const handleExpanded = (val: any[]) => {
  const keys = val.map((r: any) => r?.Noreferensi).filter(Boolean);
  keys.forEach((k) => {
    if (!(k in expanded.value)) loadDetail(k);
  });
  expandedKeys.value = val;
};

const loadDetail = async (noreferensi: string) => {
  loadingDetails.value = new Set([...loadingDetails.value, noreferensi]);
  try {
    const rows = await inkasoBawahHetApi.getDetail(noreferensi);
    expanded.value = { ...expanded.value, [noreferensi]: rows };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat detail.");
  } finally {
    const s = new Set(loadingDetails.value);
    s.delete(noreferensi);
    loadingDetails.value = s;
  }
};

// ── Headers (urutan kolom Delphi) ───────────────────────────────────
const headers: {
  key: string; title: string; width?: string; minWidth?: string; align?: "start" | "end" | "center";
}[] = [
  { key: "Noreferensi", title: "No Referensi", width: "120px" },
  { key: "Salesman", title: "Salesman", minWidth: "120px" },
  { key: "Bayar", title: "Bayar", width: "130px", align: "end" },
  { key: "Tgl_Bayar", title: "Tgl Bayar", width: "100px", align: "center" },
  { key: "Tanggal_Faktur", title: "Tgl Faktur", width: "100px", align: "center" },
  { key: "SelisihHari", title: "Selisih Hari", width: "110px", align: "end" },
  { key: "pengurang", title: "Pengurang", width: "130px", align: "end" },
  { key: "Customer", title: "Customer", minWidth: "200px" },
];

const detailHeaders = [
  { key: "brg_nama", title: "Nama Barang", minWidth: "220px" },
  { key: "qty", title: "Qty", width: "80px", align: "end" as const },
  { key: "Net", title: "Net", width: "120px", align: "end" as const },
  { key: "HET", title: "HET", width: "120px", align: "end" as const },
];

const summaryColumns = computed(() => [{ key: "Bayar" }, { key: "pengurang" }]);

// ── Export
const isExporting = ref(false);
const exportColumns: ExportColumn[] = [
  { key: "Noreferensi", title: "No Referensi", width: 16 },
  { key: "Salesman", title: "Salesman", width: 15 },
  { key: "Bayar", title: "Bayar", width: 14, numFmt: "#,##0" },
  { key: "Tgl_Bayar", title: "Tgl Bayar", width: 14, align: "center" },
  { key: "Tanggal_Faktur", title: "Tgl Faktur", width: 14, align: "center" },
  { key: "SelisihHari", title: "Selisih Hari", width: 12, numFmt: "#,##0" },
  { key: "pengurang", title: "Pengurang", width: 14, numFmt: "#,##0" },
  { key: "Customer", title: "Customer", width: 22 },
];
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r) => ({ ...r, Tgl_Bayar: fmtDate(r.Tgl_Bayar), Tanggal_Faktur: fmtDate(r.Tanggal_Faktur) }));
    await exportStyledHeader({ title: "Inkaso Bawah HET", columns: exportColumns, items: exportItems as unknown as Record<string, any>[], fileName: "InkasoBawahHet" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

const fmtMoney = (v: any) => new Intl.NumberFormat("id-ID").format(Number(v) || 0);

const fmtDate = (val: string | null | undefined) => {
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
      title="Laporan Inkaso Bawah HET"
      :icon="IconCashOff"
      :headers="headers"
      :items="items"
      :is-loading="isLoading"
      show-expand
      :expanded="expandedKeys"
      :loading-details="loadingDetails"
      item-value="Noreferensi"
      :filter-values="filterValues"
      :auto-refresh="false"
      :summary-columns="summaryColumns"
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
            <option v-for="(m, i) in MONTHS" :key="i" :value="i + 1">{{ m }}</option>
          </select>
          <span class="filter-lbl">Tahun</span>
          <select v-model="tahun" class="sel-inp">
            <option v-for="t in [now.getFullYear() - 1, now.getFullYear()]" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </template>

      <template #item.Tgl_Bayar="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template #item.Tanggal_Faktur="{ value }">
        <span>{{ fmtDate(value) }}</span>
      </template>
      <template #item.Bayar="{ value }">
        <span class="num-cell">{{ fmtMoney(value) }}</span>
      </template>
      <template #item.pengurang="{ value }">
        <span class="num-cell">{{ fmtMoney(value) }}</span>
      </template>
      <template #item.SelisihHari="{ value }">
        <span class="num-cell">{{ value ?? "-" }}</span>
      </template>

      <template #detail="{ item }">
        <div class="detail-wrap">
          <div class="detail-title">
            {{ item.Noreferensi }}
            <span class="detail-kode">{{ item.Customer }}</span>
          </div>
          <div v-if="loadingDetails.has(item.Noreferensi)" class="detail-loading">Memuat detail...</div>
          <table v-else class="detail-table">
            <thead>
              <tr>
                <th v-for="h in detailHeaders" :key="h.key" :style="{ textAlign: h.align || 'left' }">{{ h.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!(expanded[item.Noreferensi] || []).length">
                <td :colspan="detailHeaders.length" class="detail-empty">Tidak ada barang di bawah HET untuk faktur ini.</td>
              </tr>
              <tr v-for="(d, i) in expanded[item.Noreferensi] || []" :key="i">
                <td>{{ d.brg_nama }}</td>
                <td style="text-align: right">{{ fmtMoney(d.qty) }}</td>
                <td style="text-align: right">{{ fmtMoney(d.Net) }}</td>
                <td style="text-align: right">{{ fmtMoney(d.HET) }}</td>
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
.sel-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: white; color: #374151;
}
.sel-inp:focus { border-color: var(--ds-primary, #D97706); }
.num-cell { font-variant-numeric: tabular-nums; }

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
