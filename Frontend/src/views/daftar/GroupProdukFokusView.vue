<script setup lang="ts">
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  groupProdukFokusApi,
  type GroupProdukFokusRow,
} from "@/api/daftar/groupProdukFokusApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconStack2, IconFileSpreadsheet } from "@tabler/icons-vue";

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
} = useBrowse<GroupProdukFokusRow>({
  fetchApi: groupProdukFokusApi.getBrowse,
  immediate: true,
});

const headers = [
  { key: "Periode", title: "Periode", width: "100px" },
  { key: "Tahun", title: "Tahun", width: "100px", align: "center" as const },
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", minWidth: "200px" },
  { key: "Grup", title: "Grup", width: "100px" },
  { key: "Het", title: "HET", width: "120px", align: "right" as const },
  { key: "Dept", title: "Dept", width: "100px" },
  { key: "HNA", title: "HNA", width: "120px", align: "right" as const },
];

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <BaseBrowse
    title="Daftar Group Produk Fokus"
    :icon="IconStack2"
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
    :fixed-layout="false"
    search-placeholder="Cari group produk fokus..."
    @refresh="fetchData"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
    <template #item.Het="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
    <template #item.HNA="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.num-cell {
  font-variant-numeric: tabular-nums;
}
</style>