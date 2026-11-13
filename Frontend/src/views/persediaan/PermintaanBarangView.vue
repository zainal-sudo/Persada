<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  permintaanBarangApi,
  type PermintaanBarangRow,
  type PermintaanBarangDetailRow,
} from "@/api/persediaan/permintaanBarangApi";
import { useBrowse } from "@/composables/useBrowse";
import ExportDialog from "@/components/ExportDialog.vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileSpreadsheet, IconLock } from "@tabler/icons-vue";
import { IconClipboardText } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

// ── Periode (sessionStorage persist) ─────────────────────────────────
const STORAGE_KEY = "persediaan_periode_permintaan_barang";

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

// ── useBrowse (Permission + Data) ────────────────────────────────────
const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  fetchData,
} = useBrowse<PermintaanBarangRow>({
  fetchApi: () => permintaanBarangApi.getBrowse(startDate.value, endDate.value),
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "100px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Memo", title: "Memo", width: "200px" },
  { key: "Closed", title: "Closed", width: "80px", align: "center" as const },
  { key: "User", title: "User", width: "80px" },
  { key: "date_create", title: "Created", width: "140px", align: "center" as const },
];

// ── Watch periode → fetch data ───────────────────────────────────────
watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startDate: s, endDate: e })
    );
  } catch {}
});

// ── Expand Detail ────────────────────────────────────────────────────
const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, PermintaanBarangDetailRow[]>>({});
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
        [nomor]: await permintaanBarangApi.getDetail(nomor),
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
  router.push({ name: "permintaanBarangCreate" });
};

const onEdit = (item: PermintaanBarangRow) => {
  router.push({
    name: "permintaanBarangEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const onDelete = async (item: PermintaanBarangRow) => {
  try {
    await permintaanBarangApi.delete(item.Nomor);
    toast.success("Data permintaan barang berhasil dihapus.");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data permintaan.");
  }
};

// ── Closed/Unclosed (paritas btn1 Delphi) ─────────────────────────────
const onToggleClosed = async () => {
  if (!selected.value.length) {
    toast.warning("Pilih satu data permintaan terlebih dahulu.");
    return;
  }
  const item = selected.value[0];
  const isClosed = item.Closed === "Sudah";
  if (!window.confirm(isClosed ? "Yakin Membatalkan Closed Permintaan?" : "Yakin Closed Permintaan?")) return;
  try {
    await permintaanBarangApi.toggleClosed(item.Nomor);
    toast.success("Status berhasil diubah.");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status.");
  }
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

// ── Export ───────────────────────────────────────────────────────────
const showExportDialog = ref(false);
const isExporting = ref(false);

const headerCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"Tanggal","title":"Tanggal","width":12,"align":"center"},{"key":"Memo","title":"Memo","width":25},{"key":"Closed","title":"Closed","width":10,"align":"center"},{"key":"User","title":"User","width":12},{"key":"date_create","title":"Created","width":18,"align":"center"}];
const detailCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"SKU","title":"SKU","width":15},{"key":"NamaBarang","title":"Nama Barang","width":30},{"key":"Satuan","title":"Satuan","width":10,"align":"center"},{"key":"QTY","title":"QTY","width":12,"numFmt":"#,##0"},{"key":"QtyTerima","title":"Qty Terima","width":12,"numFmt":"#,##0"},{"key":"StokNow","title":"Stok Now","width":12,"numFmt":"#,##0"},{"key":"AvgSale","title":"Avg Sale","width":12,"numFmt":"#,##0"}];

const doExportHeader = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r: any) => ({
      ...r,
      Tanggal: r.Tanggal ? fmtDate(r.Tanggal) : r.Tanggal,
      Expired: r.Expired ? fmtDate(r.Expired) : r.Expired,
    }));
    exportStyledHeader({
      title: "Permintaan Barang",
      columns: headerCols,
      items: exportItems,
      fileName: `PermintaanBarang_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Permintaan Barang",
    });
  } finally { isExporting.value = false; }
};

const doExportDetail = async () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const allDetail: any[] = [];
    for (const item of items.value) {
      try {
        const d = await permintaanBarangApi.getDetail(item.Nomor);
        allDetail.push(...d);
      } catch { /* skip */ }
    }
    exportStyledHeader({
      title: "Permintaan Barang",
      columns: detailCols,
      items: allDetail,
      fileName: `PermintaanBarang_Detail_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Permintaan Barang - Detail",
    });
  } finally { isExporting.value = false; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Permintaan Barang"
    :icon="IconClipboardText"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Nomor"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    search-placeholder="Cari permintaan barang..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
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

    <template #extra-actions>
      <v-btn
        v-if="selected.length"
        size="small"
        class="tb-btn tb-btn-neutral"
        :disabled="!selected.length"
        @click="onToggleClosed"
      >
        <template #prepend>
          <IconLock :size="13" :stroke-width="1.8" />
        </template>
        {{ selected[0].Closed === 'Sudah' ? 'Buka' : 'Closed' }}
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="showExportDialog = true">
        <template #prepend>
          <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <!-- Custom Cells -->
    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.Closed="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
      </span>
    </template>

    <template #item.date_create="{ value }">
      <span>{{ fmtDate(value) }}</span>
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
              <th style="width: 80px">Nomor</th>
              <th style="width: 80px">SKU</th>
              <th style="min-width: 180px">Nama Barang</th>
              <th style="width: 60px" class="tc">Satuan</th>
              <th style="width: 60px" class="tr">QTY</th>
              <th style="width: 80px" class="tr">Qty Terima</th>
              <th style="width: 80px" class="tr">Stok Now</th>
              <th style="width: 80px" class="tr">Avg Sale</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td>{{ d.Nomor }}</td>
              <td class="mono">{{ d.SKU }}</td>
              <td class="bold">{{ d.NamaBarang }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmt(d.QTY) }}</td>
              <td class="tr">{{ fmt(d.QtyTerima) }}</td>
              <td class="tr">{{ fmt(d.StokNow) }}</td>
              <td class="tr">{{ fmt(d.AvgSale) }}</td>
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
    @export-header="doExportHeader"
    @export-detail="doExportDetail"
  />
</template>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
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
}

.date-inp {
  height: 32px;
  border: 1px solid var(--ds-border, #d1d5db);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  width: 130px;
}

.date-inp:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 1px var(--ds-primary, #0284c7);
}

.badge-closed {
  background: #e0e0e0;
  color: #616161;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
}

.badge-open {
  background: #E8EDF5;
  color: var(--ds-primary, #0284c7);
  padding: 1px 8px;
  font-size: 10px;
  font-weight: 700;
}

.tc {
  text-align: center;
}

.tr {
  text-align: right;
}

.mono {
  font-family: monospace;
}

.bold {
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
  border-bottom: 1px solid var(--ds-border-light, #dde1e6);
  white-space: nowrap;
}

.detail-tbl td + td {
  border-left: 1px solid var(--ds-border-light, #dde1e6);
}

.detail-tbl tbody tr:hover td {
  background: var(--ds-primary-50, rgba(59, 89, 152, 0.06));
}

.empty-td {
  text-align: center;
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>