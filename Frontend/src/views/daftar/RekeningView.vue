<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { rekeningApi, type RekeningRow } from "@/api/daftar/rekeningApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconBuildingBank } from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();

// ── useBrowse (Permission + Data) ────────────────────────────────────
const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  fetchData,
} = useBrowse<RekeningRow>({
  fetchApi: rekeningApi.getBrowse,
  immediate: true,
});

const headers = [
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", width: "200px" },
  { key: "Kelompok", title: "Kelompok", width: "150px" },
  { key: "Status", title: "Status", width: "80px", align: "center" as const },
  { key: "Saldo_Akhir", title: "Saldo Akhir", width: "150px", align: "right" as const },
];

// ── Actions ──────────────────────────────────────────────────────────
const onAdd = () => {
  router.push({ name: "rekeningCreate" });
};

const onEdit = (item: RekeningRow) => {
  router.push({
    name: "rekeningEdit",
    params: { kode: encodeURIComponent(item.Kode) },
  });
};

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseBrowse
    title="Daftar Rekening"
    :icon="IconBuildingBank"
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
    summary-key="Saldo_Akhir"
    summary-label="Total Saldo"
    search-placeholder="Cari rekening..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <!-- Custom Cells -->
    <template #item.Status="{ value }">
      <span :class="value === 'Aktif' ? 'badge-active' : 'badge-inactive'">
        {{ value }}
      </span>
    </template>

    <template #item.Saldo_Akhir="{ value }">
      <span :style="{ color: value < 0 ? '#c62828' : 'inherit' }">
        {{ fmt(value) }}
      </span>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.badge-active {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
}

.badge-inactive {
  background: #ffebee;
  color: #c62828;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
}
</style>