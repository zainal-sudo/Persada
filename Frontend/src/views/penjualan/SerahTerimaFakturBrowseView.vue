<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import ExportDialog from "@/components/ExportDialog.vue";
import { useBrowse } from "@/composables/useBrowse";
import {
  serahTerimaFakturApi,
  type SerahTerimaFakturRow,
  type SerahTerimaFakturDetailRow,
} from "@/api/penjualan/serahTerimaFakturApi";
import { useAuthStore } from "@/stores/authStore";
import { useEscClose } from "@/composables/useEscClose";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  IconFileCheck,
  IconFileSpreadsheet,
  IconPrinter,
  IconCheck,
} from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const STORAGE_KEY = "finance_periode_serah_terima_faktur";

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
  canExport,
  showExportDialog,
  isExporting,
  handleExport,
  exportHeaderOnly,
  exportDetailOnly,
  fetchData,
} = useBrowse<SerahTerimaFakturRow>({
  fetchApi: () =>
    serahTerimaFakturApi.getBrowse(startDate.value, endDate.value),
  getDetailApi: (nomor: string) => serahTerimaFakturApi.getDetail(nomor),
  exportTitle: "Serah Terima Faktur",
  columns: [
    { key: "Nomor", title: "Nomor", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "Serah", title: "Serah", width: 14 },
    { key: "Terima", title: "Terima", width: 14 },
    { key: "Realisasi", title: "Realisasi", width: 11, align: "center" },
    { key: "Note", title: "Note", width: 25 },
  ],
  detailColumns: [
    { key: "Faktur", title: "Faktur", width: 18 },
    { key: "Tanggal", title: "Tanggal", width: 12, align: "center" },
    { key: "JthTempo", title: "Jth Tempo", width: 12, align: "center" },
    { key: "Nilai", title: "Nilai", width: 16, numFmt: "#,##0" },
    { key: "Customer", title: "Customer", width: 25 },
  ],
});

const selectedItem = computed<SerahTerimaFakturRow | null>(
  () => selected.value[0] ?? null
);
const isSingleSelected = computed(() => selected.value.length === 1);

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
  { key: "Nomor", title: "Nomor", width: "170px" },
  { key: "Tanggal", title: "Tanggal", width: "100px", align: "center" as const },
  { key: "Serah", title: "Serah", width: "110px" },
  { key: "Terima", title: "Terima", width: "110px" },
  { key: "Realisasi", title: "Realisasi", width: "90px", align: "center" as const },
  { key: "Note", title: "Note", minWidth: "200px" },
];

const expanded = ref<any[]>([]);
const detailMap = ref<Record<string, SerahTerimaFakturDetailRow[]>>({});
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
        [nomor]: await serahTerimaFakturApi.getDetail(nomor),
      };
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(`Gagal memuat rincian untuk ${nomor}`);
    } finally {
      expandedLoading.value = { ...expandedLoading.value, [nomor]: false };
    }
  }
};

const onAdd = () => router.push("/penjualan/serah-terima-faktur/create");

// Delphi cxButton1Click: diblok bila sudah realisasi ATAU penyerah bukan user login.
const onEdit = (item: SerahTerimaFakturRow) => {
  if (item.Realisasi === "Sudah") {
    toast.warning("Nomor ini sudah di realisasi, tidak dapat di edit.");
    return;
  }
  if (item.Serah !== authStore.userKode) {
    toast.warning("Anda tidak berhak edit transaksi ini.");
    return;
  }
  router.push(
    `/penjualan/serah-terima-faktur/edit/${encodeURIComponent(item.Nomor)}`
  );
};

// ── Realisasi (Delphi cxButton4Click) ────────────────────────────────
const showRealisasiConfirm = ref(false);
useEscClose(showRealisasiConfirm, () => (showRealisasiConfirm.value = false));

const askRealisasi = () => {
  if (!selectedItem.value) return;
  showRealisasiConfirm.value = true;
};

