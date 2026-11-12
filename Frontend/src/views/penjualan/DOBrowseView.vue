<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { doApi, type DORow, type DODetailRow } from "@/api/penjualan/doApi";
import { IconTruckDelivery, IconFileSpreadsheet, IconPrinter, IconArrowBackUp } from "@tabler/icons-vue";

import { useDoPrint } from "@/composables/useDoPrint";
import { useEscClose } from "@/composables/useEscClose";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

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
} = useDoPrint();

// ── Periode ─────────────────────────────────────────────────────────
const STORAGE_KEY = "finance_periode_do";

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

// ── useBrowse ──────────────────────────────────────────────────────
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
} = useBrowse<DORow>({
  fetchApi: () => doApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => doApi.delete(nomor),
  getDetailApi: (nomor: string) => doApi.getDetail(nomor),
  exportTitle: "Delivery Order (DO)",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Nomor_SO", title: "Nomor SO", width: 18 },
    { key: "Salesman", title: "Salesman", width: 15 },
    { key: "Customer", title: "Customer", width: 25 },
    { key: "Invoiced", title: "Invoiced", width: 10, align: "center" },
    { key: "Kembali", title: "Kembali", width: 10, align: "center" },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Jumlah_Invoiced", title: "Qty Invoiced", width: 14, numFmt: "#,##0.00" },
    { key: "Expired", title: "Expired", width: 14, align: "center" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {}
});

// ── Headers ────────────────────────────────────────────────────────
const headers = [
  { key: "Nomor", title: "Nomor", width: "160px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Nomor_SO", title: "Nomor SO", width: "170px" },
  { key: "Salesman", title: "Salesman", width: "140px" },
  { key: "Customer", title: "Customer", minWidth: "180px" },
  { key: "Invoiced", title: "Invoiced", width: "80px", align: "center" as const },
  { key: "Kembali", title: "Kembali", width: "80px", align: "center" as const },
];

// ── Expand Detail ──────────────────────────────────────────────────
const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, DODetailRow[]>>({});
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
        [nomor]: await doApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

// ── Actions ────────────────────────────────────────────────────────
const onAdd = () => {
  router.push("/penjualan/do/create");
};

const onEdit = (item: DORow) => {
  if (item.Invoiced === "Sudah") {
    toast.error("Transaksi ini sudah ada Invoice, tidak dapat diedit.");
    return;
  }
  router.push(`/penjualan/do/edit/${encodeURIComponent(item.Nomor)}`);
};

const onDelete = async (item: DORow) => {
  if (item.Invoiced === "Sudah") {
    toast.error("Transaksi ini sudah ada Invoice, tidak dapat dihapus.");
    return;
  }
  try {
    await doApi.delete(item.Nomor);

    toast.success("Berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus DO.");
  }
};

// ── Cetak (Dot Matrix Surat Jalan) — via useDoPrint shared composable ──
const doCetak = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data DO terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  await loadAndPreview(item.Nomor);
};

// ── Toggle Kembali (paritas UpdateStatusKembali Delphi) ─────────────
const isTogglingKembali = ref(false);
const showKembaliDialog = ref(false);
useEscClose(showKembaliDialog, () => (showKembaliDialog.value = false));
const kembaliTarget = ref<DORow | null>(null);
const kembaliActionLabel = computed(() =>
  kembaliTarget.value?.Kembali === 1 ? "Batal Kembali" : "Kembali"
);

const doToggleKembali = () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data DO terlebih dahulu.");
    return;
  }
  kembaliTarget.value = selectedItem.value;
  showKembaliDialog.value = true;
};

// Klik-kanan baris → toggle Kembali (paritas PopupMenu Delphi).
const contextMenuItems = computed(() =>
  isSingleSelected.value
    ? [{
        label: selectedItem.value?.Kembali === 1 ? "Batal Kembali" : "Kembali",
        icon: selectedItem.value?.Kembali === 1 ? "undo" : "keyboard_return",
        action: () => doToggleKembali(),
      }]
    : []
);

