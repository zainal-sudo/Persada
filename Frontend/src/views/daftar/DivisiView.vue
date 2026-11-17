<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import {
  divisiApi,
  type DivisiRow,
} from "@/api/daftar/divisiApi";
import {
  divisiFormApi,
  type DivisiForm,
} from "@/api/daftar/divisiFormApi";
import { useBrowse } from "@/composables/useBrowse";
import { isAuthExpiredError } from "@/api/axios";
import {
  IconTruck,
  IconFileSpreadsheet,
} from "@tabler/icons-vue";

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
} = useBrowse<DivisiRow>({
  fetchApi: divisiApi.getBrowse,
  immediate: true,
  exportTitle: "Master Divisi",
});

const headers = [
  { key: "div_kode", title: "Kode", width: "100px" },
  { key: "div_nama", title: "Nama Divisi", width: "250px" },
  { key: "div_prefix", title: "Prefix", width: "100px" },
];

// ── Dialog State ───────────────────────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);
const formLoading = ref(false);

const emptyForm = (): DivisiForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  prefix: "",
});

const form = ref<DivisiForm>(emptyForm());

// ── Open Dialog ─────────────────────────────────────────────────────
const openCreate = () => {
  form.value = emptyForm();
  dialogTitle.value = "Tambah Divisi";
  dialog.value = true;
};

const openEdit = async (item: DivisiRow) => {
  formLoading.value = true;
  dialog.value = true;
  try {
    const data = await divisiFormApi.getDetailForm(
      encodeURIComponent(item.div_kode)
    );
    form.value = {
      ...emptyForm(),
      ...data,
      isEdit: true,
      kode: data.kode || item.div_kode,
    };
    dialogTitle.value = "Ubah Divisi";
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data divisi.");
    dialog.value = false;
  } finally {
    formLoading.value = false;
  }
};

// ── Validasi & Save ──────────────────────────────────────────────────
const handleSave = async () => {
  if (!form.value.kode.trim()) {
    toast.warning("Kode divisi harus diisi.");
    return;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama divisi harus diisi.");
    return;
  }

  isSaving.value = true;
  try {
    await divisiFormApi.save(form.value);
    dialog.value = false;
    toast.success("Data divisi berhasil disimpan.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data divisi.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    title="Master Divisi"
    :icon="IconTruck"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="div_kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="Cari divisi..."
    :auto-summary="false"
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

  <!-- ═══ MODAL ADD / EDIT ═══ -->
  <FormDialog
    v-model="dialog"
    :title="dialogTitle"
    :icon="IconTruck"
    :loading="formLoading"
    :saving="isSaving"
    @save="handleSave"
  >
    <div class="fd-row">
      <label class="fd-label">Kode Divisi <span class="req">*</span></label>
      <input
        v-model="form.kode"
        class="fd-input"
        maxlength="3"
        :readonly="form.isEdit"
        :class="{ readonly: form.isEdit }"
        placeholder="Cth: 01, MKT..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Nama Divisi <span class="req">*</span></label>
      <input
        v-model="form.nama"
        class="fd-input"
        maxlength="100"
        placeholder="Nama divisi..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Prefix</label>
      <input
        v-model="form.prefix"
        class="fd-input"
        maxlength="3"
        placeholder="Prefix (opsional)..."
      />
    </div>
  </FormDialog>
</template>
