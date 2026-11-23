<script setup lang="ts">
import { useRouter } from "vue-router";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { formasiApi, type FormasiRow } from "@/api/daftar/formasiApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconStack2, IconFileSpreadsheet } from "@tabler/icons-vue";

const router = useRouter();

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  handleExport,
  deleteData,
  fetchData,
} = useBrowse<FormasiRow>({
  fetchApi: () => formasiApi.getBrowse(),
  deleteApi: (id: string) => formasiApi.delete(Number(id)),
  immediate: true,
  exportTitle: "Formasi",
  columns: [
    { key: "Nama", title: "Nama Formasi", width: 24 },
    { key: "Divisi", title: "Divisi", width: 14 },
    { key: "Type", title: "Type", width: 10 },
    { key: "Salesman", title: "Salesman", width: 18 },
    { key: "Atasan", title: "Atasan", width: 18 },
    { key: "JumlahArea", title: "Jml Area", width: 10 },
    { key: "Area", title: "Area/Rayon", width: 40 },
  ],
});

const headers = [
  { key: "Nama", title: "Nama Formasi", minWidth: "220px" },
  { key: "Divisi", title: "Divisi", width: "120px" },
  { key: "Type", title: "Type", width: "80px" },
  { key: "Salesman", title: "Salesman", width: "150px" },
  { key: "Atasan", title: "Atasan", width: "150px" },
  { key: "JumlahArea", title: "Jml Area", width: "90px", align: "center" as const },
  { key: "Area", title: "Area/Rayon", minWidth: "260px" },
];

const onAdd = () => {
  router.push({ name: "formasiCreate" });
};

const onEdit = (item: FormasiRow) => {
  router.push({
    name: "formasiEdit",
    params: { id: String(item.id) },
  });
};
</script>

<template>
  <BaseBrowse
    title="Formasi"
    :icon="IconStack2"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="id"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    search-placeholder="formasi..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="deleteData(String($event.id))"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>
</template>
