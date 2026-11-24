<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { invoiceApi, type InvoiceRow, type InvoiceDetailRow } from "@/api/pembelian/invoiceApi";
import { IconFileInvoice, IconFileSpreadsheet } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_invoice";

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
} = useBrowse<InvoiceRow>({
  fetchApi: () => invoiceApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => invoiceApi.delete(nomor),
  getDetailApi: (nomor: string) => invoiceApi.getDetail(nomor),
  exportTitle: "Invoice Supplier",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Nobukti", title: "No Bukti", width: 15 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Jthtempo", title: "Jth Tempo", width: 12, align: "center" },
    { key: "Supplier", title: "Supplier", width: 25 },
    { key: "NoPajak", title: "No Pajak", width: 18 },
    { key: "Total", title: "Total", width: 16, numFmt: "#,##0" },
    { key: "Retur", title: "Retur", width: 14, numFmt: "#,##0" },
    { key: "Ppn", title: "PPN", width: 14, numFmt: "#,##0" },
    { key: "Dpp", title: "DPP", width: 14, numFmt: "#,##0" },
    { key: "Bayar", title: "Bayar", width: 14, numFmt: "#,##0" },
    { key: "StatusBayar", title: "Status Bayar", width: 12, align: "center" },
    { key: "Pajak", title: "Pajak", width: 10, align: "center" },
    { key: "Memo", title: "Memo", width: 20 },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Harga", title: "Harga", width: 14, numFmt: "#,##0" },
    { key: "Disc", title: "Disc%", width: 8, numFmt: "#,##0.00" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Nobukti", title: "No Bukti", width: "130px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Jthtempo", title: "Jth Tempo", width: "100px", align: "center" as const },
  { key: "Supplier", title: "Supplier", minWidth: "180px" },
  { key: "NoPajak", title: "No Pajak", width: "150px" },
  { key: "Total", title: "Total", width: "120px", align: "right" as const },
  { key: "Retur", title: "Retur", width: "100px", align: "right" as const },
  { key: "Ppn", title: "PPN", width: "100px", align: "right" as const },
  { key: "Dpp", title: "DPP", width: "100px", align: "right" as const },
  { key: "Bayar", title: "Bayar", width: "100px", align: "right" as const },
  { key: "StatusBayar", title: "Status Bayar", width: "90px", align: "center" as const },
  { key: "Pajak", title: "Pajak", width: "70px", align: "center" as const },
  { key: "Memo", title: "Memo", width: "150px" },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, InvoiceDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = { ...detailMap.value, [nomor]: await invoiceApi.getDetail(nomor) };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/pembelian/invoice/create");
const onEdit = (item: InvoiceRow) => router.push(`/pembelian/invoice/edit/${encodeURIComponent(item.Nomor)}`);

// Actions
const showNoPajakDialog = ref(false);
const noPajakInput = ref("");
const targetInvoice = ref<InvoiceRow | null>(null);

const inputNoPajak = (item?: InvoiceRow) => {
  const target = item || (isSingleSelected.value ? selected.value[0] : null);
  if (!target) {
    toast.warning("Pilih satu data Invoice terlebih dahulu.");
    return;
  }
  targetInvoice.value = target;
  noPajakInput.value = target.NoPajak || "";
  showNoPajakDialog.value = true;
};

const confirmSetNoPajak = async () => {
  if (!targetInvoice.value) return;
  try {
    await invoiceApi.setNoPajak(targetInvoice.value.Nomor, noPajakInput.value);
    toast.success("No Pajak berhasil disimpan.");
    showNoPajakDialog.value = false;
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan No Pajak.");
  }
};

const togglePajak = async (item?: InvoiceRow) => {
  const target = item || (isSingleSelected.value ? selected.value[0] : null);
  if (!target) {
    toast.warning("Pilih satu data Invoice terlebih dahulu.");
    return;
  }
  try {
    await invoiceApi.togglePajak(target.Nomor);
    toast.success("Status Pajak berhasil diubah.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status Pajak.");
  }
};

const showHistoryDialog = ref(false);
const historyLoading = ref(false);
const historyItems = ref<any[]>([]);

const historyPembayaran = async (item?: InvoiceRow) => {
  const target = item || (isSingleSelected.value ? selected.value[0] : null);
  if (!target) {
    toast.warning("Pilih satu data Invoice terlebih dahulu.");
    return;
  }
  showHistoryDialog.value = true;
  historyLoading.value = true;
  try {
    historyItems.value = await invoiceApi.getHistoryPembayaran(target.Nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat history pembayaran.");
  } finally {
    historyLoading.value = false;
  }
};

const onDelete = async (item: InvoiceRow) => {
  try {
    await invoiceApi.delete(item.Nomor);
    toast.success("Data berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  }
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return val;
  }
};

const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  return {};
};

const contextMenuItems = computed(() => [
  { label: "Input No Pajak", action: (it: InvoiceRow) => inputNoPajak(it) },
  { label: "Toggle PPN (Ya/Tidak)", action: (it: InvoiceRow) => togglePajak(it) },
  { label: "History Pembayaran", action: (it: InvoiceRow) => historyPembayaran(it) },
]);
</script>

<template>
  <BaseBrowse
    title="Invoice Supplier"
    :icon="IconFileInvoice"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    item-value="Nomor"
    v-model:selected="selected"
    :row-props-fn="rowPropsFn"
    :context-menu-items="contextMenuItems"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
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
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.Tanggal="{ value }">{{ fmtDate(value) }}</template>
    <template #item.Jthtempo="{ value }">{{ fmtDate(value) }}</template>
    <template #item.Total="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Retur="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Ppn="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Dpp="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Bayar="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>

    <template #item.StatusBayar="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">{{ value }}</span>
    </template>

    <template #item.Pajak="{ value }">
      <span :class="value === 'Ya' ? 'badge-eceran' : 'badge-open'">{{ value }}</span>
    </template>

    <template #summary-row="{ filteredItems }">
      <span class="summary-lbl">Total</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Total), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">PPN</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Ppn), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">Bayar</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Bayar), 0)) }}</span>
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmtQty(d.Jumlah) }}</td>
              <td class="tr">{{ fmt(d.Harga) }}</td>
              <td class="tr">{{ d.Disc }}%</td>
              <td class="tr bold accent">{{ fmt(d.Nilai) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="7" class="empty-td">Tidak ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('InvoiceSupplier')"
    @export-detail="exportDetailOnly('InvoiceSupplier')"
  />

  <!-- No Pajak Dialog -->
  <v-dialog v-model="showNoPajakDialog" max-width="380">
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7)">
        Input No Pajak
      </v-card-title>
      <v-card-text class="pa-3">
        <div class="f-row">
          <label class="f-lbl">No Pajak</label>
          <input v-model="noPajakInput" class="f-inp" />
        </div>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8)">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showNoPajakDialog = false">Batal</v-btn>
        <v-btn color="primary" variant="flat" size="small" @click="confirmSetNoPajak">Simpan</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- History Pembayaran -->
  <v-dialog v-model="showHistoryDialog" max-width="560" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7)">
        History Pembayaran
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="historyLoading" class="modal-loading">Memuat...</div>
        <table v-else class="modal-tbl">
          <thead>
            <tr>
              <th>Nomor Bayar</th>
              <th class="tc">Tanggal</th>
              <th class="tr">Bayar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in historyItems" :key="idx">
              <td class="mono">{{ row.Nomor }}</td>
              <td class="tc">{{ row.Tanggal }}</td>
              <td class="tr">{{ fmt(row.Bayar) }}</td>
            </tr>
            <tr v-if="historyItems.length === 0">
              <td colspan="3" class="empty-state">Belum ada pembayaran.</td>
            </tr>
          </tbody>
        </table>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8)">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showHistoryDialog = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }
.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }
.badge-open { background: #E8EDF5; color: var(--ds-primary, #0284c7); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.badge-closed { background: #E0E4EA; color: var(--ds-text-secondary, #5A6A7E); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.badge-eceran { background: #e1f5fe; color: #0369a1; padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th { background: var(--ds-primary, #0284c7); color: white; font-weight: 700; padding: 5px 8px; text-align: left; white-space: nowrap; }
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 11px; padding: 16px 12px; }
.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.f-inp { flex: 1; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; outline: none; box-sizing: border-box; background: white; }
</style>
