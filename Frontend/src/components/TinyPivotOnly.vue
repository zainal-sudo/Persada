<script setup lang="ts">
/**
 * Adapter pivot untuk view laporan.
 *
 * Nama dan API exposed dipertahankan (pivotResult/rowFields/columnFields/
 * valueFields) supaya 20 view laporan dan `usePivotExport` tidak perlu diubah.
 * Semua logika pivot (termasuk filter per field) kini ada di `DataPivot`.
 */
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import DataPivot from "@/components/pivot/DataPivot.vue";

const props = withDefaults(
  defineProps<{
    data: Record<string, unknown>[];
    theme?: "light" | "dark";
    fontSize?: "xs" | "sm" | "base";
    defaultRowFields?: string[];
    defaultColumnFields?: string[];
    defaultValueFields?: { field: string; aggregation: string }[];
  }>(),
  { theme: "light", fontSize: "sm" },
);

const route = useRoute();
const authStore = useAuthStore();
const viewKey = computed(() => route.path);
const dataPivotRef = ref<InstanceType<typeof DataPivot> | null>(null);

const pivotResult = computed(() => dataPivotRef.value?.pivotResult ?? null);
const rowFields = computed(() => dataPivotRef.value?.rowFields ?? []);
const columnFields = computed(() => dataPivotRef.value?.columnFields ?? []);
const valueFields = computed(() => dataPivotRef.value?.valueFields ?? []);

defineExpose({ pivotResult, rowFields, columnFields, valueFields });
</script>

<template>
  <div class="vpg-pivot-wrap">
    <DataPivot
      ref="dataPivotRef"
      :data="data"
      :theme="theme"
      :font-size="fontSize"
      :default-row-fields="defaultRowFields"
      :default-column-fields="defaultColumnFields"
      :default-value-fields="defaultValueFields"
      :view-key="viewKey"
      :user-kode="authStore.userKode"
    />
  </div>
</template>

<style scoped>
.vpg-pivot-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
</style>