const runRealisasi = async () => {
  const nomor = selectedItem.value?.Nomor;
  if (!nomor) return;
  try {
    await serahTerimaFakturApi.realisasi(nomor);
    toast.success(`Realisasi ${nomor} berhasil.`);
    showRealisasiConfirm.value = false;
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal realisasi transaksi.");
  }
};

// ── Cetak (Delphi cxButton3Click / cxButton5Click) ───────────────────
// Diblok bila penyerah bukan user login: "Anda tidak berhak Cetak transaksi ini".
const cetak = (mode: "st" | "slip") => {
  const item = selectedItem.value;
  if (!item) return;
  if (item.Serah !== authStore.userKode) {
    toast.warning("Anda tidak berhak Cetak transaksi ini.");
    return;
  }
  router.push(
    `/penjualan/serah-terima-faktur/print/${encodeURIComponent(item.Nomor)}?mode=${mode}`
  );
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

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
    title="Serah Terima Faktur"
    :icon="IconFileCheck"
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
    :can-delete="false"
    :can-export="canExport"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
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
        class="tb-btn tb-btn-primary"
        :disabled="!isSingleSelected"
        @click="askRealisasi"
      >
        <template #prepend>
          <IconCheck :size="13" :stroke-width="1.8" />
        </template>
        Realisasi
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-neutral"
        :disabled="!isSingleSelected"
        @click="cetak('st')"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
        Cetak
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-neutral"
        :disabled="!isSingleSelected"
        @click="cetak('slip')"
      >
        <template #prepend>
          <IconPrinter :size="13" :stroke-width="1.8" />
        </template>
        Slip
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
              <th style="width: 170px">Faktur</th>
              <th style="width: 100px" class="tc">Tanggal</th>
              <th style="width: 100px" class="tc">Jth Tempo</th>
              <th style="width: 120px" class="tr">Nilai</th>
              <th style="min-width: 180px">Customer</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in detailMap[item.Nomor] || []" :key="idx">
              <td class="mono">{{ d.Faktur }}</td>
              <td class="tc">{{ fmtDate(d.Tanggal) }}</td>
              <td class="tc">{{ fmtDate(d.JthTempo) }}</td>
              <td class="tr bold accent">{{ fmt(d.Nilai) }}</td>
              <td>{{ d.Customer }}</td>
            </tr>
            <tr v-if="!detailMap[item.Nomor]?.length">
              <td colspan="5" class="empty-td">Tidak ada detail.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseBrowse>

  <ExportDialog
    v-model="showExportDialog"
    :has-detail="true"
    @export-header="exportHeaderOnly('SerahTerimaFaktur')"
    @export-detail="exportDetailOnly('SerahTerimaFaktur')"
  />

  <v-dialog v-model="showRealisasiConfirm" width="420" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Realisasi Serah Terima Faktur</h3>
      <p class="confirm-text">
        Yakin realisasi serah terima
        <strong>{{ selectedItem?.Nomor }}</strong>? Status menjadi
        <strong>Sudah</strong> dan tidak dapat dikembalikan dari menu ini.
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showRealisasiConfirm = false">
          Batal
        </v-btn>
        <v-btn size="small" class="tb-btn tb-btn-primary" @click="runRealisasi">
          Realisasi
        </v-btn>
      </div>
    </div>
  </v-dialog>
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
  color: var(--ds-primary, #0284c7);
}

/* Label status realisasi: warna membawa makna, bukan hiasan */
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
  color: #075985;
  background: #e0f2fe;
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
  background: var(--ds-primary, #0284c7);
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

.confirm-box {
  background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 2.5px solid var(--ds-primary, #0284c7);
  border-radius: 0;
  padding: 16px;
}
.confirm-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
}
.confirm-text {
  margin: 0 0 16px;
  font-size: 12px;
  color: #374151;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
