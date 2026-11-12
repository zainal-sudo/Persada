<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { bayarCustomerApi, type BayarCustomerRow, type BayarCustomerDetailRow } from "@/api/penjualan/bayarCustomerApi";
import { IconCash, IconFileSpreadsheet, IconPrinter } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_bayar_customer";

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
} = useBrowse<BayarCustomerRow>({
  fetchApi: () => bayarCustomerApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => bayarCustomerApi.delete(nomor),
  getDetailApi: (nomor: string) => bayarCustomerApi.getDetail(nomor),
  exportTitle: "Bayar Customer",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Status", title: "Status", width: 10, align: "center" },
    { key: "Kode_Cust", title: "Kode Cust", width: 10 },
    { key: "Customer", title: "Customer", width: 25 },
    { key: "Salesman", title: "Salesman", width: 15 },
    { key: "Cash", title: "Cash", width: 14, numFmt: "#,##0" },
    { key: "Transfer", title: "Transfer", width: 14, numFmt: "#,##0" },
    { key: "Potongan", title: "Potongan", width: 14, numFmt: "#,##0" },
    { key: "Giro", title: "Giro", width: 14, numFmt: "#,##0" },
    { key: "GiroNumber", title: "Giro Number", width: 15 },
    { key: "TglCair", title: "Tgl Cair", width: 12, align: "center" },
    { key: "Rekening_Cash", title: "Rek Cash", width: 15 },
    { key: "Rekening_Transfer", title: "Rek Transfer", width: 15 },
    { key: "PPN", title: "PPN", width: 12, numFmt: "#,##0" },
    { key: "PPH", title: "PPH", width: 12, numFmt: "#,##0" },
    { key: "NTPN", title: "NTPN", width: 15 },
    { key: "Dtp", title: "DTP", width: 8, align: "center" },
    { key: "date_create", title: "Created", width: 18, align: "center" },
  ],
  detailColumns: [
    { key: "Invoice", title: "Invoice", width: 20 },
    { key: "Tgl_Invoice", title: "Tgl Invoice", width: 12, align: "center" },
    { key: "JthTempo", title: "Jth Tempo", width: 12, align: "center" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Bayar", title: "Bayar", width: 16, numFmt: "#,##0" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Status", title: "Status", width: "80px", align: "center" as const },
  { key: "Kode_Cust", title: "Kode Cust", width: "80px" },
  { key: "Customer", title: "Customer", minWidth: "180px" },
  { key: "Salesman", title: "Salesman", width: "130px" },
  { key: "Cash", title: "Cash", width: "110px", align: "right" as const },
  { key: "Transfer", title: "Transfer", width: "110px", align: "right" as const },
  { key: "Potongan", title: "Potongan", width: "100px", align: "right" as const },
  { key: "Giro", title: "Giro", width: "100px", align: "right" as const },
  { key: "GiroNumber", title: "Giro Number", width: "120px" },
  { key: "TglCair", title: "Tgl Cair", width: "100px", align: "center" as const },
  { key: "Rekening_Cash", title: "Rek Cash", width: "120px" },
  { key: "Rekening_Transfer", title: "Rek Transfer", width: "120px" },
  { key: "PPN", title: "PPN", width: "90px", align: "right" as const },
  { key: "PPH", title: "PPH", width: "90px", align: "right" as const },
  { key: "NTPN", title: "NTPN", width: "120px" },
  { key: "Dtp", title: "DTP", width: "60px", align: "center" as const },
  { key: "date_create", title: "Created", width: "140px", align: "center" as const },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, BayarCustomerDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = { ...detailMap.value, [nomor]: await bayarCustomerApi.getDetail(nomor) };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/penjualan/bayar-customer/create");
const onEdit = (item: BayarCustomerRow) => router.push(`/penjualan/bayar-customer/edit/${encodeURIComponent(item.Nomor)}`);

// ── Cetak Penerimaan Customer (browser print, paritas doslip BYC) ──
const doCetak = () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data Bayar Customer terlebih dahulu.");
    return;
  }
  const item = selected.value[0];
  router.push(`/penjualan/bayar-customer/print/${encodeURIComponent(item.Nomor)}`);
};

const onDelete = async (item: BayarCustomerRow) => {
  try {
    await bayarCustomerApi.delete(item.Nomor);
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

const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  return {};
};
</script>

<template>
  <BaseBrowse
    title="Bayar Customer"
    :icon="IconCash"
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
    <template #item.TglCair="{ value }">{{ fmtDate(value) }}</template>
    <template #item.Cash="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Transfer="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Potongan="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Giro="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.PPN="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.PPH="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>

    <template #item.Status="{ value }">
      <span :class="value === 'PPN' ? 'badge-open' : 'badge-closed'">{{ value }}</span>
    </template>

    <template #summary-row="{ filteredItems }">
      <span class="summary-lbl">Cash</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Cash), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">Transfer</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Transfer), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">Potongan</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Potongan), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">Giro</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Giro), 0)) }}</span>
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
              <th style="width: 170px">Invoice</th>
              <th style="width: 100px" class="tc">Tgl Invoice</th>
              <th style="width: 100px" class="tc">Jth Tempo</th>
              <th style="width: 120px" class="tr">Nilai</th>
              <th style="width: 120px" class="tr">Bayar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Invoice }}</td>
              <td class="tc">{{ fmtDate(d.Tgl_Invoice) }}</td>
              <td class="tc">{{ fmtDate(d.JthTempo) }}</td>
              <td class="tr">{{ fmt(d.Nilai) }}</td>
              <td class="tr bold accent">{{ fmt(d.Bayar) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="5" class="empty-td">Tidak ada detail.</td>
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
    @export-header="exportHeaderOnly('BayarCustomer')"
    @export-detail="exportDetailOnly('BayarCustomer')"
  />
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }
.date-inp { height: 32px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 8px; font-size: 12px; outline: none; width: 130px; }
.date-inp:focus { border-color: var(--ds-primary, #D97706); }

.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #D97706); }
.num-cell { font-variant-numeric: tabular-nums; }

.badge-open { background: #E8EDF5; color: var(--ds-primary, #D97706); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.badge-closed { background: #E0E4EA; color: var(--ds-text-secondary, #5A6A7E); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }

.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #D97706); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>