<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import CetakPickerDialog from "@/components/CetakPickerDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { useEscClose } from "@/composables/useEscClose";
import { fpApi, type FPRow, type FPDetailRow, type HistoryBayarRow, type EditJtData, type EditJtDetail } from "@/api/penjualan/fpApi";
import { IconFileInvoice, IconFileSpreadsheet, IconPrinter } from "@tabler/icons-vue";
import { useAuthStore } from "@/stores/authStore";

import { useFpPrint } from "@/composables/useFpPrint";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  showRecetakDialog,
  recetakNomor,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  confirmRecetak,
  cancelRecetak,
  PrinterDialog,
  PrintPreviewDialog,
} = useFpPrint();

const STORAGE_KEY = "finance_periode_fp";

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
} = useBrowse<FPRow>({
  fetchApi: () => fpApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => fpApi.delete(nomor),
  getDetailApi: (nomor: string) => fpApi.getDetail(nomor),
  exportTitle: "Faktur Penjualan (FP)",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "SO_Nomor", title: "SO Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "JthTempo", title: "Jth Tempo", width: 12, align: "center" },
    { key: "Memo", title: "Memo", width: 20 },
    { key: "Tax", title: "Tax", width: 8, align: "center" },
    { key: "Salesman", title: "Salesman", width: 15 },
    { key: "Kode_Cust", title: "Kode Cust", width: 10 },
    { key: "Customer", title: "Customer", width: 25 },
    { key: "Total", title: "Total", width: 16, numFmt: "#,##0" },
    { key: "Ppn", title: "PPN", width: 14, numFmt: "#,##0" },
    { key: "Retur", title: "Retur", width: 14, numFmt: "#,##0" },
    { key: "Disc_Faktur", title: "Disc Faktur", width: 14, numFmt: "#,##0" },
    { key: "Biaya_Promosi", title: "Biaya Promosi", width: 14, numFmt: "#,##0" },
    { key: "Kontrak", title: "Kontrak", width: 12, numFmt: "#,##0" },
    { key: "Freight", title: "Freight", width: 12, numFmt: "#,##0" },
    { key: "Bayar", title: "Bayar", width: 14, numFmt: "#,##0" },
    { key: "Status_Bayar", title: "Status Bayar", width: 12, align: "center" },
    { key: "Kembali", title: "Kembali", width: 10, align: "center" },
    { key: "Keterangan", title: "Ket", width: 10, align: "center" },
    { key: "Status_Faktur", title: "Status Faktur", width: 12, align: "center" },
    { key: "Status_Cetak", title: "Cetak", width: 8, align: "center" },
    { key: "Tipe", title: "Tipe", width: 10, align: "center" },
    { key: "DTP", title: "DTP", width: 8, align: "center" },
    { key: "IsCatalog", title: "Catalog", width: 10, align: "center" },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Harga", title: "Harga", width: 14, numFmt: "#,##0" },
    { key: "Disc", title: "Disc%", width: 8, numFmt: "#,##0.00" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Kontrak", title: "Kontrak", width: 10 },
    { key: "ED", title: "ED", width: 12, align: "center" },
    { key: "Batch", title: "ID Batch", width: 16 },
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
  { key: "Nomor", title: "Nomor", width: "150px" },
  { key: "SO_Nomor", title: "SO Nomor", width: "150px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "JthTempo", title: "Jth Tempo", width: "100px", align: "center" as const },
  { key: "Memo", title: "Memo", width: "150px" },
  { key: "Tax", title: "Tax", width: "70px", align: "center" as const },
  { key: "Salesman", title: "Salesman", width: "130px" },
  { key: "Kode_Cust", title: "Kode Cust", width: "80px" },
  { key: "Customer", title: "Customer", minWidth: "150px" },
  { key: "Total", title: "Total", width: "120px", align: "right" as const },
  { key: "Ppn", title: "PPN", width: "110px", align: "right" as const },
  { key: "Retur", title: "Retur", width: "100px", align: "right" as const },
  { key: "Disc_Faktur", title: "Disc Faktur", width: "110px", align: "right" as const },
  { key: "Biaya_Promosi", title: "Biaya Promosi", width: "110px", align: "right" as const },
  { key: "Kontrak", title: "Kontrak", width: "80px", align: "right" as const },
  { key: "Freight", title: "Freight", width: "80px", align: "right" as const },
  { key: "Bayar", title: "Bayar", width: "100px", align: "right" as const },
  { key: "Status_Bayar", title: "Status Bayar", width: "90px", align: "center" as const },
  { key: "Kembali", title: "Kembali", width: "70px", align: "center" as const },
  { key: "Keterangan", title: "Ket", width: "70px", align: "center" as const },
  { key: "Status_Faktur", title: "Status Faktur", width: "100px", align: "center" as const },
  { key: "Status_Cetak", title: "Cetak", width: "70px", align: "center" as const },
  { key: "Tipe", title: "Tipe", width: "80px", align: "center" as const },
  { key: "DTP", title: "DTP", width: "60px", align: "center" as const },
  { key: "IsCatalog", title: "Catalog", width: "70px", align: "center" as const },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, FPDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = { ...detailMap.value, [nomor]: await fpApi.getDetail(nomor) };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/penjualan/fp/create");
const onEdit = (item: FPRow) => router.push(`/penjualan/fp/edit/${encodeURIComponent(item.Nomor)}`);

const onDelete = async (item: FPRow) => {
  try {
    await fpApi.delete(item.Nomor);
    toast.success("FP berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus FP.");
  }
};

// ── Cetak (Dot Matrix Faktur Penjualan) — via useFpPrint shared composable ──
const showCetakDialog = ref(false);
const doCetak = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  await loadAndPreview(item.Nomor);
};

// ── Cetak V RET (paritas doslip4: faktur dikoreksi retur) ───────────
const doCetakRetur = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  await loadAndPreview(item.Nomor, "retur");
};

const onPilihCetak = (type: string) => {
  if (type === "retur") doCetakRetur();
  else doCetak();
};

// ── Toggle Kembali (paritas UpdateStatusKembali) ────────────────────
const isTogglingKembali = ref(false);
const showKembaliDialog = ref(false);
const kembaliTarget = ref<FPRow | null>(null);
const kembaliActionLabel = computed(() =>
  kembaliTarget.value?.Kembali === 1 ? "Batal Kembali" : "Kembali"
);

const doToggleKembali = (row?: FPRow) => {
  const target = row || (isSingleSelected.value ? selectedItem.value : null);
  if (!target) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  kembaliTarget.value = target;
  showKembaliDialog.value = true;
};

const confirmToggleKembali = async () => {
  if (!kembaliTarget.value) return;
  showKembaliDialog.value = false;
  isTogglingKembali.value = true;
  try {
    await fpApi.toggleKembali(kembaliTarget.value.Nomor);
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status kembali.");
  } finally {
    isTogglingKembali.value = false;
    kembaliTarget.value = null;
  }
};

// ── Toggle Bayar (paritas UpdateStatusPembayaran — FINANCE saja) ─────
const authStore = useAuthStore();
const isFinance = computed(() => authStore.userKode.toUpperCase() === "FINANCE");
const isTogglingBayar = ref(false);
const showBayarDialog = ref(false);
const bayarTarget = ref<FPRow | null>(null);
const bayarActionLabel = computed(() =>
  bayarTarget.value?.Status_Bayar === "Sudah" ? "Batal Bayar" : "Sudah Bayar"
);

const doToggleBayar = (row?: FPRow) => {
  const target = row || (isSingleSelected.value ? selectedItem.value : null);
  if (!target) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  if (!isFinance.value) {
    toast.error("Hanya user FINANCE yang dapat mengubah status pembayaran.");
    return;
  }
  bayarTarget.value = target;
  showBayarDialog.value = true;
};

const confirmToggleBayar = async () => {
  if (!bayarTarget.value) return;
  showBayarDialog.value = false;
  isTogglingBayar.value = true;
  try {
    await fpApi.toggleBayar(bayarTarget.value.Nomor);
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status pembayaran.");
  } finally {
    isTogglingBayar.value = false;
    bayarTarget.value = null;
  }
};

// ── History Pembayaran (paritas HistoryPembayaran) ──────────────────
const showHistoryDialog = ref(false);
const historyLoading = ref(false);
const historyItems = ref<HistoryBayarRow[]>([]);
const historyNomor = ref("");

const doHistoryBayar = async (row?: FPRow) => {
  const target = row || (isSingleSelected.value ? selectedItem.value : null);
  if (!target) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  historyNomor.value = target.Nomor;
  showHistoryDialog.value = true;
  historyLoading.value = true;
  try {
    historyItems.value = await fpApi.getHistoryBayar(historyNomor.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat history pembayaran.");
  } finally {
    historyLoading.value = false;
  }
};

const openBayarCustomer = (row: HistoryBayarRow) => {
  showHistoryDialog.value = false;
  router.push({
    name: "bayarCustomerEdit",
    params: { nomor: encodeURIComponent(row.Nomor) },
  });
};

// ── Edit JT — angsuran jatuh tempo (paritas ufrmEditJT) ─────────────
const showJtDialog = ref(false);
const jtLoading = ref(false);
const jtSaving = ref(false);
const jtData = ref<EditJtData | null>(null);
const jtRows = ref<EditJtDetail[]>([]);

const jtTotalAngsuran = computed(() =>
  jtRows.value.reduce((s, r) => s + Number(r.total || 0), 0)
);
const jtSelisih = computed(() =>
  jtData.value ? jtTotalAngsuran.value - Number(jtData.value.amount) : 0
);

const doEditJt = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data FP terlebih dahulu.");
    return;
  }
  showJtDialog.value = true;
  jtLoading.value = true;
  try {
    jtData.value = await fpApi.getEditJt(selectedItem.value!.Nomor);
    jtRows.value = jtData.value.detail.length
      ? jtData.value.detail.map((d) => ({ ...d }))
      : [{ tanggaljt: jtData.value.jthTempo, total: jtData.value.amount }];
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data jatuh tempo.");
    showJtDialog.value = false;
  } finally {
    jtLoading.value = false;
  }
};

const jtAddRow = () => {
  jtRows.value.push({ tanggaljt: jtData.value?.jthTempo || "", total: 0 });
};
const jtRemoveRow = (idx: number) => {
  jtRows.value.splice(idx, 1);
};

const jtSave = async () => {
  if (!jtData.value) return;
  // Paritas Delphi: |sum angsuran - total faktur| <= 100
  if (jtSelisih.value > 100 || jtSelisih.value < -100) {
    toast.warning("Total faktur dengan total angsurang selisih");
    return;
  }
  jtSaving.value = true;
  try {
    await fpApi.saveEditJt(jtData.value.nomor, jtRows.value);
    toast.success("Jatuh tempo berhasil disimpan.");
    showJtDialog.value = false;
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan jatuh tempo.");
  } finally {
    jtSaving.value = false;
  }
};

// Esc = batal, hormati jtSaving supaya tidak menutup dialog yang sedang
// menyimpan (tombol Batal di footer juga disabled saat itu).
useEscClose(showJtDialog, () => {
  if (!jtSaving.value) showJtDialog.value = false;
});

const fmtJt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
// ── Formatting untuk tabel browse ─────────────────────────────────
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
const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Context menu klik-kanan (paritas PopupMenu Delphi ufrmBrowseFP) ──
// Memakai fasilitas BaseBrowse `:context-menu-items` (select baris + tutup Esc/klik luar).
const contextMenuItems = computed(() => [
  { label: "History Pembayaran", icon: "history", action: (it: FPRow) => doHistoryBayar(it) },
  { label: "Update Status Kembali", icon: "keyboard_return", action: (it: FPRow) => doToggleKembali(it) },
  { label: "Update Status Pembayaran", icon: "payments", disabled: !isFinance.value, action: (it: FPRow) => doToggleBayar(it) },
]);

const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  const props: any = {};
  // Paritas Delphi cxGrdMasterStylesGetContentStyle: highlight saat Kembali > 0
  if (Number(row?.Kembali) > 0) props.class = "row-kembali";
  return props;
};
</script>

