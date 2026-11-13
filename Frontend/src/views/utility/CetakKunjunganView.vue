<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import DsDatePicker from "@/components/DsDatePicker.vue";
import DsSelect from "@/components/DsSelect.vue";
import {
  cetakKunjunganApi,
  type KunjunganRow,
  type KunjunganSalesman,
} from "@/api/utility/cetakKunjunganApi";
import {
  IconMapPin,
  IconFileSpreadsheet,
  IconPrinter,
} from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_cetak_kunjungan";

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
  } catch {
    /* storage tidak tersedia */
  }
  return null;
};

const now = new Date();
const saved = getSaved();
const startDate = ref(saved?.startDate ?? getLocal(now));
const endDate = ref(saved?.endDate ?? getLocal(now));
const salesman = ref("");

const salesmanList = ref<KunjunganSalesman[]>([]);
const loadSalesman = async () => {
  try {
    salesmanList.value = await cetakKunjunganApi.getSalesman();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat daftar salesman.");
  }
};
loadSalesman();

const salesmanNames = computed(() => salesmanList.value.map((s) => s.nama));

const {
  items,
  isLoading,
  canExport,
  showExportDialog,
  isExporting,
  handleExport,
  exportHeaderOnly,
  fetchData,
} = useBrowse<KunjunganRow>({
  fetchApi: () =>
    cetakKunjunganApi.getKunjungan(
      startDate.value,
      endDate.value,
      salesman.value
    ),
  exportTitle: "Cetak Kunjungan",
  columns: [
    { key: "cus_kode", title: "Kode", width: 12 },
    { key: "cus_nama", title: "Nama", width: 32 },
    { key: "tanggal", title: "Tanggal", width: 14 },
    { key: "jam", title: "Jam", width: 10 },
    { key: "hari", title: "Hari", width: 10 },
    { key: "koordinat", title: "Koordinat", width: 12 },
    { key: "jarak", title: "Jarak (km)", width: 12, numFmt: "#,##0.00" },
  ],
});

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startDate: s, endDate: e })
    );
  } catch {
    /* storage penuh */
  }
});

const headers = [
  { key: "cus_kode", title: "Kode", width: "110px" },
  { key: "cus_nama", title: "Nama", minWidth: "220px" },
  { key: "tanggal", title: "Tanggal", width: "110px", align: "center" as const },
  { key: "jam", title: "Jam", width: "90px", align: "center" as const },
  { key: "hari", title: "Hari", width: "90px" },
  { key: "koordinat", title: "Koordinat", width: "110px", align: "center" as const },
  { key: "jarak", title: "Jarak (km)", width: "110px", align: "right" as const },
];

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${d}-${m}-${y}`;
};

const fmtJarak = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

// Cetak mengikuti grid: ambil baris yang lolos filter kolom + search dari
// BaseBrowse (filteredItems), bukan items mentah. Snapshot dikirim ke halaman
// cetak lewat sessionStorage (cetakKunjunganPrintPayload), pola sama dengan FOS.
const browseRef = ref<any>(null);
const cetak = () => {
  const rows = browseRef.value?.filteredItems ?? items.value;
  try {
    sessionStorage.setItem(
      "cetakKunjunganPrintPayload",
      JSON.stringify({
        startDate: startDate.value,
        endDate: endDate.value,
        salesman: salesman.value,
        rows,
      })
    );
  } catch {
    /* storage penuh */
  }
  router.push({
    path: "/utility/cetak-kunjungan/print",
    query: {
      startDate: startDate.value,
      endDate: endDate.value,
      salesman: salesman.value,
    },
  });
};
</script>

<template>
  <BaseBrowse
    ref="browseRef"
    title="Cetak Kunjungan"
    :icon="IconMapPin"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :auto-refresh="false"
    item-value="cus_kode"
    :can-insert="false"
    :can-edit="false"
    :can-delete="false"
    :can-export="canExport"
    @refresh="fetchData"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
        <span class="filter-sep" style="margin-left: 10px" />
        <span class="filter-lbl">Salesman</span>
        <DsSelect
          v-model="salesman"
          variant="toolbar"
          class="sls-sel"
          placeholder="(Semua)"
          :options="salesmanNames"
        />
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        class="tb-btn tb-btn-neutral"
        :disabled="!items.length"
        @click="cetak"
      >
        <template #prepend><IconPrinter :size="13" :stroke-width="1.8" /></template>
        Cetak
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-success"
        data-fkey="export"
        :loading="isExporting"
        @click="handleExport()"
      >
        <template #prepend>
          <IconFileSpreadsheet :size="13" :stroke-width="1.8" />
        </template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>

    <template #item.tanggal="{ value }">{{ fmtDate(value) }}</template>
    <template #item.koordinat="{ value }">
      <span :class="value === 'Ada' ? 'tag tag-ada' : 'tag tag-kosong'">
        {{ value }}
      </span>
    </template>
    <template #item.jarak="{ value }">{{ fmtJarak(value) }}</template>

    <template #summary-row="{ filteredItems }">
      <span class="summary-lbl">Total Record</span>
      <span class="summary-val">{{ filteredItems.length }}</span>
    </template>
  </BaseBrowse>

  <ExportDialog
    v-model="showExportDialog"
    :has-detail="false"
    @export-header="exportHeaderOnly('CetakKunjungan')"
  />
</template>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
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
  white-space: nowrap;
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
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.12);
}
.sls-sel {
  min-width: 180px;
}
/* Label koordinat membawa makna data GPS, bukan hiasan */
.tag {
  display: inline-block;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid transparent;
}
.tag-ada {
  color: #065f46;
  background: #d1fae5;
  border-color: #6ee7b7;
}
.tag-kosong {
  color: #075985;
  background: #e0f2fe;
  border-color: #fcd34d;
}
.summary-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-text-secondary, #5A6A7E);
}
.summary-val {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
