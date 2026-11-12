<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import {
  settingJadwalSalesApi,
  type JadwalSalesRow,
} from "@/api/utility/settingJadwalSalesApi";
import { IconCalendarPlus, IconFileSpreadsheet, IconTrash } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";

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
  fetchData,
} = useBrowse<JadwalSalesRow>({
  fetchApi: () => settingJadwalSalesApi.getBrowse(),
  exportTitle: "Setting Jadwal Sales",
  columns: [
    { key: "jd_sls_kode", title: "Kode Salesman", width: 16 },
    { key: "salesman", title: "Salesman", width: 24 },
    { key: "jd_cus_kode", title: "Kode Customer", width: 16 },
    { key: "customer", title: "Customer", width: 28 },
    { key: "Nama", title: "Nama Jadwal", width: 22 },
  ],
});

const selectedItem = computed<JadwalSalesRow | null>(
  () => selected.value[0] ?? null
);
const isSingleSelected = computed(() => selected.value.length === 1);

const onAdd = () => router.push("/utility/setting-jadwal-sales/create");

// Delphi cxButton1Click: form edit dibuka pada baris terpilih. Data lama
// TIDAK dimuat (bug/perilaku Delphi); web memuat jadwal salesman tsb
// di FormView (keputusan gap doc §5.3).
const onEdit = (item: JadwalSalesRow) => {
  router.push(
    `/utility/setting-jadwal-sales/edit/${encodeURIComponent(item.jd_sls_kode)}`
  );
};

// Delphi cxButton4Click: cekdelete + konfirmasi, TAPI SQL-nya BUG —
// menghapus tCostCenter, bukan tjadwalsales. Web menghapus yang benar
// (semua jadwal milik salesman terpilih) — keputusan gap doc §5.4.
const showDeleteConfirm = ref(false);
useEscClose(showDeleteConfirm, () => (showDeleteConfirm.value = false));
const askDelete = () => {
  if (!selectedItem.value) return;
  showDeleteConfirm.value = true;
};

const runDelete = async () => {
  const item = selectedItem.value;
  if (!item) return;
  try {
    const hasil = await settingJadwalSalesApi.hapus(item.jd_sls_kode);
    toast.success(
      `Jadwal ${hasil.salesman} dihapus (${hasil.jmlHapus} baris).`
    );
    showDeleteConfirm.value = false;
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    showDeleteConfirm.value = false;
    toast.error(e.response?.data?.message || "Gagal hapus jadwal.");
  }
};
</script>

<template>
  <BaseBrowse
    title="Setting Jadwal Sales"
    :icon="IconCalendarPlus"
    :headers="[
      { key: 'jd_sls_kode', title: 'Kode Salesman', width: '160px' },
      { key: 'salesman', title: 'Salesman', width: '220px' },
      { key: 'jd_cus_kode', title: 'Kode Customer', width: '140px' },
      { key: 'customer', title: 'Customer', minWidth: '220px' },
      { key: 'Nama', title: 'Nama Jadwal', width: '180px' },
    ]"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :show-expand="false"
    item-value="jd_cus_kode"
    v-model:selected="selected"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="false"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #extra-actions>
      <v-btn
        size="small"
        class="tb-btn tb-btn-danger"
        :disabled="!isSingleSelected"
        @click="askDelete"
      >
        <template #prepend><IconTrash :size="13" :stroke-width="1.8" /></template>
        Hapus
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-success"
        data-fkey="export"
        :loading="isExporting"
        @click="handleExport()"
      >
        <template #prepend>
          <IconFileSpreadsheet :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>

  <ExportDialog
    v-model="showExportDialog"
    :has-detail="false"
    @export-header="exportHeaderOnly('SettingJadwalSales')"
  />

  <v-dialog v-model="showDeleteConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Hapus Jadwal Salesman</h3>
      <p class="confirm-text">
        Yakin ingin hapus <strong>semua jadwal</strong> salesman
        <strong>{{ selectedItem?.salesman || selectedItem?.jd_sls_kode }}</strong>?
        Semua baris jadwal milik salesman ini akan dihapus.
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showDeleteConfirm = false">
          Batal
        </v-btn>
        <v-btn size="small" class="tb-btn tb-btn-danger" @click="runDelete">
          Hapus
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.confirm-box {
  background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 2.5px solid var(--ds-primary, #D97706);
  border-radius: 0;
  padding: 16px;
}
.confirm-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
}
.confirm-text {
  margin: 0 0 16px;
  font-size: 12px;
  color: #374151;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
