<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import { IconGridDots } from "@tabler/icons-vue";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import { costCenterApi, type CostCenter } from "@/api/daftar/costCenterApi";
import { exportCostCenter } from "@/utils/exportExcel";

const toast = useToast();

const { items, isLoading, selected, canInsert, canEdit, canDelete, canExport, fetchData } = useBrowse<CostCenter>({ fetchApi: costCenterApi.getAll, immediate: true });

const headers = [
  { title: "Kode", key: "kode", width: "100px", align: "center" },
  { title: "Nama Cost Center", key: "nama", minWidth: "200px" },
];

const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);

const emptyForm = () => ({
  isEdit: false,
  kode: "",
  nama: "",
});
const form = ref(emptyForm());

const openCreate = () => {
  form.value = emptyForm();
  dialogTitle.value = "Tambah Cost Center";
  dialog.value = true;
};

const openEdit = async (item: CostCenter) => {
  try {
    const d = await costCenterApi.getById(item.kode);
    form.value = { isEdit: true, kode: d.kode, nama: d.nama };
    dialogTitle.value = "Ubah Cost Center";
    dialog.value = true;
  } catch (e: any) {
    toast.error(e.response?.data?.message ?? "Gagal memuat detail data.");
  }
};

const handleSave = async () => {
  if (!form.value.isEdit && !form.value.kode.trim()) {
    toast.warning("Kode cost center wajib diisi.");
    return;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama cost center wajib diisi.");
    return;
  }
  isSaving.value = true;
  try {
    await costCenterApi.save(form.value);
    toast.success("Berhasil disimpan.");
    dialog.value = false;
    await fetchData();
  } catch (e: any) {
    toast.error(e.response?.data?.message ?? "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async (item: CostCenter) => {
  try {
    await costCenterApi.delete(item.kode);
    toast.success("Berhasil dihapus.");
    await fetchData();
  } catch (e: any) {
    toast.error(e.response?.data?.message ?? "Gagal menghapus.");
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Cost Center"
    :icon="IconGridDots"
    :headers="headers"
    :items="items ?? []"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="Cari nama atau kode cost center..."
    @refresh="fetchData"
    @add="openCreate"
    @edit="openEdit"
    :export-fn="() => exportCostCenter(items ?? [], 'browse')"
    @delete="handleDelete"
  />

  <!-- ═══ MODAL ADD / EDIT ═══ -->
  <FormDialog
    v-model="dialog"
    :title="dialogTitle"
    :icon="IconGridDots"
    :saving="isSaving"
    @save="handleSave"
  >
    <div class="fd-row">
      <label class="fd-label">Kode Cost Center <span v-if="!form.isEdit" class="req">*</span></label>
      <input
        v-model="form.kode"
        class="fd-input"
        :disabled="form.isEdit"
        placeholder="Masukkan kode..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Nama Cost Center <span class="req">*</span></label>
      <input
        v-model="form.nama"
        class="fd-input"
        placeholder="Nama Cost Center"
      />
    </div>
  </FormDialog>
</template>
