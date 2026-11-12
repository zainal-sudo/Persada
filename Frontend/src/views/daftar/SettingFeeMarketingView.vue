<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import {
  settingFeeMarketingApi,
  type SettingFeeMarketingRow,
  type SettingFeeMarketingDetailRow,
} from "@/api/daftar/settingFeeMarketingApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconCash, IconFileSpreadsheet } from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();

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
} = useBrowse<SettingFeeMarketingRow>({
  fetchApi: settingFeeMarketingApi.getBrowse,
  immediate: true,
  getDetailApi: (nomor: string) => settingFeeMarketingApi.getDetail(nomor),
  exportTitle: "Setting Fee Marketing",
  columns: [
    { key: "Nomor", title: "Nomor", width: 10 },
    { key: "Kode", title: "Kode", width: 10 },
    { key: "Customer", title: "Customer", width: 30 },
  ],
  detailColumns: [
    { key: "Nomor", title: "Nomor", width: 10 },
    { key: "Kode", title: "Kode", width: 10 },
    { key: "Nama", title: "Nama Barang", width: 30 },
    { key: "Kategori", title: "Kategori", width: 15 },
    { key: "Persen", title: "Persen", width: 10, numFmt: "#,##0.00" },
    { key: "Rupiah", title: "Rupiah", width: 14, numFmt: "#,##0" },
  ],
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "80px" },
  { key: "Kode", title: "Kode", width: "80px" },
  { key: "Customer", title: "Customer", width: "200px" },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, SettingFeeMarketingDetailRow[]>>({});
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
        [nomor]: await settingFeeMarketingApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => {
  router.push({ name: "settingFeeMarketingCreate" });
};

const onEdit = (item: SettingFeeMarketingRow) => {
  router.push({
    name: "settingFeeMarketingEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseBrowse
    title="Daftar Setting Fee Marketing"
    :icon="IconCash"
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
    :show-refresh="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    search-placeholder="Cari fee marketing..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
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
              <th style="width: 80px">Nomor</th>
              <th style="width: 80px">Kode</th>
              <th style="min-width: 200px">Nama Barang</th>
              <th style="width: 100px">Kategori</th>
              <th style="width: 80px" class="tr">Persen</th>
              <th style="width: 120px" class="tr">Rupiah</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td>{{ d.Nomor }}</td>
              <td class="mono">{{ d.Kode }}</td>
              <td class="bold">{{ d.Nama }}</td>
              <td>{{ d.Kategori }}</td>
              <td class="tr">{{ d.Persen }}%</td>
              <td class="tr">{{ fmt(d.Rupiah) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="6" class="empty-td">Tidak ada detail fee marketing.</td>
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
    @export-header="exportHeaderOnly('SettingFeeMarketing')"
    @export-detail="exportDetailOnly('SettingFeeMarketing')"
  />
</template>

<style scoped>
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }

.detail-wrap { padding: 4px 0; }
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
.detail-tbl thead tr { background: var(--ds-primary, #D97706); }
.detail-tbl th {
  color: white;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
  text-align: left;
}
.detail-tbl td {
  padding: 3px 8px;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
}
.detail-tbl tbody tr:hover td { background: rgba(59, 89, 152, 0.04); }
.empty-td {
  text-align: center;
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>