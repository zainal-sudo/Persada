<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { IconBuildingWarehouse } from "@tabler/icons-vue";
import BaseBrowse from "@/components/BaseBrowse.vue";
import FormDialog from "@/components/FormDialog.vue";
import { gudangApi, type GudangRow } from "@/api/persediaan/gudangApi";
import { gudangFormApi } from "@/api/persediaan/gudangFormApi";
import { useBrowse } from "@/composables/useBrowse";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";

const toast = useToast();

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canExport,
  fetchData,
} = useBrowse<GudangRow>({
  fetchApi: gudangApi.getBrowse,
  immediate: true,
});

const headers = [
  { title: "Kode", key: "Kode", width: "100px", align: "center" },
  { title: "Nama", key: "Nama", width: "200px" },
  { title: "Penanggungjawab", key: "Penanggungjawab", width: "200px" },
  { title: "Keterangan", key: "Keterangan", minWidth: "200px" },
];

// ── Modal State ──────────────────────────────────────────────────────
const dialog = ref(false);
const dialogTitle = ref("");
const isSaving = ref(false);

const emptyForm = () => ({
  isEdit: false,
  kode: "",
  nama: "",
  penanggungjawab: "",
  keterangan: "",
});
const form = ref(emptyForm());

const openCreate = async () => {
  form.value = emptyForm();
  try {
    form.value.kode = await gudangFormApi.getMaxKode();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate kode gudang.");
  }
  dialogTitle.value = "Tambah Gudang";
  dialog.value = true;
};

const openEdit = async (item: GudangRow) => {
  try {
    const d = await gudangFormApi.getDetailForm(item.Kode);
    form.value = {
      isEdit: true,
      kode: d.kode,
      nama: d.nama,
      penanggungjawab: d.penanggungjawab,
      keterangan: d.keterangan,
    };
    dialogTitle.value = "Ubah Gudang";
    dialog.value = true;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat detail data.");
  }
};

// ── Export ───────────────────────────────────────────────────────────
const headerCols: ExportColumn[] = [
  { key: "Kode", title: "Kode", width: 12, align: "center" },
  { key: "Nama", title: "Nama", width: 30 },
  { key: "Penanggungjawab", title: "Penanggungjawab", width: 25 },
  { key: "Keterangan", title: "Keterangan", width: 25 },
];

const doExport = () => {
  if (!items.value?.length) {
    toast.info("Tidak ada data untuk diexport.");
    return;
  }
  exportStyledHeader({
    title: "Daftar Gudang",
    columns: headerCols,
    items: items.value,
    fileName: `Gudang_${new Date().toISOString().slice(0, 10)}.xlsx`,
    subtitle: "Daftar Gudang",
  });
};

const handleSave = async () => {
  if (!form.value.nama.trim()) {
    toast.warning("Nama gudang wajib diisi.");
    return;
  }
  isSaving.value = true;
  try {
    await gudangFormApi.save(form.value);
    toast.success("Berhasil disimpan.");
    dialog.value = false;
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Gudang"
    :icon="IconBuildingWarehouse"
    :headers="headers"
    :items="items ?? []"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="false"
    :can-export="canExport"
    search-placeholder="Cari gudang..."
    @refresh="fetchData"
    @add="openCreate"
    @edit="openEdit"
    :export-fn="doExport"
  />

  <!-- ═══ MODAL ADD / EDIT ═══ -->
  <FormDialog
    v-model="dialog"
    :title="dialogTitle"
    :icon="IconBuildingWarehouse"
    :saving="isSaving"
    @save="handleSave"
  >
    <div class="fd-row">
      <label class="fd-label">Kode Gudang</label>
      <input :value="form.kode" class="fd-input" readonly placeholder="Otomatis..." />
    </div>
    <div class="fd-row">
      <label class="fd-label">Nama Gudang <span class="req">*</span></label>
      <input v-model="form.nama" class="fd-input" placeholder="Nama gudang..." />
    </div>
    <div class="fd-row">
      <label class="fd-label">Penanggung Jawab</label>
      <input
        v-model="form.penanggungjawab"
        class="fd-input"
        placeholder="Penanggung jawab..."
      />
    </div>
    <div class="fd-row">
      <label class="fd-label">Keterangan</label>
      <input v-model="form.keterangan" class="fd-input" placeholder="Keterangan..." />
    </div>
  </FormDialog>
</template>
