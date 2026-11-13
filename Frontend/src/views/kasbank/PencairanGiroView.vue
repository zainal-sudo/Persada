<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import {
  pencairanGiroApi,
  type PencairanGiroRow,
} from "@/api/kasbank/pencairanGiroApi";
import { useBrowse } from "@/composables/useBrowse";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconCashBanknote, IconFileSpreadsheet } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

// ── Periode (sessionStorage persist) ─────────────────────────────────
const STORAGE_KEY = "kasbank_periode_pencairan_giro";

const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (s?.startDate && s?.endDate) return s;
  } catch {}
  return null;
};

const now = new Date();
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const saved = getSaved();

const startDate = ref(saved?.startDate ?? getLocal(firstDay));
const endDate = ref(saved?.endDate ?? getLocal(now));

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
} = useBrowse<PencairanGiroRow>({
  fetchApi: () => pencairanGiroApi.getBrowse(startDate.value, endDate.value),
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "100px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "GiroNumber", title: "Giro Number", width: "150px" },
  { key: "TglCair", title: "Tgl Cair", width: "100px", align: "center" as const },
  { key: "Nilai", title: "Nilai", width: "120px", align: "right" as const },
  { key: "Bank", title: "Bank", width: "200px" },
];

// ── Watch periode → fetch data ───────────────────────────────────────
watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startDate: s, endDate: e })
    );
  } catch {}
});

// ── Actions ──────────────────────────────────────────────────────────
const onAdd = () => {
  router.push({ name: "pencairanGiroCreate" });
};

const onEdit = (item: PencairanGiroRow) => {
  router.push({
    name: "pencairanGiroEdit",
    params: { nomor: encodeURIComponent(item.Nomor) },
  });
};

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch { return val; }
};

// ── Export ───────────────────────────────────────────────────────────
const exportCols: ExportColumn[] = [
  { key: "Nomor", title: "Nomor", width: 15 },
  { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
  { key: "GiroNumber", title: "Giro Number", width: 18 },
  { key: "TglCair", title: "Tgl Cair", width: 12, align: "center" },
  { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
  { key: "Bank", title: "Bank", width: 25 },
];

const doExport = () => {
  if (!items.value.length) { toast.info("Tidak ada data untuk diexport."); return; }
  const exportItems = items.value.map((r) => ({
    ...r,
    Tanggal: fmtDate(r.Tanggal as any),
    TglCair: fmtDate(r.TglCair as any),
  }));
  exportStyledHeader({
    title: "Pencairan Giro",
    columns: exportCols,
    items: exportItems,
    fileName: `PencairanGiro_${startDate.value}_${endDate.value}.xlsx`,
    subtitle: `Periode: ${startDate.value} s/d ${endDate.value}`,
  });
};
</script>

<template>
  <BaseBrowse
    title="Pencairan Giro"
    :icon="IconCashBanknote"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Nomor"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :fixed-layout="false"
    summary-key="Nilai"
    summary-label="Total Nilai"
    search-placeholder="Cari pencairan giro..."
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <!-- Filter Periode -->
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <!-- Custom Cells -->
    <template #item.Tanggal="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #item.TglCair="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>

    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport">
        <template #prepend>
          <IconFileSpreadsheet :size="14" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.Nilai="{ value }">
      <span class="num-cell">{{ fmt(value) }}</span>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-lbl {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.filter-sep {
  font-size: 12px;
  color: #9ca3af;
}

.date-inp {
  height: 32px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  width: 130px;
}

.date-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.num-cell {
  font-variant-numeric: tabular-nums;
}
</style>