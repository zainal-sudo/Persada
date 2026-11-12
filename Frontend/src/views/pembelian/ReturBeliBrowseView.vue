<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { returBeliApi, type ReturBeliRow, type ReturBeliDetailRow } from "@/api/pembelian/returBeliApi";
import { IconReceiptRefund, IconFileSpreadsheet, IconPrinter, IconCopy } from "@tabler/icons-vue";
import { useRetBPrint } from "@/composables/useRetBPrint";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "pembelian_periode_retur_beli";

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
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const saved = getSaved();

const startDate = ref(saved?.startDate ?? getLocal(firstDay));
const endDate = ref(saved?.endDate ?? getLocal(now));

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  showExportDialog,
  isExporting,
  handleExport,
  exportHeaderOnly,
  exportDetailOnly,
  fetchData,
} = useBrowse<ReturBeliRow>({
  fetchApi: () => returBeliApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => returBeliApi.delete(nomor),
  getDetailApi: (nomor: string) => returBeliApi.getDetail(nomor),
  exportTitle: "Retur Beli",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Memo", title: "Memo", width: 22 },
    { key: "Supplier", title: "Supplier", width: 25 },
    { key: "Total", title: "Total", width: 16, numFmt: "#,##0" },
    { key: "Ppn", title: "PPN", width: 14, numFmt: "#,##0" },
    { key: "Invoice", title: "Nomor Invoice", width: 18 },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Harga", title: "Harga", width: 14, numFmt: "#,##0" },
    { key: "Disc", title: "Disc%", width: 8, numFmt: "#,##0.00" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "IDBatch", title: "ID Batch", width: 14 },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  PrinterDialog,
  PrintPreviewDialog,
} = useRetBPrint();

const doCetak = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data retur terlebih dahulu.");
    return;
  }
  await loadAndPreview(selectedItem.value!.Nomor);
};

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "160px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Memo", title: "Memo", width: "180px" },
  { key: "Supplier", title: "Supplier", minWidth: "180px" },
  { key: "Total", title: "Total", width: "120px", align: "right" as const },
  { key: "Ppn", title: "PPN", width: "100px", align: "right" as const },
  { key: "Invoice", title: "Nomor Invoice", width: "160px" },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, ReturBeliDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = { ...detailMap.value, [nomor]: await returBeliApi.getDetail(nomor) };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/pembelian/retur-beli/create");
const onEdit = (item: ReturBeliRow) => router.push(`/pembelian/retur-beli/edit/${encodeURIComponent(item.Nomor)}`);

// ── Duplikat (paritas Delphi TfrmBrowseReturBeli.cxButton9Click) ──────
// Salin dokumen retur yang dipilih menjadi dokumen baru (nomor baru).
const onDuplikat = async (item: ReturBeliRow) => {
  await router.push(`/pembelian/retur-beli/create?dup=${encodeURIComponent(item.Nomor)}`);
};

const onDelete = async (item: ReturBeliRow) => {
  try {
    await returBeliApi.delete(item.Nomor);
    toast.success("Data berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  }
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
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
  <BaseBrowse
    title="Retur Beli"
    :icon="IconReceiptRefund"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    item-value="Nomor"
    v-model:selected="selected"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
    :print-fn="() => doCetak()"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        class="tb-btn tb-btn-edit"
        :disabled="!isSingleSelected"
        @click="onDuplikat(selectedItem!)"
      >
        <template #prepend>
          <IconCopy :size="13" :stroke-width="1.8" />
        </template>
        Duplikat
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-edit"
        :loading="isPrinting"
        :disabled="!isSingleSelected"
        @click="doCetak"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F12]</span> Cetak
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.Tanggal="{ value }">{{ fmtDate(value) }}</template>
    <template #item.Total="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Ppn="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>

    <template #summary-row="{ filteredItems }">
      <span class="summary-lbl">Total</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Total), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">PPN</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Ppn), 0)) }}</span>
    </template>

    <template #detail="{ item }">
      <div class="detail-wrap">
        <div v-if="expandedLoading[item.Nomor]" class="detail-loading">
          <v-progress-circular indeterminate color="primary" size="18" />
          <span>Memuat rincian...</span>
        </div>
        <table v-else class="detail-tbl">
          <thead>
            <tr>
              <th style="width: 80px">Kode</th>
              <th style="min-width: 200px">Nama Barang</th>
              <th style="width: 70px" class="tc">Satuan</th>
              <th style="width: 80px" class="tr">Jumlah</th>
              <th style="width: 110px" class="tr">Harga</th>
              <th style="width: 60px" class="tr">Disc%</th>
              <th style="width: 110px" class="tr">Nilai</th>
              <th style="width: 110px" class="tc">ID Batch</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmt(d.Jumlah) }}</td>
              <td class="tr">{{ fmt(d.Harga) }}</td>
              <td class="tr">{{ d.Disc }}%</td>
              <td class="tr bold accent">{{ fmt(d.Nilai) }}</td>
              <td class="tc">{{ d.IDBatch || "-" }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="8" class="empty-td">Tidak ada detail.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <!-- Export Dialog -->
  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('ReturBeli')"
    @export-detail="exportDetailOnly('ReturBeli')"
  />

  <!-- Printer Dialog -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />

  <!-- Print Preview Dialog -->
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    title="Preview Retur Beli"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }

.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #D97706); }
.num-cell { font-variant-numeric: tabular-nums; }

.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #D97706); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>