const confirmToggleKembali = async () => {
  if (!kembaliTarget.value) return;
  showKembaliDialog.value = false;
  isTogglingKembali.value = true;
  try {
    await doApi.toggleKembali(kembaliTarget.value.Nomor);
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status kembali.");
  } finally {
    isTogglingKembali.value = false;
    kembaliTarget.value = null;
  }
};

// ── Formatting ─────────────────────────────────────────────────────
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

const fmtQtyBrowse = (v: number) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  // Paritas Delphi cxGrdMasterStylesGetContentStyle: highlight saat Kembali > 0
  if (Number(row?.Kembali) > 0) return { class: "row-kembali" };
  return {};
};

onMounted(() => {
});
</script>

<template>
  <BaseBrowse
    title="Delivery Order (DO)"
    :icon="IconTruckDelivery"
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
    :context-menu-items="contextMenuItems"
  >
    <!-- Filter Periode -->
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <!-- Cetak & Export -->
    <template #extra-actions>
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
      <v-btn
        v-if="false"
        size="small"
        class="tb-btn tb-btn-neutral"
        :loading="isTogglingKembali"
        :disabled="!isSingleSelected"
        @click="doToggleKembali"
      >
        <template #prepend>
          <IconArrowBackUp :size="13" :stroke-width="1.8" />
        </template>
        {{ selectedItem?.Kembali === 1 ? 'Batal Kembali' : 'Kembali' }}
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()" :loading="isExporting">
        <template #prepend>
          <IconFileSpreadsheet :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <!-- Custom Cells -->
    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.Invoiced="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
      </span>
    </template>

    <template #item.Kembali="{ value }">
      <span :class="value === 1 ? 'badge-return' : 'badge-open'">
        {{ value === 1 ? 'Ya' : 'Tidak' }}
      </span>
    </template>

    <!-- Expanded Detail -->
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
              <th style="width: 100px" class="tr">Jumlah Invoiced</th>
              <th style="width: 100px" class="tc">Expired</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmtQtyBrowse(d.Jumlah) }}</td>
              <td class="tr">{{ fmtQtyBrowse(d.Jumlah_Invoiced) }}</td>
              <td class="tc">{{ fmtDate(d.Expired) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="6" class="empty-td">Tidak ada detail barang.</td>
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
    @export-header="exportHeaderOnly('DO')"
    @export-detail="exportDetailOnly('DO')"
  />

  <!-- Printer Dialog -->
  <PrinterDialog
    v-model="showPrinterDialog"
    @saved="onPrinterSaved"
  />

  <!-- Print Preview Dialog -->
  <PrintPreviewDialog
    v-model="showPreviewDialog"
    title="Preview Surat Jalan (DO)"
    :lines="previewLines"
    :is-loading="isPrinting"
    @print="onPrintFromPreview"
  />

  <!-- ── Konfirmasi Toggle Kembali ── -->
  <v-dialog v-model="showKembaliDialog" max-width="340" persistent>
    <v-card rounded="false">
      <v-card-text class="pa-5 text-center">
        <v-icon
          :color="kembaliTarget?.Kembali === 1 ? 'warning' : 'success'"
          size="44"
          class="mb-3"
        >
          <IconArrowBackUp :size="44" :stroke-width="1.5" />
        </v-icon>
        <div class="text-subtitle-1 font-weight-bold mb-1">
          Yakin {{ kembaliActionLabel }} DO ?
        </div>
        <div class="text-caption text-medium-emphasis mb-4">
          Nomor: {{ kembaliTarget?.Nomor }}
        </div>
        <div class="d-flex gap-2 justify-center">
          <v-btn size="small" variant="outlined" @click="showKembaliDialog = false">
            Batal
          </v-btn>
          <v-btn
            size="small"
            :color="kembaliTarget?.Kembali === 1 ? 'warning' : 'success'"
            variant="flat"
            @click="confirmToggleKembali"
          >
            Ya, {{ kembaliActionLabel }}
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
  border-color: var(--ds-primary, #D97706);
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

:deep(.row-kembali td) {
  color: #e65100 !important;
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
  color: var(--ds-primary, #D97706);
  padding: 1px 8px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 700;
}
.badge-return {
  background: #FFF3E0;
  color: #e65100;
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
  background: var(--ds-primary, #D97706);
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
