<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { omsetVsKategoriApi, type OmsetKategoriRow } from "@/api/laporan/omsetVsKategoriApi";
import { exportStyledHeader, type ExportColumn } from "@/utils/styledExport";
import { IconChartBar, IconFileSpreadsheet } from "@tabler/icons-vue";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();

// ── Periode (Delphi FormShow parent: 1 tgl bulan ini s.d hari ini) ──
const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const now = new Date();
const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startDate = ref(getLocal(firstOfMonth));
const endDate = ref(getLocal(now));

// ── Kategori filter (3 dropdown) ──
const kategoriOptions = ref<{ kode: string; kategori: string }[]>([]);
const kategori1 = ref("");
const kategori2 = ref("");
const kategori3 = ref("");
const catName = (kode: string) =>
  kategoriOptions.value.find((k) => k.kode === kode)?.kategori || kode;

// ── Data ──
const items = ref<OmsetKategoriRow[]>([]);
const isLoading = ref(false);

const loadKategori = async () => {
  try {
    kategoriOptions.value = await omsetVsKategoriApi.getKategori();
  } catch (e: any) {
    if (!isAuthExpiredError(e)) toast.error("Gagal memuat daftar kategori.");
  }
};

const loadData = async () => {
  if (!startDate.value || !endDate.value) return;
  isLoading.value = true;
  try {
    items.value = await omsetVsKategoriApi.getBrowse({
      startDate: startDate.value,
      endDate: endDate.value,
      kategori1: kategori1.value || undefined,
      kategori2: kategori2.value || undefined,
      kategori3: kategori3.value || undefined,
    });
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await loadKategori();
});

// ── Headers dinamis: Outlet + kategori terpilih + Omset ──
const selectedKats = computed(() =>
  [kategori1.value, kategori2.value, kategori3.value].filter((k) => k !== "")
);
const moneyKeys = computed(() => [...selectedKats.value, "Omset"]);

const headers = computed(() => {
  const h: { key: string; title: string; minWidth?: string; align?: string }[] = [
    { key: "Outlet", title: "Outlet", minWidth: "200px" },
  ];
  for (const k of selectedKats.value) {
    h.push({ key: k, title: catName(k), minWidth: "130px", align: "end" });
  }
  h.push({ key: "Omset", title: "Omset", minWidth: "140px", align: "end" });
  return h;
});

const fmtMoney = (v: any) => new Intl.NumberFormat("id-ID").format(Number(v) || 0);

// ── Export
const isExporting = ref(false);
const doExport = async () => {
  if (!items.value?.length) { toast.warning("Tidak ada data untuk diexport."); return; }
  isExporting.value = true;
  try {
    const cols: ExportColumn[] = [
      { key: "Outlet", title: "Outlet", width: 25 },
      ...selectedKats.value.map((k) => ({ key: k, title: catName(k), width: 18, numFmt: "#,##0" as const })),
      { key: "Omset", title: "Omset", width: 18, numFmt: "#,##0" },
    ];
    await exportStyledHeader({ title: "Laporan Omset Penjualan vs Omset Kategori", subtitle: `Periode: ${startDate.value} s/d ${endDate.value}`, columns: cols, items: items.value as unknown as Record<string, any>[], fileName: "OmsetVsKategori" });
    toast.success("Berhasil export ke Excel.");
  } catch { toast.error("Gagal export Excel."); } finally { isExporting.value = false; }
};

// Trigger auto-load saat filter berubah (watch BaseBrowse dengan auto-refresh)
const filterValues = computed(() => ({
  startDate: startDate.value,
  endDate: endDate.value,
  kategori1: kategori1.value,
  kategori2: kategori2.value,
  kategori3: kategori3.value,
}));
</script>

<template>
  <BaseBrowse
    title="Laporan Omset Penjualan vs Omset Kategori"
    :icon="IconChartBar"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :fixed-layout="false"
    item-value="Outlet"
    :auto-refresh="true"
    :filter-values="filterValues"
    @refresh="loadData"
  >
    <template #filter-left>
      <div class="filter-group">
        <span class="filter-lbl">Periode</span>
        <DsDatePicker v-model="startDate" variant="toolbar" />
        <span class="filter-sep">s/d</span>
        <DsDatePicker v-model="endDate" variant="toolbar" />
        <span class="filter-sep">|</span>
        <span class="filter-lbl">Kategori 1</span>
        <select v-model="kategori1" class="sel-inp">
          <option value="">- Pilih -</option>
          <option v-for="k in kategoriOptions" :key="k.kode" :value="k.kode">{{ k.kategori }}</option>
        </select>
        <span class="filter-lbl">Kategori 2</span>
        <select v-model="kategori2" class="sel-inp">
          <option value="">- Pilih -</option>
          <option v-for="k in kategoriOptions" :key="k.kode" :value="k.kode">{{ k.kategori }}</option>
        </select>
        <span class="filter-lbl">Kategori 3</span>
        <select v-model="kategori3" class="sel-inp">
          <option value="">- Pilih -</option>
          <option v-for="k in kategoriOptions" :key="k.kode" :value="k.kode">{{ k.kategori }}</option>
        </select>
      </div>
    </template>

    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="doExport" :loading="isExporting">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
    <template v-for="k in moneyKeys" :key="'cell-' + k" #[`item.${k}`]="{ value }">
      <span class="num-cell">{{ fmtMoney(value) }}</span>
    </template>
  </BaseBrowse>
</template>

<style scoped>
.filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.filter-lbl { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; }
.filter-sep { font-size: 12px; color: #9ca3af; }
.date-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; width: 128px;
}
.date-inp:focus { border-color: var(--ds-primary, #0284c7); }
.sel-inp {
  height: 30px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: white; max-width: 150px;
}
.sel-inp:focus { border-color: var(--ds-primary, #0284c7); }
.num-cell { font-variant-numeric: tabular-nums; }
</style>
