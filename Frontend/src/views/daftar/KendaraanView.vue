<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import {
  kendaraanApi,
  type KendaraanRow,
} from "@/api/daftar/kendaraanApi";
import {
  kendaraanFormApi,
  type KendaraanForm,
} from "@/api/daftar/kendaraanFormApi";
import { useBrowse } from "@/composables/useBrowse";
import { isAuthExpiredError } from "@/api/axios";
import {
  IconCar,
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
} = useBrowse<KendaraanRow>({
  fetchApi: kendaraanApi.getBrowse,
  immediate: true,
});

const headers = [
  { key: "kend_nopol", title: "No. Polisi", width: "100px" },
  { key: "kend_merk", title: "Merk", width: "200px" },
  { key: "kend_tipe", title: "Tipe", width: "150px" },
  { key: "kend_bagian", title: "Bagian", width: "150px" },
  { key: "kend_pic", title: "PIC", width: "150px" },
  { key: "kend_cabang", title: "Cabang", width: "80px", align: "center" as const },
];

// ── Dialog State ───────────────────────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);
const formLoading = ref(false);

const emptyForm = (): KendaraanForm => ({
  isEdit: false,
  nopol: "",
  merk: "",
  tipe: "",
  bagian: "",
  pic: "",
  cabang: "",
});

const form = ref<KendaraanForm>(emptyForm());

// ── Open Dialog ─────────────────────────────────────────────────────
const openCreate = () => {
  form.value = emptyForm();
  dialogTitle.value = "Tambah Kendaraan";
  dialog.value = true;
};

const openEdit = async (item: KendaraanRow) => {
  formLoading.value = true;
  dialog.value = true;
  try {
    const data = await kendaraanFormApi.getDetailForm(
      encodeURIComponent(item.kend_nopol)
    );
    form.value = {
      ...emptyForm(),
      ...data,
      isEdit: true,
      nopol: data.nopol || item.kend_nopol,
    };
    dialogTitle.value = "Ubah Kendaraan";
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data kendaraan.");
    dialog.value = false;
  } finally {
    formLoading.value = false;
  }
};

// ── NOPOL Blur (auto-detect existing) ────────────────────────────────
const onNopolBlur = async () => {
  if (!form.value.nopol.trim() || form.value.isEdit) return;

  try {
    const data = await kendaraanFormApi.getDetailForm(
      form.value.nopol.trim()
    );
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nopol: data.nopol,
    };
    dialogTitle.value = "Ubah Kendaraan";
    toast.info(`Data kendaraan "${data.nopol}" ditemukan. Mode edit.`);
  } catch {
    form.value.isEdit = false;
  }
};

// ── Validasi & Save ──────────────────────────────────────────────────
const handleSave = async () => {
  if (!form.value.nopol.trim()) {
    toast.warning("NOPOL harus diisi.");
    return;
  }
  if (!form.value.merk.trim()) {
    toast.warning("Merk harus diisi.");
    return;
  }

  isSaving.value = true;
  try {
    await kendaraanFormApi.save({
      ...form.value,
      isEdit: form.value.isEdit,
    });
    dialog.value = false;
    toast.success("Data kendaraan berhasil disimpan.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data kendaraan.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Kendaraan"
    :icon="IconCar"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="kend_nopol"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="Cari kendaraan..."
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
    :icon="IconCar"
    :loading="formLoading"
    :saving="isSaving"
    @save="handleSave"
  >
    <div class="fd-row">
      <label class="fd-label">NOPOL <span class="req">*</span></label>
      <input
        v-model="form.nopol"
        class="fd-input"
        maxlength="30"
        placeholder="Nomor polisi..."
        :disabled="form.isEdit"
        @blur="onNopolBlur"
        @keydown.enter="onNopolBlur"
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Merk <span class="req">*</span></label>
      <input
        v-model="form.merk"
        class="fd-input"
        maxlength="30"
        placeholder="Merk kendaraan..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Tipe</label>
      <input
        v-model="form.tipe"
        class="fd-input"
        maxlength="30"
        placeholder="Tipe kendaraan..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Bagian</label>
      <input
        v-model="form.bagian"
        class="fd-input"
        maxlength="30"
        placeholder="Bagian..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">PIC</label>
      <input v-model="form.pic" class="fd-input" maxlength="30" placeholder="PIC..." />
    </div>
    <div class="fd-row">
      <label class="fd-label">Cabang</label>
      <input
        v-model="form.cabang"
        class="fd-input"
        maxlength="30"
        placeholder="Cabang..."
      />
    </div>
  </FormDialog>
</template>
