<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  mutasiGudangApi,
  type MutasiGudangRow,
  type MutasiGudangDetailRow,
} from "@/api/persediaan/mutasiGudangApi";
import { useBrowse } from "@/composables/useBrowse";
import ExportDialog from "@/components/ExportDialog.vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileSpreadsheet } from "@tabler/icons-vue";
import { IconArrowsExchange } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

// ── Periode (sessionStorage persist) ─────────────────────────────────
const STORAGE_KEY = "persediaan_periode_mutasi_gudang";

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
  isSingleSelected,
  selectedItem,
  canInsert,
  canEdit,
  canExport,
  fetchData,
} = useBrowse<MutasiGudangRow>({
  fetchApi: () => mutasiGudangApi.getBrowse(startDate.value, endDate.value),
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "100px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Asal", title: "Asal", width: "200px" },
  { key: "Tujuan", title: "Tujuan", width: "200px" },
  { key: "Keterangan", title: "Keterangan", width: "80px" },
  { key: "Realisasi", title: "Realisasi", width: "80px", align: "center" as const },
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
const detailMap = ref<Record<string, MutasiGudangDetailRow[]>>({});
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
        [nomor]: await mutasiGudangApi.getDetail(nomor),
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
  router.push({ name: "mutasiGudangCreate" });
};

const onEdit = (item: MutasiGudangRow) => {
  // Paritas Delphi: sudah Realisasi tidak dapat diedit.
  if (item.Realisasi === "Sudah") {
    toast.error("Transaksi ini sudah Realisasi, tidak dapat diedit.");
    return;
  }
  router.push({
    name: "mutasiGudangEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

// ── Toggle Realisasi (paritas Delphi &Update Status) ──────────────────
const isToggling = ref(false);
const handleToggleRealisasi = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu data mutasi gudang terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  isToggling.value = true;
  try {
    const res = await mutasiGudangApi.toggleRealisasi(item.Nomor);
    toast.success(res.realisasi ? "Mutasi direalisasi (stok dipindahkan)." : "Realisasi dibatalkan (stok di-undo).");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status realisasi.");
  } finally {
    isToggling.value = false;
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

const headerCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"Tanggal","title":"Tanggal","width":12,"align":"center"},{"key":"Asal","title":"Asal","width":25},{"key":"Tujuan","title":"Tujuan","width":25},{"key":"Keterangan","title":"Keterangan","width":15},{"key":"Realisasi","title":"Realisasi","width":12,"align":"center"}];
const detailCols: ExportColumn[] = [{"key":"Nomor","title":"Nomor","width":15},{"key":"Kode","title":"Kode","width":15},{"key":"Nama","title":"Nama","width":30},{"key":"Jumlah","title":"Jumlah","width":12,"numFmt":"#,##0"},{"key":"Expired","title":"Expired","width":12,"align":"center"},{"key":"Keterangan","title":"Keterangan","width":25}];

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
      title: "Mutasi Gudang",
      columns: headerCols,
      items: exportItems,
      fileName: `MutasiGudang_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Mutasi Gudang",
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
        const d = await mutasiGudangApi.getDetail(item.Nomor);
        allDetail.push(...d);
      } catch { /* skip */ }
    }
    exportStyledHeader({
      title: "Mutasi Gudang",
      columns: detailCols,
      items: allDetail,
      fileName: `MutasiGudang_Detail_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Mutasi Gudang - Detail",
    });
  } finally { isExporting.value = false; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Mutasi Gudang"
    :icon="IconArrowsExchange"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Nomor"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="false"
    :can-export="canExport"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    search-placeholder="Cari mutasi gudang..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
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
        v-if="canEdit"
        size="small"
        class="tb-btn tb-btn-neutral"
        :loading="isToggling"
        :disabled="!isSingleSelected"
        @click="handleToggleRealisasi"
      >
        <template #prepend>
          <IconArrowsExchange :size="13" :stroke-width="1.8" />
        </template>
        {{ selectedItem?.Realisasi === 'Sudah' ? 'Batal Realisasi' : 'Realisasi' }}
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

    <template #item.Realisasi="{ value }">
      <span :class="value === 'Sudah' ? 'badge-closed' : 'badge-open'">
        {{ value }}
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
              <th style="width: 80px">Nomor</th>
              <th style="width: 80px">Kode</th>
              <th style="min-width: 200px">Nama</th>
              <th style="width: 80px" class="tr">Jumlah</th>
              <th style="width: 100px" class="tc">Expired</th>
              <th style="width: 150px">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td>{{ d.Nomor }}</td>
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tr">{{ fmt(d.Jumlah) }}</td>
              <td class="tc">{{ fmtDate(d.Expired) }}</td>
              <td>{{ d.Keterangan }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="6" class="empty-td">Tidak ada detail.</td>
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
  color: var(--ds-text, #374151);
  white-space: nowrap;
}

.filter-sep {
  font-size: 12px;
  color: #9ca3af;
}

.date-inp {
  height: 32px;
  border: 1px solid var(--ds-border, #dde1e6);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  width: 130px;
}

.date-inp:focus {
  border-color: var(--ds-primary, #D97706);
  box-shadow: 0 0 0 1px var(--ds-primary, #D97706);
}

.badge-closed {
  background: var(--ds-surface-inset, #f0f2f5);
  color: var(--ds-text-muted, #6b7280);
  padding: 1px 8px;
  font-size: 10px;
  font-weight: 700;
}

.badge-open {
  background: rgba(59,89,152,0.1);
  color: var(--ds-primary, #D97706);
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
  color: var(--ds-text-muted, #6b7280);
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
  border-bottom: 1px solid var(--ds-border-light, #f0f2f5);
  white-space: nowrap;
}

.detail-tbl tbody tr:hover td {
  background: var(--ds-primary-50, rgba(59,89,152,0.04));
}

.empty-td {
  text-align: center;
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>