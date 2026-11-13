<script setup lang="ts">
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  salesmanAktifApi,
  type SalesmanAktifRow,
} from "@/api/daftar/salesmanAktifApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconUserCheck, IconFileSpreadsheet } from "@tabler/icons-vue";

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
  handleExport,
  fetchData,
} = useBrowse<SalesmanAktifRow>({
  fetchApi: () => salesmanAktifApi.getBrowse(),
  deleteApi: (kode: string) => salesmanAktifApi.delete(kode),
  immediate: true,
  exportTitle: "Salesman",
  columns: [
    { key: "Kode", title: "Kode", width: 12 },
    { key: "Nama", title: "Nama", width: 24 },
    { key: "Aktif", title: "Aktif", width: 8 },
    { key: "TglMasuk", title: "Tgl Masuk", width: 12 },
    { key: "JumlahRayon", title: "Jml Rayon", width: 10 },
    { key: "Rayon", title: "Area/Rayon", width: 40 },
  ],
});

const headers = [
  { key: "Kode", title: "Kode", width: "110px" },
  { key: "Nama", title: "Nama", width: "200px" },
  { key: "Aktif", title: "Aktif", width: "70px" },
  { key: "TglMasuk", title: "Tgl Masuk", width: "110px", align: "center" as const },
  { key: "JumlahRayon", title: "Jml Rayon", width: "90px", align: "center" as const },
  { key: "Rayon", title: "Area/Rayon", minWidth: "240px" },
];

const onAdd = () => {
  router.push({ name: "salesmanAktifCreate" });
};

const onEdit = (item: SalesmanAktifRow) => {
  router.push({
    name: "salesmanAktifEdit",
    params: { kode: encodeURIComponent(item.Kode) },
  });
};

const onDelete = async (item: SalesmanAktifRow) => {
  try {
    await salesmanAktifApi.delete(item.Kode);
    toast.success("Berhasil dihapus.");
    fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus salesman.");
  }
};
</script>

<template>
  <BaseBrowse
    title="Salesman"
    :icon="IconUserCheck"
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
    search-placeholder="salesman..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>
</template>
