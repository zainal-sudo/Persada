<script setup lang="ts">
import { ref, watch } from "vue";
import { useToast } from "vue-toastification";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import { isAuthExpiredError } from "@/api/axios";
import { subBarangApi, type SubBarangRow } from "@/api/persediaan/subBarangApi";
import { subBarangFormApi } from "@/api/persediaan/subBarangFormApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconCategory, IconFileSpreadsheet } from "@tabler/icons-vue";

const toast = useToast();

// ── Export ───────────────────────────────────────────────────────────
const exportCols: ExportColumn[] = [
  { key: "Kode", title: "Kode", width: 20 },
  { key: "Nama", title: "Nama", width: 40 },
];

const doExport = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  exportStyledHeader({
    title: `Daftar Sub Barang - Tingkat ${selectedTingkat.value + 1}`,
    columns: exportCols,
    items: items.value,
    fileName: `SubBarang_T${selectedTingkat.value + 1}.xlsx`,
    subtitle: `Tingkat ${selectedTingkat.value + 1}`,
  });
};

// Paritas Delphi: hanya 3 tingkat (Departemen / Sub Kategori / Kategori).
const tingkatOptions = [
  { index: 0, label: "Departemen" },   // Tingkat 1
  { index: 1, label: "Sub Kategori" }, // Tingkat 2
  { index: 2, label: "Kategori" },     // Tingkat 3
];
// Default Delphi: ComboBox ItemIndex=2 → Tingkat 3.
const selectedTingkat = ref(2);

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  fetchData,
} = useBrowse<SubBarangRow>({
  fetchApi: () => subBarangApi.getBrowse(selectedTingkat.value + 1),
  immediate: true,
});

// Paritas Delphi ComboBox1Change → refresh.
watch(selectedTingkat, () => {
  fetchData();
});

const headers = [
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", width: "200px" },
];

// ── Modal Add/Edit (pola Cost Center) ────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);

interface SbForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  tingkat: number;
  parentKode: string;
}
const emptyForm = (): SbForm => ({ isEdit: false, kode: "", nama: "", tingkat: 1, parentKode: "" });
const form = ref<SbForm>(emptyForm());
const parentOptions = ref<{ kode: string; nama: string }[]>([]);

const genKode = async () => {
  try {
    form.value.kode = await subBarangFormApi.getMaxKode(form.value.tingkat, form.value.parentKode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate kode.");
  }
};

const openCreate = async () => {
  form.value = emptyForm();
  form.value.tingkat = selectedTingkat.value + 1;
  parentOptions.value = [];
  dialogTitle.value = `Tambah Sub Barang — ${tingkatOptions[selectedTingkat.value].label}`;
  if (form.value.tingkat > 1) {
    try {
      parentOptions.value = await subBarangFormApi.getParent(form.value.tingkat - 1);
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal memuat parent.");
    }
  } else {
    await genKode();
  }
  dialog.value = true;
};

const openEdit = async (item: SubBarangRow) => {
  try {
    const d = await subBarangFormApi.getDetailForm(item.Kode);
    form.value = {
      isEdit: true,
      kode: d.kode,
      nama: d.nama,
      tingkat: Number(d.tingkat) || selectedTingkat.value + 1,
      parentKode: d.parentKode || "",
    };
    if (form.value.tingkat > 1) {
      parentOptions.value = await subBarangFormApi.getParent(form.value.tingkat - 1);
    }
    dialogTitle.value = "Ubah Sub Barang";
    dialog.value = true;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data sub barang.");
  }
};

// Pilih parent (create) → generate kode.
watch(
  () => form.value.parentKode,
  async (val) => {
    if (!form.value.isEdit && val) await genKode();
  }
);

const validate = (): boolean => {
  if (form.value.tingkat > 1 && !form.value.parentKode) {
    toast.warning("Parent (Sub Kode) belum dipilih.");
    return false;
  }
  if (!form.value.kode) {
    toast.warning("Kode belum tergenerate.");
    return false;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama harus diisi.");
    return false;
  }
  return true;
};

const handleSave = async () => {
  if (isSaving.value) return;
  if (!validate()) return;
  isSaving.value = true;
  try {
    await subBarangFormApi.save(form.value);
    toast.success("Berhasil disimpan.");
    dialog.value = false;
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async (item: SubBarangRow) => {
  try {
    await subBarangApi.delete(item.Kode);
    toast.success("Berhasil dihapus.");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus.");
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Sub Barang"
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
    search-placeholder="Cari sub barang..."
    @refresh="fetchData"
    @add="openCreate"
    @edit="openEdit"
    @delete="handleDelete"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Tingkat</span>
        <select v-model="selectedTingkat" class="tingkat-select">
          <option v-for="opt in tingkatOptions" :key="opt.index" :value="opt.index">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </template>

    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport">
        <template #prepend>
          <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>

  <!-- ═══ MODAL ADD / EDIT ═══ -->
  <FormDialog
    v-model="dialog"
    :title="dialogTitle"
    :icon="IconCategory"
    :saving="isSaving"
    @save="handleSave"
  >
    <!-- Parent / Sub Kode: hanya tingkat > 1 -->
    <div v-if="form.tingkat > 1" class="fd-row">
      <label class="fd-label">Sub Kode <span class="req">*</span></label>
      <select v-model="form.parentKode" class="fd-input" :disabled="form.isEdit">
        <option value="" disabled>-- Pilih Parent --</option>
        <option v-for="p in parentOptions" :key="p.kode" :value="p.kode">
          {{ p.kode }} - {{ p.nama }}
        </option>
      </select>
    </div>

    <div class="fd-row">
      <label class="fd-label">Kode</label>
      <input :value="form.kode" class="fd-input" readonly placeholder="Auto..." />
    </div>

    <div class="fd-row">
      <label class="fd-label">Nama <span class="req">*</span></label>
      <input
        v-model="form.nama"
        class="fd-input"
        maxlength="30"
        placeholder="Nama sub barang..."
        @keyup.enter="handleSave"
      />
    </div>
  </FormDialog>
</template>
