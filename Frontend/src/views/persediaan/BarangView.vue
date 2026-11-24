<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { barangApi, type BarangRow, type BarangDetailRow } from "@/api/persediaan/barangApi";
import { useBrowse } from "@/composables/useBrowse";
import ExportDialog from "@/components/ExportDialog.vue";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconFileSpreadsheet } from "@tabler/icons-vue";
import { IconBox, IconPower } from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();

const searchFilter = ref("");

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
} = useBrowse<BarangRow>({
  fetchApi: () => barangApi.getBrowse(searchFilter.value),
  immediate: true,
});

const headers = [
  { key: "Kode", title: "Kode", width: "80px" },
  { key: "Nama", title: "Nama", width: "200px" },
  { key: "Satuan", title: "Satuan", width: "70px" },
  { key: "Kategori", title: "Kategori", width: "150px" },
  { key: "Tipe", title: "Tipe", width: "100px" },
  { key: "HargaJual", title: "Harga Jual", width: "120px", align: "right" as const },
  { key: "Stok", title: "Stok", width: "80px", align: "right" as const },
  { key: "Min", title: "Min", width: "80px", align: "right" as const },
  { key: "Disc_Salesman", title: "Disc Salesman", width: "100px", align: "right" as const },
  { key: "Merk", title: "Merk", width: "100px" },
  { key: "Divisi", title: "Divisi", width: "90px" },
  { key: "IsKonsinyasi", title: "Konsinyasi", width: "90px", align: "center" as const },
  { key: "Last_Sale", title: "Last Sale", width: "100px", align: "center" as const },
  { key: "Stok_Baik", title: "Stok Baik", width: "80px", align: "right" as const },
  { key: "Avgs_Sales_per_Bulan", title: "Avg Sales/Bulan", width: "110px", align: "right" as const },
  { key: "TOR", title: "TOR", width: "80px", align: "right" as const },
  { key: "IN_Terakhir", title: "IN Terakhir", width: "100px", align: "center" as const },
  { key: "Aktif", title: "Aktif", width: "70px", align: "center" as const },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, BarangDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Kode : e));
  expanded.value = newExpanded;

  for (const kode of keys) {
    if (detailMap.value[kode] || expandedLoading.value[kode]) continue;
    expandedLoading.value = { ...expandedLoading.value, [kode]: true };
    try {
      detailMap.value = {
        ...detailMap.value,
        [kode]: await barangApi.getDetail(kode),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${kode}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [kode]: false };
    }
  }
};

let searchTimer: ReturnType<typeof setTimeout>;
watch(searchFilter, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    fetchData();
  }, 500);
});

// Paritas Delphi cxGrdMasterStylesGetContentStyle: Stok ≤ Min → merah.
const rowPropsFn = (data: any) => {
  const row = data.item?.raw || data.item;
  if (!row) return {};
  if (Number(row.Stok) <= Number(row.Min)) return { class: "row-stok-min" };
  if (Number(row.Aktif) !== 1) return { class: "row-inaktif" };
  return {};
};

const onAdd = () => {
  router.push({ name: "barangCreate" });
};

const onEdit = (item: BarangRow) => {
  router.push({
    name: "barangEdit",
    params: { kode: item.Kode },
  });
};

// ── Toggle Aktif/Nonaktif (pengganti hapus) ──────────────────────────
const isToggling = ref(false);
const handleToggleAktif = async () => {
  if (!isSingleSelected.value) {
    toast.warning("Pilih satu barang terlebih dahulu.");
    return;
  }
  const item = selectedItem.value!;
  isToggling.value = true;
  try {
    const res = await barangApi.toggleAktif(item.Kode);
    toast.success(res.aktif ? "Barang diaktifkan." : "Barang dinonaktifkan.");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengubah status aktif.");
  } finally {
    isToggling.value = false;
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
  } catch { return val; }
};
const fmtTOR = (v: number) => {
  if (!v || v === Infinity) return "-";
  return Number(v).toFixed(2);
};

// ── Export ───────────────────────────────────────────────────────────
const showExportDialog = ref(false);
const isExporting = ref(false);

const headerCols: ExportColumn[] = [{"key":"Kode","title":"Kode","width":15},{"key":"Nama","title":"Nama","width":30},{"key":"Satuan","title":"Satuan","width":10,"align":"center"},{"key":"Kategori","title":"Kategori","width":20},{"key":"Tipe","title":"Tipe","width":15},{"key":"HargaJual","title":"Harga Jual","width":16,"numFmt":"#,##0"},{"key":"Stok","title":"Stok","width":12,"numFmt":"#,##0"},{"key":"Min","title":"Min","width":12,"numFmt":"#,##0"},{"key":"Disc_Salesman","title":"Disc Salesman","width":14,"numFmt":"#,##0"},{"key":"Merk","title":"Merk","width":15},{"key":"Divisi","title":"Divisi","width":12},{"key":"IsKonsinyasi","title":"Konsinyasi","width":12,"align":"center"}];
const detailCols: ExportColumn[] = [{"key":"Kode","title":"Kode","width":15},{"key":"KD_Gudang","title":"Gudang","width":15},{"key":"Gudang","title":"Nama Gudang","width":25},{"key":"Expired","title":"Expired","width":12,"align":"center"},{"key":"stok","title":"Stok","width":12,"numFmt":"#,##0"}];

