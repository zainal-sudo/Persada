<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { useBrowse } from "@/composables/useBrowse";
import { bpbApi, type BPBRow, type BPBDetailRow } from "@/api/pembelian/bpbApi";
import { IconReceipt, IconLock } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";
import DsDatePicker from "@/components/DsDatePicker.vue";

const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_bpb";

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

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  fetchData,
} = useBrowse<BPBRow>({
  fetchApi: () => bpbApi.getBrowse(startDate.value, endDate.value),
  deleteApi: (nomor: string) => bpbApi.delete(nomor),
  getDetailApi: (nomor: string) => bpbApi.getDetail(nomor),
  exportTitle: "Barang Perolehan (BPB)",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "PO", title: "PO", width: 16 },
    { key: "Supplier", title: "Supplier", width: 22 },
    { key: "Gudang", title: "Gudang", width: 10 },
    { key: "Memo", title: "Memo", width: 20 },
    { key: "Status", title: "Status", width: 12 },
    { key: "User_create", title: "User", width: 10 },
    { key: "date_create", title: "Tgl Input", width: 16, align: "center" },
  ],
  detailColumns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Satuan", title: "Satuan", width: 10, align: "center" },
    { key: "Jumlah", title: "Jumlah", width: 12, numFmt: "#,##0.00" },
    { key: "Expired", title: "Expired", width: 12, align: "center" },
    { key: "IdBatch", title: "Id Batch", width: 14, align: "center" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed(() => selected.value[0] ?? null);

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

const headers = [
  { key: "Nomor", title: "Nomor", width: "160px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "PO", title: "PO", width: "150px" },
  { key: "Supplier", title: "Supplier", minWidth: "160px" },
  { key: "Gudang", title: "Gudang", width: "80px" },
    { key: "Memo", title: "Memo", width: "160px" },
    { key: "Status", title: "Status", width: "90px" },
  { key: "User_create", title: "User", width: "80px" },
  { key: "date_create", title: "Tgl Input", width: "140px", align: "center" as const },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, BPBDetailRow[]>>({});
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
        [nomor]: await bpbApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(e.response?.data?.message || `Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => {
  router.push({ name: "bpbCreate" });
};

const onEdit = (item: BPBRow) => {
  router.push({
    name: "bpbEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const onDelete = async (item: BPBRow) => {
  try {
    await bpbApi.delete(item.Nomor);
    toast.success("Berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus BPB.");
  }
};

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
</script>

<template>
  <BaseBrowse
    title="Barang Perolehan (BPB)"
    :icon="IconReceipt"
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
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.date_create="{ value }">
      <span>{{ fmtDateTime(value) }}</span>
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
              <th style="width: 100px" class="tr">Jumlah</th>
              <th style="width: 100px" class="tc">Expired</th>
              <th style="width: 120px" class="tc">Id Batch</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td class="tc">{{ d.Satuan }}</td>
              <td class="tr">{{ fmtQty(d.Jumlah) }}</td>
              <td class="tc">{{ fmtDate(d.Expired) }}</td>
              <td class="tc">{{ d.IdBatch || '-' }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="6" class="empty-td">Tidak ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; white-space: nowrap; }
.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.num-cell { font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
.detail-wrap { padding: 4px 0; }
.detail-loading { display: flex; align-items: center; gap: 8px; padding: 10px; font-size: 12px; color: #6b7280; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.detail-tbl thead tr { background: var(--ds-primary, #0284c7); }
.detail-tbl th { color: white; font-weight: 700; padding: 4px 8px; white-space: nowrap; text-align: left; }
.detail-tbl td { padding: 3px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.05); }
.empty-td { text-align: center; color: #9e9e9e; font-style: italic; padding: 12px; }
</style>