<template>
  <BaseBrowse
    title="Faktur Penjualan (FP)"
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
    :print-fn="() => { showCetakDialog = true }"
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
        :loading="isPrinting"
        :disabled="!isSingleSelected"
        @click="showCetakDialog = true"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F12]</span> Cetak
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-edit"
        :disabled="!isSingleSelected"
        @click="doEditJt"
      >
        Edit JT
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.Tanggal="{ value }">{{ fmtDate(value) }}</template>
    <template #item.JthTempo="{ value }">{{ fmtDate(value) }}</template>
    <template #item.Total="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Ppn="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Retur="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Disc_Faktur="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Biaya_Promosi="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>
    <template #item.Bayar="{ value }"><span class="num-cell">{{ fmt(value) }}</span></template>

    <template #item.Status_Bayar="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">{{ value }}</span>
    </template>

    <template #item.Kembali="{ value }">
      <span :class="value === 1 ? 'badge-return' : 'badge-open'">{{ value === 1 ? 'Ya' : 'Tidak' }}</span>
    </template>

    <template #summary-row="{ filteredItems }">
      <span class="summary-lbl">Total</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Total), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">PPN</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Ppn), 0)) }}</span>
      <span class="summary-lbl" style="margin-left: 20px">Retur</span>
      <span class="summary-val">{{ fmt(filteredItems.reduce((s: number, r: any) => s + Number(r.Retur), 0)) }}</span>
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
              <th style="width: 70px" class="tr">Kontrak</th>
              <th style="width: 90px" class="tc">ED</th>
              <th style="min-width: 110px">ID Batch</th>
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
              <td class="tr">{{ d.Kontrak }}</td>
              <td class="tc">{{ fmtDate(d.ED) }}</td>
              <td class="mono">{{ d.Batch }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="10" class="empty-td">Tidak ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <!-- ── Pilih Jenis Cetak (F12) ── -->
  <CetakPickerDialog
    v-model="showCetakDialog"
    title="Faktur Penjualan - Pilih Jenis Cetak"
    :options="[
      { label: 'Cetak', hint: 'Faktur Penjualan', value: 'biasa' },
      { label: 'Cetak V RET', hint: 'Faktur dikoreksi retur', value: 'retur' },
    ]"
    @select="onPilihCetak"
  />

  <!-- Export Dialog -->
  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('FP')"
    @export-detail="exportDetailOnly('FP')"
  />

  <!-- Printer Dialog -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />

  <!-- Print Preview Dialog -->
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    title="Preview Faktur Penjualan"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />

  <!-- ── Konfirmasi Re-cetak (paritas Delphi cekcetak) ── -->
  <ConfirmDialog
    v-model="showRecetakDialog"
    title="Cetak Ulang Faktur"
    icon="print"
    message="Faktur ini sudah pernah dicetak."
    question="Yakin ingin mencetak lagi?"
    subject-label="Nomor"
    :subject-value="recetakNomor"
    cancel-label="Tidak"
    confirm-label="Ya, Cetak"
    @confirm="confirmRecetak"
    @cancel="cancelRecetak"
  />

  <!-- ── Konfirmasi Toggle Kembali ── -->
  <ConfirmDialog
    v-model="showKembaliDialog"
    title="Ubah Status Kembali"
    icon="undo"
    message="Status kembali FP ini akan diubah."
    question="Lanjutkan?"
    subject-label="Nomor"
    :subject-value="kembaliTarget?.Nomor"
    :confirm-label="`Ya, ${kembaliActionLabel}`"
    :busy="isTogglingKembali"
    @confirm="confirmToggleKembali"
  />

  <!-- ── Konfirmasi Toggle Bayar ── -->
  <ConfirmDialog
    v-model="showBayarDialog"
    title="Ubah Status Pembayaran"
    icon="payments"
    message="Status pembayaran FP ini akan diubah."
    question="Lanjutkan?"
    subject-label="Nomor"
    :subject-value="bayarTarget?.Nomor"
    :confirm-label="`Ya, ${bayarActionLabel}`"
    :busy="isTogglingBayar"
    @confirm="confirmToggleBayar"
  />

  <!-- ── History Pembayaran ── -->
  <v-dialog v-model="showHistoryDialog" max-width="560" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        History Pembayaran: {{ historyNomor }}
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="historyLoading" class="modal-loading">Memuat...</div>
        <table v-else class="modal-tbl">
          <thead>
            <tr>
              <th>Nomor Bayar</th>
              <th class="tc">Tanggal</th>
              <th>Nomor FP</th>
              <th class="tr">Bayar</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in historyItems"
              :key="row.Nomor"
              class="modal-row"
              :title="'Buka pembayaran ' + row.Nomor"
              @click="openBayarCustomer(row)"
            >
              <td class="mono">{{ row.Nomor }}</td>
              <td class="tc">{{ row.Tanggal }}</td>
              <td class="mono">{{ row.NomorFP }}</td>
              <td class="tr">{{ fmt(row.Bayar) }}</td>
            </tr>
            <tr v-if="historyItems.length === 0">
              <td colspan="4" class="empty-state">Belum ada pembayaran untuk FP ini.</td>
            </tr>
          </tbody>
        </table>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showHistoryDialog = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Edit JT (angsuran jatuh tempo) ── -->
  <v-dialog v-model="showJtDialog" max-width="620" scrollable persistent>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Edit Jatuh Tempo: {{ jtData?.nomor }}
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div v-if="jtLoading" class="modal-loading">Memuat...</div>
        <template v-else-if="jtData">
          <div class="jt-info">
            <span><strong>Customer:</strong> {{ jtData.cusNama }}</span>
            <span><strong>Total FP:</strong> {{ fmtJt(jtData.amount) }}</span>
            <span><strong>Jth Tempo:</strong> {{ jtData.jthTempo }}</span>
          </div>
          <div class="detail-table-header">
            <table class="jt-tbl">
              <thead>
                <tr>
                  <th style="width: 36px" class="tc">No</th>
                  <th style="width: 160px" class="tc">Tanggal JT</th>
                  <th class="tr">Nilai</th>
                  <th style="width: 36px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in jtRows" :key="idx">
                  <td class="tc row-no">{{ idx + 1 }}</td>
                  <td>
                    <DsDatePicker v-model="r.tanggaljt" variant="cell" />
                  </td>
                  <td class="tr">
                    <input v-model.number="r.total" type="number" step="0.01" min="0" class="cell-inp tr" />
                  </td>
                  <td class="tc">
                    <button class="btn-del" type="button" title="Hapus baris" @click="jtRemoveRow(idx)">×</button>
                  </td>
                </tr>
                <tr v-if="jtRows.length === 0">
                  <td colspan="4" class="empty-state">Belum ada angsuran. Klik Tambah Angsuran.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="jt-actions">
            <button class="btn-add-detail" type="button" @click="jtAddRow">+ Tambah Angsuran</button>
          </div>
          <div class="jt-summary">
            <span>Total Angsuran: <strong>{{ fmtJt(jtTotalAngsuran) }}</strong></span>
            <span :class="Math.abs(jtSelisih) > 100 ? 'jt-selisih-bad' : 'jt-selisih-ok'">
              Selisih: <strong>{{ fmtJt(jtSelisih) }}</strong>
            </span>
          </div>
        </template>
      </v-card-text>
      <v-card-actions class="pa-2" style="border-top: 1px solid var(--ds-border, #A0AAB8);">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showJtDialog = false" :disabled="jtSaving">Batal</v-btn>
        <v-btn color="primary" variant="flat" size="small" :loading="jtSaving" :disabled="jtLoading" @click="jtSave">
          Simpan
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }
.date-inp { height: 32px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 8px; font-size: 12px; outline: none; width: 130px; }
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }

.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }

:deep(.row-closed td) { color: #9e9e9e !important; }
:deep(.row-kembali td) { color: #0369a1 !important; }

/* ── Modal History Bayar & Edit JT ── */
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th { background: var(--ds-primary, #0284c7); color: white; font-weight: 700; padding: 5px 8px; text-align: left; white-space: nowrap; }
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 11px; padding: 16px 12px; }

.jt-info { display: flex; gap: 16px; flex-wrap: wrap; font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); margin-bottom: 8px; }
.jt-tbl { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
.jt-tbl thead tr { background: var(--ds-primary, #0284c7); }
.jt-tbl th { color: white; font-weight: 700; padding: 4px 8px; font-size: 10px; text-transform: uppercase; }
.jt-tbl td { padding: 2px 4px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); vertical-align: middle; }
.jt-tbl .cell-inp { width: 100%; height: 22px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 4px; font-size: 11px; outline: none; }
.jt-tbl .cell-inp:focus { border-color: var(--ds-primary, #0284c7); }
.jt-tbl .row-no { color: var(--ds-text-muted, #8494A7); font-size: 10px; }
.jt-actions { display: flex; justify-content: flex-end; padding: 6px 0; }
.btn-add-detail { height: 24px; padding: 0 12px; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); border-radius: 0; font-size: 11px; font-weight: 600; cursor: pointer; }
.btn-add-detail:hover { background: var(--ds-primary-dark, #0369a1); }
.btn-del { background: none; border: none; color: var(--ds-text-muted, #8494A7); font-size: 14px; cursor: pointer; line-height: 1; padding: 2px 6px; }
.btn-del:hover { color: #dc2626; }
.jt-summary { display: flex; justify-content: flex-end; gap: 20px; font-size: 12px; padding: 6px 0 0; }
.jt-selisih-bad { color: #dc2626; }
.jt-selisih-ok { color: #059669; }

.badge-closed { background: #E0E4EA; color: var(--ds-text-secondary, #5A6A7E); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.badge-open { background: #E8EDF5; color: var(--ds-primary, #0284c7); padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }
.badge-return { background: #e1f5fe; color: #0369a1; padding: 1px 8px; border-radius: 0; font-size: 10px; font-weight: 700; }

.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>