const doExportHeader = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const exportItems = items.value.map((r: any) => ({
      ...r,
      Tanggal: r.Tanggal ? fmtDate(r.Tanggal) : r.Tanggal,
      Expired: r.Expired ? fmtDate(r.Expired) : r.Expired,
      IsKonsinyasi: r.IsKonsinyasi === 1 ? "Ya" : "Tidak",
    }));
    exportStyledHeader({
      title: "Daftar Barang",
      columns: headerCols,
      items: exportItems,
      fileName: `Barang_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Daftar Barang",
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
        const d = await barangApi.getDetail(item.Kode);
        allDetail.push(...d);
      } catch { /* skip */ }
    }
    exportStyledHeader({
      title: "Daftar Barang",
      columns: detailCols,
      items: allDetail,
      fileName: `Barang_Detail_${new Date().toISOString().slice(0,10)}.xlsx`,
      subtitle: "Daftar Barang - Detail",
    });
  } finally { isExporting.value = false; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Barang"
    :icon="IconBox"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="false"
    :can-export="canExport"
    :row-props-fn="rowPropsFn"
    :auto-summary="false"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    search-placeholder="Cari barang..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #breadcrumb>
      <span class="ds-crumb-seg">Persediaan</span>
      <span class="ds-bc-slash">/</span>
      <span class="ds-crumb-seg"><b>Master Barang</b></span>
      <div class="ds-bc-right">
        <span class="ds-crumb-chip">Gudang Aktif: <b>WH-01</b></span>
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        v-if="canEdit"
        size="small"
        class="tb-btn tb-btn-neutral"
        :loading="isToggling"
        :disabled="!isSingleSelected"
        @click="handleToggleAktif"
      >
        <template #prepend>
          <IconPower :size="13" :stroke-width="1.8" />
        </template>
        {{ selectedItem?.Aktif === 1 ? "Nonaktifkan" : "Aktifkan" }}
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="showExportDialog = true">
        <template #prepend>
          <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Nama</span>
        <input v-model="searchFilter" type="text" class="nama-inp" placeholder="Filter nama barang..." />
      </div>
    </template>

    <template #item.HargaJual="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.Stok="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.Min="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.Disc_Salesman="{ value }">
      <span class="num-cell">{{ value }}%</span>
    </template>
    <template #item.Product_Focus="{ value }">
      <span :class="value === 'Ya' || value === 1 ? 'badge-focus' : ''">
        {{ value === 'Ya' || value === 1 ? 'Ya' : 'Tidak' }}
      </span>
    </template>
    <template #item.IsKonsinyasi="{ value }">
      <span :class="value === 1 ? 'badge-focus' : ''">
        {{ value === 1 ? 'Ya' : 'Tidak' }}
      </span>
    </template>
    <template #item.Last_Sale="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>
    <template #item.Stok_Baik="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.Avgs_Sales_per_Bulan="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.TOR="{ value }">
      <span class="num-cell">{{ fmtTOR(value) }}</span>
    </template>
    <template #item.IN_Terakhir="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>
    <template #item.Aktif="{ value }">
      <span :class="value === 1 ? 'badge-aktif' : 'badge-nonaktif'">
        {{ value === 1 ? "Aktif" : "Nonaktif" }}
      </span>
    </template>

    <template #detail="{ item }">
      <div class="detail-wrap">
        <div v-if="expandedLoading[item.Kode]" class="detail-loading">
          <v-progress-circular indeterminate color="primary" size="18" />
          <span>Memuat rincian...</span>
        </div>
        <table v-else class="detail-tbl">
          <thead>
            <tr>
              <th style="width: 80px">Kode</th>
              <th style="width: 80px">KD Gudang</th>
              <th style="min-width: 150px">Gudang</th>
              <th style="width: 100px" class="tc">Expired</th>
              <th style="width: 80px" class="tr">Stok</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Kode] || []" :key="idx">
              <td class="mono">{{ d.Kode }}</td>
              <td class="mono">{{ d.KD_Gudang }}</td>
              <td>{{ d.Gudang }}</td>
              <td class="tc">{{ fmtDate(d.Expired) }}</td>
              <td class="tr">{{ fmt(d.stok) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Kode]?.length">
              <td colspan="5" class="empty-td">Tidak ada detail stok.</td>
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
.filter-group { display: flex; align-items: center; gap: 6px; }
.filter-lbl { font-size: 12px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); white-space: nowrap; }
.nama-inp {
  height: 32px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 200px;
}
.nama-inp:focus { border-color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }
.badge-focus {
  background: #E8EDF5; color: var(--ds-primary, #0284c7); padding: 1px 8px;
  border-radius: 0; font-size: 10px; font-weight: 700;
}
:deep(.row-stok-min td) { color: #b91c1c; background: #fef2f2; }
:deep(.row-inaktif td) { color: #9e9e9e; background: #f3f4f6; }
.badge-aktif {
  background: #E6F4EA; color: #059669; padding: 1px 8px;
  border-radius: 0; font-size: 10px; font-weight: 700;
}
.badge-nonaktif {
  background: #F3F4F6; color: #9e9e9e; padding: 1px 8px;
  border-radius: 0; font-size: 10px; font-weight: 700;
}
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: monospace; }
.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: var(--ds-text-muted, #8494A7); }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: var(--ds-primary-50, #E8EDF5); }
.empty-td { text-align: center; color: var(--ds-text-muted, #8494A7); font-style: italic; padding: 12px; }
</style>