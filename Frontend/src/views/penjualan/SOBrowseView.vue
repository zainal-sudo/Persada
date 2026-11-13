<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import CetakPickerDialog from "@/components/CetakPickerDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { soApi, type SORow, type SODetailRow } from "@/api/penjualan/soApi";
import {
  IconShoppingBag,
  IconFileSpreadsheet,
  IconPrinter,
  IconLock,
} from "@tabler/icons-vue";

import { useSoPrint, type SOVariant } from "@/composables/useSoPrint";
import { useEscClose } from "@/composables/useEscClose";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const {
  isPrinting,
  showPrinterDialog,
  showPreviewDialog,
  previewLines,
  previewTitle,
  loadAndPreview,
  onPrinterSaved,
  onPrintFromPreview,
  PrinterDialog,
  PrintPreviewDialog,
} = useSoPrint();

// ── Periode (sessionStorage persist) ─────────────────────────────────
const STORAGE_KEY = "finance_periode_so";

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
  } catch {
    /* silent */
  }
  return null;
};

const now = new Date();
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const saved = getSaved();

const startDate = ref(saved?.startDate ?? getLocal(firstDay));
const endDate = ref(saved?.endDate ?? getLocal(now));

// ── useBrowse (Permission + Data) ────────────────────────────────────
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
} = useBrowse<SORow>({
  fetchApi: () => soApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => soApi.delete(nomor),
  getDetailApi: (nomor: string) => soApi.getDetail(nomor),
  exportTitle: "Sales Order (SO)",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Memo", title: "Memo", width: 25 },
    { key: "Customer", title: "Customer", width: 25 },
    { key: "Closed", title: "Closed", width: 10, align: "center" },
    { key: "Total", title: "Total", width: 16, numFmt: "#,##0" },
    { key: "Ppn", title: "PPN", width: 14, numFmt: "#,##0" },
    { key: "Salesman", title: "Salesman", width: 15 },
    { key: "Kirim", title: "Kirim", width: 10, align: "center" },
    { key: "Eceran", title: "Eceran", width: 10, align: "center" },
    { key: "User_create", title: "User", width: 10 },
    { key: "date_create", title: "Created", width: 18, align: "center" },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Harga", title: "Harga", width: 14, numFmt: "#,##0" },
    { key: "Disc", title: "Disc%", width: 8, numFmt: "#,##0.00" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Terkirim", title: "Terkirim", width: 12, numFmt: "#,##0.00" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

// ── Watch periode → fetch data ───────────────────────────────────────
watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startDate: s, endDate: e })
    );
  } catch {
    /* silent */
  }
});

// ── Headers (sesuai SQLMaster Delphi) ────────────────────────────────
const headers = [
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Memo", title: "Memo", width: "200px" },
  { key: "Customer", title: "Customer", minWidth: "180px" },
  { key: "Closed", title: "Closed", width: "70px", align: "center" as const },
  { key: "Total", title: "Total", width: "140px", align: "right" as const },
  { key: "Ppn", title: "PPN", width: "120px", align: "right" as const },
  { key: "Salesman", title: "Salesman", width: "130px" },
  { key: "Kirim", title: "Kirim", width: "70px", align: "center" as const },
  { key: "Eceran", title: "Eceran", width: "70px", align: "center" as const },
  { key: "User_create", title: "User", width: "80px" },
  { key: "date_create", title: "Created", width: "140px", align: "center" as const },
];

// ── Expand Detail ────────────────────────────────────────────────────
const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, SODetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = {
        ...detailMap.value,
        [nomor]: await soApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

// ── Actions ──────────────────────────────────────────────────────────
const onAdd = () => {
  router.push({ name: "soCreate" });
};

const onEdit = (item: SORow) => {
  if (item.Kirim === "Sudah") {
    toast.error("Transaksi ini sudah ada Pengiriman, tidak dapat diedit.");
    return;
  }
  router.push({
    name: "soEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const onDelete = async (item: SORow) => {
  if (item.Kirim === "Sudah") {
    toast.error("Transaksi ini sudah ada Pengiriman, tidak dapat dihapus.");
    return;
  }
  try {
    await soApi.delete(item.Nomor);

    toast.success("Berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus SO.");
  }
};

// ── Export ───────────────────────────────────────────────────────────
const doExport = () => handleExport();

// ── Close / Unclose SO ──────────────────────────────────────────────
const isClosing = ref(false);
const closeTarget = ref<SORow | null>(null);
const showCloseDialog = ref(false);
useEscClose(showCloseDialog, () => (showCloseDialog.value = false));
const closeActionLabel = computed(() => {
  if (!closeTarget.value) return "";
  return closeTarget.value.Closed === "Sudah" ? "Membatalkan Closed" : "Closed";
});

const doClose = () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data SO terlebih dahulu.");
    return;
  }
  closeTarget.value = selectedItem.value;
  showCloseDialog.value = true;
};

const confirmClose = async () => {
  if (!closeTarget.value) return;
  showCloseDialog.value = false;
  isClosing.value = true;
  try {
    const result = await soApi.toggleClose(closeTarget.value.Nomor);

    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status closed.");
  } finally {
    isClosing.value = false;
    closeTarget.value = null;
  }
};

// ── Cetak (Dot Matrix 4-ply) — varian SO / SP (qty-only) / PF (Proforma) ──
const showCetakDialog = ref(false);
const doCetak = async (variant: SOVariant = "SO") => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data SO terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  await loadAndPreview(item.Nomor, variant);
};

