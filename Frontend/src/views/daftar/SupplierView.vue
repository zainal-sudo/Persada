<script setup lang="ts">
import { useRouter } from "vue-router";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { supplierApi, type SupplierRow } from "@/api/daftar/supplierApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconTruck, IconFileSpreadsheet } from "@tabler/icons-vue";

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
  fetchData,
} = useBrowse<SupplierRow>({
  fetchApi: () => supplierApi.getBrowse(),
  immediate: true,
  exportTitle: "Supplier",
});

const headers = [
  { key: "Kode", title: "Kode", width: "120px" },
  { key: "Nama", title: "Nama", width: "250px" },
  { key: "Alamat", title: "Alamat", minWidth: "220px" },
  { key: "Kota", title: "Kota", width: "120px" },
  { key: "Telp", title: "Telp", width: "120px" },
];

const onAdd = () => {
  router.push({ name: "supplierCreate" });
};

const onEdit = (item: SupplierRow) => {
  router.push({
    name: "supplierEdit",
    params: { kode: encodeURIComponent(item.Kode) },
  });
};
</script>

<template>
  <BaseBrowse
    title="Daftar Supplier"
    :icon="IconTruck"
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
    search-placeholder="Cari supplier..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
  </BaseBrowse>
</template>
