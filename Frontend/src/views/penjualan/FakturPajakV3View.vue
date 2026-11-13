<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { fakturPajakV3Api, type FakturPajakV3Row } from "@/api/penjualan/fakturPajakV3Api";
import { IconFileInvoice, IconRefresh, IconFileExport, IconX, IconTrash } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const router = useRouter();
const toast = useToast();

const today = new Date().toISOString().slice(0, 10);
const SESSION_KEY = "finance_faktur_pajak_v3";

const getSaved = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (s?.startDate && s?.endDate) return s;
  } catch {}
  return null;
};
const saved = getSaved();

const startDate = ref(saved?.startDate ?? today);
const endDate = ref(saved?.endDate ?? today);
const isManual = ref(saved?.isManual ?? 0);
const items = ref<FakturPajakV3Row[]>([]);
const isLoading = ref(false);
const isExporting = ref(false);

const persist = () => {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ startDate: startDate.value, endDate: endDate.value, isManual: isManual.value })
    );
  } catch {}
};

const loadData = async () => {
  persist();
  isLoading.value = true;
  try {
    items.value = await fakturPajakV3Api.refresh(startDate.value, endDate.value, isManual.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

const onExport = async () => {
  if (items.value.length === 0) {
    toast.warning("Tidak ada data untuk diexport.");
    return;
  }

  isExporting.value = true;
  try {
    // Paritas Delphi: export hanya baris yang tersisa di grid (bukan query ulang mentah)
    const referensiList = items.value.map((d) => d.referensi);
    const blob = await fakturPajakV3Api.exportExcel(startDate.value, endDate.value, isManual.value, referensiList);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FakturPajak_${startDate.value}_sd_${endDate.value}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export Excel berhasil.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal export Excel.");
  } finally {
    isExporting.value = false;
  }
};

const removeRow = (idx: number) => {
  items.value.splice(idx, 1);
};

const onClose = () => {
  router.push({ name: "fakturPajakBrowse" });
};

onMounted(() => {
  loadData();
});

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
</script>

<template>
  <PageLayout title="Proses Faktur Pajak (V3)" :icon="IconFileInvoice">
    <template #header-actions>
      <v-btn size="small" class="tb-btn tb-btn-neutral" @click="loadData" :loading="isLoading">
        <template #prepend><IconRefresh :size="14" :stroke-width="1.8" /></template>
        Refresh
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-primary" @click="onExport" :loading="isExporting">
        <template #prepend><IconFileExport :size="14" :stroke-width="1.8" /></template>
        Proses / Export Excel
      </v-btn>
      <v-btn size="small" class="tb-btn tb-btn-danger" @click="onClose">
        <template #prepend><IconX :size="14" :stroke-width="2.2" /></template>
        Tutup
      </v-btn>
    </template>

    <!-- ═══ FILTER SECTION ═══ -->
    <div class="fpv3-filter">
      <div class="f-row">
        <label class="f-lbl">Tanggal</label>
        <DsDatePicker v-model="startDate" variant="form" @change="loadData" />
        <span class="f-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="form" @change="loadData" />
      </div>
      <div class="f-row">
        <label class="check-lbl">
          <input v-model="isManual" type="checkbox" :true-value="1" :false-value="0" @change="loadData" />
          Faktur Manual
        </label>
      </div>
    </div>

    <!-- ═══ GRID ═══ -->
    <div class="fpv3-grid">
      <table class="fpv3-table">
        <thead>
          <tr>
            <th class="tc">Baris</th>
            <th>Tanggal</th>
            <th>JenisFaktur</th>
            <th>KodeTransaksi</th>
            <th>KeteranganTambahan</th>
            <th>DokumenPendukung</th>
            <th>PeriodeDokPendukung</th>
            <th>Referensi</th>
            <th>CapFasilitas</th>
            <th>idtkupenjual</th>
            <th>npwppembeli</th>
            <th>jenisidpembeli</th>
            <th>NegaraPembeli</th>
            <th>nomordokumenpembeli</th>
            <th>namapembeli</th>
            <th>alamatpembeli</th>
            <th>emailpembeli</th>
            <th>idtkupembeli</th>
            <th class="tc">✕</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, idx) in items" :key="idx">
            <td class="tc">{{ d.baris }}</td>
            <td class="tc">{{ d.tanggal }}</td>
            <td>{{ d.jenisFaktur }}</td>
            <td>{{ d.kodeTransaksi }}</td>
            <td>{{ d.keteranganTambahan }}</td>
            <td>{{ d.dokumenPendukung }}</td>
            <td>{{ d.periodeDokPendukung }}</td>
            <td class="mono">{{ d.referensi }}</td>
            <td>{{ d.capFasilitas }}</td>
            <td class="mono">{{ d.idTkuPenjual }}</td>
            <td class="mono">{{ d.npwpPembeli }}</td>
            <td>{{ d.jenisIdPembeli }}</td>
            <td class="tc">{{ d.negaraPembeli }}</td>
            <td>{{ d.nomorDokumenPembeli }}</td>
            <td>{{ d.namaPembeli }}</td>
            <td>{{ d.alamatPembeli }}</td>
            <td>{{ d.emailPembeli }}</td>
            <td class="mono">{{ d.idTkuPembeli }}</td>
            <td class="tc">
              <button class="btn-del" type="button" @click="removeRow(idx)">
                <IconTrash :size="12" />
              </button>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="19" class="tc" style="color: #9e9e9e; font-style: italic; padding: 12px;">
              Klik Refresh untuk memuat data.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PageLayout>
</template>

<style scoped>
.fpv3-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: white;
  border-bottom: 1px solid var(--ds-border, #a0aab8);
  flex-shrink: 0;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.f-lbl {
  width: 60px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text, #0c4a6e);
}

.f-inp {
  height: 28px;
  border: 1px solid var(--ds-border, #a0aab8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 11px;
  outline: none;
  min-width: 130px;
  background: white;
}

.f-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-sep {
  font-size: 11px;
  color: var(--ds-text-muted, #8494a7);
}

.check-lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text, #0c4a6e);
  cursor: pointer;
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 14px;
  height: 14px;
}

.fpv3-grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px;
}

.fpv3-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.fpv3-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.fpv3-table th {
  color: white;
  font-weight: 700;
  padding: 5px 6px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

.fpv3-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #e3e7ee);
  vertical-align: middle;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.fpv3-table tbody tr:hover td {
  background: var(--ds-primary-50, #e8edf5);
}

.btn-del {
  background: none;
  border: none;
  color: #c62828;
  cursor: pointer;
  padding: 2px;
}

.tc { text-align: center; }
.mono { font-family: var(--ds-font-mono, Consolas, monospace); font-size: 10px; }
</style>