const pilihCetak = (variant: SOVariant) => {
  doCetak(variant);
};

// ── Formatting ───────────────────────────────────────────────────────
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

const fmtDateTime = (val: string) => {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── Row props ────────────────────────────────────────────────────────
const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  if (row?.Closed === "Sudah") return { class: "row-closed" };
  return {};
};

</script>

<template>
  <BaseBrowse
    title="Sales Order (SO)"
    :icon="IconShoppingBag"
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
    :summary-columns="[
      { key: 'Total', label: 'Total SO', numFmt: '#,##0' },
      { key: 'Ppn', label: 'Total PPN', numFmt: '#,##0' },
    ]"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
    :print-fn="() => { showCetakDialog = true }"
  >
    <!-- ── Filter Periode ── -->
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <!-- ── Tombol Cetak & Export ── -->
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
        class="tb-btn tb-btn-neutral"
        :loading="isClosing"
        :disabled="!isSingleSelected"
        @click="doClose"
      >
        <template #prepend>
          <IconLock :size="13" :stroke-width="1.8" />
        </template>
        {{ selectedItem?.Closed === 'Sudah' ? 'Buka' : 'Closed' }}
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport" :loading="isExporting">
        <template #prepend>
          <IconFileSpreadsheet :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <!-- ── Custom cells ── -->
    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.Total="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>

    <template #item.Ppn="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>

    <template #item.date_create="{ value }">
      <span>{{ fmtDateTime(value) }}</span>
    </template>

    <template #item.Closed="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
      </span>
    </template>

    <template #item.Kirim="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
      </span>
    </template>

    <template #item.Eceran="{ value }">
      <span :class="value === 'Ya' ? 'badge-eceran' : ''">
        {{ value }}
      </span>
    </template>



    <!-- ── Expanded Detail ── -->
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
              <th style="width: 120px" class="tr">Harga</th>
              <th style="width: 60px" class="tr">Disc%</th>
              <th style="width: 120px" class="tr">Nilai</th>
              <th style="width: 80px" class="tr">Terkirim</th>
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
              <td class="tr">{{ fmtQty(d.Terkirim) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="8" class="empty-td">Tidak ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <!-- ── Pilih Jenis Cetak (F12) ── -->
  <CetakPickerDialog
    v-model="showCetakDialog"
    title="Sales Order - Pilih Jenis Cetak"
    :options="[
      { label: 'Sales Order', hint: 'Dot Matrix 4-ply', value: 'SO' },
      { label: 'Surat Pesanan', hint: 'Qty-only', value: 'SP' },
      { label: 'Proforma Invoice', hint: 'Pra-forma', value: 'PF' },
    ]"
    @select="pilihCetak"
  />

  <!-- ── Export Dialog ── -->
  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('SO')"
    @export-detail="exportDetailOnly('SO')"
  />

  <!-- ── Printer Dialog (di luar BaseBrowse) ── -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />

  <!-- ── Print Preview Dialog ── -->
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    :title="previewTitle"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />

  <!-- ── Konfirmasi Close/Unclose ── -->
  <v-dialog v-model="showCloseDialog" max-width="340" persistent>
    <v-card rounded="false">
      <v-card-text class="pa-5 text-center">
        <v-icon
          :color="closeTarget?.Closed === 'Sudah' ? 'warning' : 'success'"
          size="44"
          class="mb-3"
        >
          <IconLock :size="44" :stroke-width="1.5" />
        </v-icon>
        <div class="text-subtitle-1 font-weight-bold mb-1">
          Yakin {{ closeActionLabel }} SO ?
        </div>
        <div class="text-caption text-medium-emphasis mb-4">
          Nomor: {{ closeTarget?.Nomor }}
        </div>
        <div class="d-flex gap-2 justify-center">
          <v-btn size="small" variant="outlined" @click="showCloseDialog = false">
            Batal
          </v-btn>
          <v-btn
            size="small"
            :color="closeTarget?.Closed === 'Sudah' ? 'warning' : 'success'"
            variant="flat"
            @click="confirmClose"
          >
            Ya, {{ closeActionLabel }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.filter-lbl {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}
.filter-sep {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}
.date-inp {
  height: 32px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  width: 130px;
}
.date-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.tc {
  text-align: center;
}
.tr {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.num-cell {
  font-variant-numeric: tabular-nums;
}
.mono {
  font-family: monospace;
}
.bold {
  font-weight: 700;
}
.accent {
  color: var(--ds-primary, #0284c7);
}

:deep(.row-closed td) {
  color: #9e9e9e !important;
}

.badge-closed {
  background: #E0E4EA;
  color: var(--ds-text-secondary, #5A6A7E);
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}
.badge-open {
  background: #E8EDF5;
  color: var(--ds-primary, #0284c7);
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}
.badge-eceran {
  background: #e1f5fe;
  color: #0369a1;
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}

.detail-wrap {
  padding: 4px 0;
}
.detail-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  font-size: 12px;
  color: #6b7280;
}
.detail-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.detail-tbl thead tr {
  background: var(--ds-primary, #0284c7);
}
.detail-tbl th {
  color: white;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
  text-align: left;
}
.detail-tbl td {
  padding: 3px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  white-space: nowrap;
}
.detail-tbl tbody tr:hover td {
  background: rgba(59, 89, 152, 0.05);
}
.empty-td {
  text-align: center;
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>
