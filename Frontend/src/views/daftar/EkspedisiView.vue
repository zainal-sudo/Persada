<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import {
  ekspedisiApi,
  type EkspedisiRow,
} from "@/api/daftar/ekspedisiApi";
import {
  ekspedisiFormApi,
  type EkspedisiForm,
} from "@/api/daftar/ekspedisiFormApi";
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
} = useBrowse<EkspedisiRow>({
  fetchApi: ekspedisiApi.getBrowse,
  immediate: true,
});

const headers = [
  { key: "ekspedisi_id", title: "ID", width: "100px" },
  { key: "ekspedisi_nama", title: "Nama Ekspedisi", width: "200px" },
];

// ── Dialog State ───────────────────────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);
const formLoading = ref(false);

const emptyForm = (): EkspedisiForm => ({
  isEdit: false,
  id: "",
  nama: "",
});

const form = ref<EkspedisiForm>(emptyForm());

// ── Open Dialog ─────────────────────────────────────────────────────
const openCreate = () => {
  form.value = emptyForm();
  dialogTitle.value = "Tambah Ekspedisi";
  dialog.value = true;
};

const openEdit = async (item: EkspedisiRow) => {
  formLoading.value = true;
  dialog.value = true;
  try {
    const data = await ekspedisiFormApi.getDetailForm(
      encodeURIComponent(item.ekspedisi_id)
    );
    form.value = {
      ...emptyForm(),
      ...data,
      isEdit: true,
      id: data.id || item.ekspedisi_id,
    };
    dialogTitle.value = "Ubah Ekspedisi";
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data ekspedisi.");
    dialog.value = false;
  } finally {
    formLoading.value = false;
  }
};

// ── Validasi & Save ──────────────────────────────────────────────────
const handleSave = async () => {
  if (!form.value.nama.trim()) {
    toast.warning("Nama ekspedisi harus diisi.");
    return;
  }

  isSaving.value = true;
  try {
    await ekspedisiFormApi.save(form.value);
    dialog.value = false;
    toast.success("Data ekspedisi berhasil disimpan.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data ekspedisi.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Ekspedisi"
    :icon="IconTruck"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="ekspedisi_id"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="Cari ekspedisi..."
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
      <label class="fd-label">Id Ekspedisi</label>
      <input :value="form.id || 'Otomatis...'" class="fd-input" readonly />
    </div>
    <div class="fd-row">
      <label class="fd-label">Nama <span class="req">*</span></label>
      <input
        v-model="form.nama"
        class="fd-input"
        maxlength="30"
        placeholder="Nama ekspedisi..."
      />
    </div>
  </FormDialog>
</template>
