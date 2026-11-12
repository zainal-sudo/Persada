<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  serahTerimaEkspedisiApi,
  type SerahTerimaEkspedisiRow,
  type SerahTerimaEkspedisiDetailRow,
} from "@/api/persediaan/serahTerimaEkspedisiApi";
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconTruckDelivery,
} from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();

const STORAGE_KEY = "finance_periode_serah_terima_ekspedisi";

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
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const saved = getSaved();

const startDate = ref(saved?.startDate ?? getLocal(firstDay));
const endDate = ref(saved?.endDate ?? getLocal(now));

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  showExportDialog,
  isExporting,
  handleExport,
  exportHeaderOnly,
  exportDetailOnly,
  fetchData,
} = useBrowse<SerahTerimaEkspedisiRow>({
  fetchApi: () =>
    serahTerimaEkspedisiApi.getBrowse(startDate.value, endDate.value),
  getDetailApi: (nomor: string) => serahTerimaEkspedisiApi.getDetail(nomor),
  exportTitle: "Serah Terima Ekspedisi",
  columns: [
    { key: "Nomor", title: "Nomor", width: 20 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Serah", title: "Serah", width: 14 },
    { key: "NamaEkspedisi", title: "Nama Ekspedisi", width: 25 },
    { key: "Tipe", title: "Tipe", width: 10, align: "center" },
    { key: "Realisasi", title: "Realisasi", width: 12, align: "center" },
    { key: "Note", title: "Note", width: 25 },
  ],
  detailColumns: [
    { key: "NomorFP", title: "NomorFP", width: 20 },
    { key: "Customer", title: "Customer", width: 30 },
    { key: "TanggalFP", title: "TanggalFP", width: 14, align: "center" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Berat", title: "Berat", width: 12, numFmt: "#,##0.00" },
    { key: "Kubikasi", title: "Kubikasi", width: 12, numFmt: "#,##0.00" },
    { key: "Biaya", title: "Biaya", width: 16, numFmt: "#,##0" },
  ],
});

const isSingleSelected = computed(() => selected.value.length === 1);
const selectedItem = computed<SerahTerimaEkspedisiRow | null>(
  () => selected.value[0] ?? null
);

watch([startDate, endDate], ([s, e]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate: s, endDate: e }));
  } catch {
    /* storage penuh */
  }
});

const headers = [
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Serah", title: "Serah", width: "100px" },
  { key: "NamaEkspedisi", title: "Nama Ekspedisi", minWidth: "180px" },
  { key: "Tipe", title: "Tipe", width: "80px", align: "center" as const },
  { key: "Realisasi", title: "Realisasi", width: "90px", align: "center" as const },
  { key: "Note", title: "Note", minWidth: "160px" },
];

// ── Expand detail ────────────────────────────────────────────────────
const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, SerahTerimaEkspedisiDetailRow[]>>({});
const expandedLoading = ref<Record<string, boolean>>({});

