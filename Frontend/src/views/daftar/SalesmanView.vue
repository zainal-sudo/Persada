<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { salesmanApi, type SalesmanRow } from "@/api/daftar/salesmanApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconUsers, IconFileSpreadsheet } from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

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
} = useBrowse<SalesmanRow>({
  fetchApi: () => salesmanApi.getBrowse(authStore.userCabang),
  immediate: true,
  exportTitle: "Salesman",
});

const headers = [
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", width: "200px" },
  { key: "Alamat", title: "Alamat", minWidth: "200px" },
  { key: "Kota", title: "Kota", width: "100px" },
  { key: "Telp", title: "Telp", width: "100px" },
  { key: "TglMasuk", title: "Tgl Masuk", width: "100px", align: "center" as const },
];

const onAdd = () => {
  router.push({ name: "salesmanCreate" });
};

const onEdit = (item: SalesmanRow) => {
  router.push({
    name: "salesmanEdit",
    params: { kode: encodeURIComponent(item.Kode) },
  });
};

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return ;
  } catch { return val; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Salesman"
    :icon="IconUsers"
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
    search-placeholder="Cari salesman..."
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
    <template #item.TglMasuk="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>
  </BaseBrowse>
</template>