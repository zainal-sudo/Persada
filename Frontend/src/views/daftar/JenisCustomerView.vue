<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import { jenisCustomerApi, type JenisCustomerRow } from "@/api/daftar/jenisCustomerApi";
import {
  jenisCustomerFormApi,
  type JenisCustomerForm,
} from "@/api/daftar/jenisCustomerFormApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconCategory, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  handleExport,
  fetchData,
} = useBrowse<JenisCustomerRow>({
  fetchApi: jenisCustomerApi.getBrowse,
  immediate: true,
});

const headers = [
  { key: "Kode", title: "Kode", width: "100px", align: "center" as const },
  { key: "Nama", title: "Nama", width: "200px" },
];

// ── Dialog State ───────────────────────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);
const isLoadingForm = ref(false);

const emptyForm = (): JenisCustomerForm => ({
  isEdit: false,
  kode: "",
  nama: "",
});

const form = ref<JenisCustomerForm>(emptyForm());

const openCreate = async () => {
  form.value = emptyForm();
  isLoadingForm.value = true;
  dialog.value = true;
  try {
    form.value.kode = await jenisCustomerFormApi.getMaxKode();
  } catch (e: any) {
    toast.error("Gagal generate kode jenis customer.");
  } finally {
    isLoadingForm.value = false;
  }
  dialogTitle.value = "Tambah Jenis Customer";
};

const openEdit = async (item: JenisCustomerRow) => {
  isLoadingForm.value = true;
  dialog.value = true;
  dialogTitle.value = "Ubah Jenis Customer";
  try {
    const data = await jenisCustomerFormApi.getDetailForm(String(item.Kode));
    form.value = {
      isEdit: true,
      kode: data.kode || String(item.Kode),
      nama: data.nama,
    };
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal memuat detail data.");
    dialog.value = false;
  } finally {
    isLoadingForm.value = false;
  }
};

const handleSave = async () => {
  if (!form.value.nama.trim()) {
    toast.warning("Nama harus diisi.");
    return;
  }
  isSaving.value = true;
  try {
    await jenisCustomerFormApi.save(form.value);
    toast.success("Data jenis customer berhasil disimpan.");
    dialog.value = false;
    await fetchData();
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Jenis Customer"
    :icon="IconCategory"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="Cari jenis customer..."
    @refresh="fetchData"
    @add="openCreate"
    @edit="openEdit"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>

  <FormDialog
    v-model="dialog"
    :title="dialogTitle"
    :icon="IconCategory"
    :loading="isLoadingForm"
    :saving="isSaving"
    @save="handleSave"
  >
    <div class="fd-row">
      <label class="fd-label">Kode</label>
      <input :value="form.kode || 'Otomatis...'" class="fd-input" readonly />
    </div>
    <div class="fd-row">
      <label class="fd-label">Nama <span class="req">*</span></label>
      <input
        v-model="form.nama"
        class="fd-input"
        maxlength="30"
        placeholder="Nama jenis customer..."
      />
    </div>
  </FormDialog>
</template>