const onUpdateExpanded = async (newExpanded: any[]) => {
  const keys = newExpanded.map((e) => (typeof e === "object" ? e.Nomor : e));
  expanded.value = newExpanded;

  for (const nomor of keys) {
    if (detailMap.value[nomor] || expandedLoading.value[nomor]) continue;
    expandedLoading.value = { ...expandedLoading.value, [nomor]: true };
    try {
      detailMap.value = {
        ...detailMap.value,
        [nomor]: await serahTerimaEkspedisiApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

// Delphi cxButton2Click: form baru, nomor sudah diisi getmaxkode.
const onAdd = () => router.push("/persediaan/serah-terima-ekspedisi/create");

// Delphi cxButton1Click: blok edit bila sudah dicetak dan user bukan
// FINANCE/PIUTANG. Pemeriksaan yang sama ditegakkan ulang di BE saat hapus.
const terkunci = (item: SerahTerimaEkspedisiRow) => item.Realisasi === "Sudah";

const onEdit = (item: SerahTerimaEkspedisiRow) => {
  if (terkunci(item)) {
    toast.warning("Transaksi ini sudah dicetak, tidak dapat di edit.");
    return;
  }
  router.push(
    `/persediaan/serah-terima-ekspedisi/edit/${encodeURIComponent(item.Nomor)}`
  );
};

const onDelete = async (item: SerahTerimaEkspedisiRow) => {
  try {
    await serahTerimaEkspedisiApi.delete(item.Nomor);
    toast.success("Serah terima ekspedisi berhasil dihapus.");
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  }
};

// Delphi cxButton3Click: MUTASI → slip STE2 (rincian barang), selain itu
// slip STE (per faktur). BE memilih mode dari ste_tipe, jadi FE cukup
// mengirim nomor tanpa parameter mode.
const onCetak = () => {
  const item = selectedItem.value;
  if (!item) return;
  router.push(
    `/persediaan/serah-terima-ekspedisi/print/${encodeURIComponent(item.Nomor)}`
  );
};

const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${d}-${m}-${y}`;
};
</script>

<template>
  <BaseBrowse
    title="Serah Terima Ekspedisi"
    :icon="IconTruckDelivery"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    :show-expand="true"
    :expanded="expanded"
    @update:expanded="onUpdateExpanded"
    item-value="Nomor"
    v-model:selected="selected"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
    @delete="onDelete"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        class="tb-btn tb-btn-neutral"
        :disabled="!isSingleSelected"
        @click="onCetak"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
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

    <template #item.Tanggal="{ value }">{{ fmtDate(value) }}</template>

    <template #item.Realisasi="{ value }">
      <span :class="value === 'Sudah' ? 'tag tag-done' : 'tag tag-open'">
        {{ value }}
      </span>
    </template>

    <template #detail="{ item }">
      <div class="detail-wrap">
        <div v-if="expandedLoading[item.Nomor]" class="detail-loading">
          <v-progress-circular indeterminate color="primary" size="18" />
          <span>Memuat rincian...</span>
        </div>
        <table v-else class="detail-tbl">
          <thead>
            <tr>
              <th style="width: 150px">Nomor</th>
              <th style="min-width: 170px">Customer</th>
              <th style="width: 100px" class="tc">Tanggal FP</th>
              <th style="width: 120px" class="tr">Nilai</th>
              <th style="width: 90px" class="tr">Berat</th>
              <th style="width: 90px" class="tr">Kubikasi</th>
              <th style="width: 120px" class="tr">Biaya</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.NomorFP }}</td>
              <td>{{ d.Customer }}</td>
              <td class="tc">{{ fmtDate(d.TanggalFP) }}</td>
              <td class="tr bold accent">{{ fmt(d.Nilai) }}</td>
              <td class="tr">{{ fmt(d.Berat) }}</td>
              <td class="tr">{{ fmt(d.Kubikasi) }}</td>
              <td class="tr">{{ fmt(d.Biaya) }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="7" class="empty-td">Tidak ada detail.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('SerahTerimaEkspedisi')"
    @export-detail="exportDetailOnly('SerahTerimaEkspedisi')"
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
  border-color: var(--ds-primary, #D97706);
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.12);
}

.tc {
  text-align: center;
}
.tr {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mono {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 10px;
}
.bold {
  font-weight: 700;
}
.accent {
  color: var(--ds-primary, #D97706);
}

/* Status realisasi: warna membawa makna, bukan hiasan */
.tag {
  display: inline-block;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid transparent;
}
.tag-done {
  color: #065f46;
  background: #d1fae5;
  border-color: #6ee7b7;
}
.tag-open {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}

.detail-wrap {
  padding: 4px 0;
}
.detail-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  font-size: 12px;
  color: #6b7280;
}
.detail-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.detail-tbl thead tr {
  background: var(--ds-primary, #D97706);
}
.detail-tbl th {
  color: white;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
  text-align: left;
}
.detail-tbl td {
  padding: 3px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  white-space: nowrap;
}
.detail-tbl tbody tr:hover td {
  background: rgba(59, 89, 152, 0.05);
}
.empty-td {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-style: italic;
  padding: 12px;
}
</style>
