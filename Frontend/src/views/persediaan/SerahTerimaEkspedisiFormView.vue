<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import OtorisasiDialog from "@/components/OtorisasiDialog.vue";
import { type OtorisasiKonteks } from "@/api/otorisasiApi";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import {
  IconTruckDelivery,
  IconRefresh,
  IconTrash,
  IconFilter,
  IconFilterOff,
  IconAdjustmentsHorizontal,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import ColumnFilter, {
  type ColumnFilterValue,
  type FilterType,
} from "@/components/ColumnFilter.vue";
import { matchColumnFilter } from "@/composables/useColumnFilter";
import {
  serahTerimaEkspedisiFormApi,
  type SerahTerimaEkspedisiForm,
  type SerahTerimaEkspedisiDetail,
  type SerahTerimaEkspedisiTipe,
} from "@/api/persediaan/serahTerimaEkspedisiFormApi";

const route = useRoute();
const toast = useToast();
const { handlePostSave } = useAfterSave({ onReset: () => resetForm() });

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const isLoadingDetail = ref(false);

const today = () => new Date().toISOString().slice(0, 10);
const TIPE_LIST: SerahTerimaEkspedisiTipe[] = ["FP", "DO", "MUTASI"];

const blankForm = (): SerahTerimaEkspedisiForm => ({
  isEdit: false,
  nomor: "",
  tanggal: today(),
  tanggal1: today(),
  tanggal2: today(),
  namaEkspedisi: "",
  keterangan: "",
  tipe: "FP",
  detail: [],
});

const form = ref<SerahTerimaEkspedisiForm>(blankForm());

const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value = blankForm();
    await loadMaxNomor();
    return;
  }
  isLoading.value = true;
  try {
    const data = await serahTerimaEkspedisiFormApi.getDetailForm(
      decodeURIComponent(nomor)
    );
    form.value = { ...form.value, ...data, isEdit: true, nomor: data.nomor || nomor };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data serah terima ekspedisi.");
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    const { nomor } = await serahTerimaEkspedisiFormApi.getNomor(form.value.tanggal);
    form.value.nomor = nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

// Load detail (Delphi btnRefreshClick) — satu-satunya sumber baris.
const loadDetail = async () => {
  isLoadingDetail.value = true;
  try {
    form.value.detail = await serahTerimaEkspedisiFormApi.load(
      form.value.tanggal1,
      form.value.tanggal2,
      form.value.tipe,
      form.value.isEdit ? form.value.nomor : undefined
    );
    toast.success(`${form.value.detail.length} baris berhasil dimuat.`);
    // Antrean baru, filter kolom lama tidak relevan lagi.
    clearAllFilters();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load detail.");
  } finally {
    isLoadingDetail.value = false;
  }
};

const onTipeChange = (v: string) => {
  form.value.tipe = (TIPE_LIST as string[]).includes(v)
    ? (v as SerahTerimaEkspedisiTipe)
    : "FP";
};

const removeRow = (idx: number) => form.value.detail.splice(idx, 1);

const colToElId = (c: string, r: number) => `ste-cell-${c}-${r}`;

const grid = useDetailGrid({
  cols: ["check"],
  rowCount: () => form.value.detail.length,
  cellId: colToElId,
  cellPrefix: "ste-cell",
  isToggle: (c) => c === "check",
  onToggle: (r) => {
    const d = form.value.detail[r];
    if (d) d.check = d.check === 1 ? 0 : 1;
  },
});

const { focusCell, enterEdit } = grid;

const isActiveCell = (r: number, c: string) =>
  focusCell.value?.r === r && focusCell.value?.c === c;

// Otorisasi — paritas TfrmOtorisasi3, kini mode backend: kode dari waktu server
// (tercatat di totorisasi) + verifikasi /verify → status DONE. Detail mobile
// (Flutter) mengambil Net/HPP/Margin dari laporan list jual per faktur (no FP).
const PERSEN_OTORISASI = 10;
const showOtorisasi = ref(false);
const otorisasiKeterangan = ref("");
const otorisasiKonteks = ref<OtorisasiKonteks | null>(null);
const otorisasiResolve = ref<((ok: boolean) => void) | null>(null);
const pendingOtorisasiRow = ref<SerahTerimaEkspedisiDetail | null>(null);

const askOtorisasi = (d: SerahTerimaEkspedisiDetail): Promise<boolean> => {
  otorisasiKeterangan.value = `${d.nomor} - ${d.nama} - ${new Intl.NumberFormat("id-ID").format(d.nilai)}`;
  pendingOtorisasiRow.value = d;
  otorisasiKonteks.value = {
    jenis: "STE",
    variant: 1,
    form: {
      fpNomor: d.nomor,
      steNomor: form.value.nomor,
      tipe: form.value.tipe,
      cusNama: d.nama,
    },
    detail: [],
  };
  showOtorisasi.value = true;
  return new Promise((resolve) => {
    otorisasiResolve.value = resolve;
  });
};

const onOtorisasiSuccess = (kode?: string) => {
  if (kode && pendingOtorisasiRow.value) {
    pendingOtorisasiRow.value.otorisasiKode = kode;
    pendingOtorisasiRow.value.otorisasi = 1;
  }
  showOtorisasi.value = false;
  otorisasiResolve.value?.(true);
  otorisasiResolve.value = null;
  pendingOtorisasiRow.value = null;
};

const onOtorisasiFail = () => {
  showOtorisasi.value = false;
  otorisasiResolve.value?.(false);
  otorisasiResolve.value = null;
  pendingOtorisasiRow.value = null;
};

// Delphi cekdata: baris tercentang dengan Nilai > 0 dan (Nilai2/Nilai)*100 < 10
// wajib diotorisasi satu per satu; gagal satu → batalkan sisa baris.
const cekOtorisasi = async (): Promise<boolean> => {
  for (const d of form.value.detail) {
    if (Number(d.check) !== 1 || Number(d.nilai || 0) <= 0) continue;
    if ((Number(d.nilai2 || 0) / Number(d.nilai)) * 100 >= PERSEN_OTORISASI) continue;
    if (!(await askOtorisasi(d))) return false;
  }
  return true;
};

const validateSave = (): boolean => {
  if (!form.value.namaEkspedisi.trim()) {
    toast.warning("Nama ekspedisi wajib diisi.");
    return false;
  }
  if (!form.value.detail.length) {
    toast.warning("Belum ada detail. Klik Load terlebih dahulu.");
    return false;
  }
  if (!form.value.detail.some((d) => Number(d.check) === 1)) {
    toast.warning("Centang minimal satu baris.");
    return false;
  }
  return true;
};

const confirmSave = async (action: "new" | "close") => {
  if (!validateSave() || isSaving.value) return;
  if (!(await cekOtorisasi())) {
    toast.warning("Otorisasi ditolak, data tidak disimpan.");
    return;
  }
  isSaving.value = true;
  try {
    await serahTerimaEkspedisiFormApi.save(form.value);
    handlePostSave(action, String(form.value.nomor ?? ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const resetForm = () => {
  form.value = blankForm();
  loadMaxNomor();
};

const COLS = [
  { key: "check", width: 44 },
  { key: "no", width: 36 },
  { key: "nomor", width: 130 },
  { key: "nama", width: 200 },
  { key: "tanggal", width: 100 },
  { key: "nilai", width: 130 },
  { key: "action", width: 30 },
] as const;

const w = (key: (typeof COLS)[number]["key"]) => ({
  width: `${COLS.find((c) => c.key === key)?.width}px`,
});

// ── Filter + sortir kolom (pola SerahTerimaFakturSalesmanFormView) ──────
type DtlKey =
  | "check"
  | "no"
  | "nomor"
  | "nama"
  | "tanggal"
  | "nilai"
  | "action";

interface DtlCol {
  key: DtlKey;
  title: string;
  filterType: FilterType | null;
  sortable: boolean;
  cls?: string;
}

const DETAIL_COLS: DtlCol[] = [
  { key: "check", title: "Cek", filterType: "select", sortable: true, cls: "tc" },
  { key: "no", title: "No", filterType: null, sortable: false, cls: "tc" },
  { key: "nomor", title: "Nomor", filterType: "text", sortable: true },
  { key: "nama", title: "Nama", filterType: "text", sortable: true },
  { key: "tanggal", title: "Tanggal", filterType: "date", sortable: true, cls: "tc" },
  { key: "nilai", title: "Nilai Net", filterType: "number", sortable: true, cls: "tr" },
  { key: "action", title: "", filterType: null, sortable: false, cls: "tc" },
];

const colFilters = ref<Record<string, ColumnFilterValue | null>>({});
const openFilterCol = ref<DtlKey | null>(null);
const filterStyle = ref<Record<string, string>>({});
const sortKey = ref<DtlKey | null>(null);
const sortDir = ref<"asc" | "desc">("asc");

const activeFilterCount = computed(
  () => Object.values(colFilters.value).filter((f) => f !== null).length,
);

const hasFilter = (key: string) =>
  colFilters.value[key] !== null && colFilters.value[key] !== undefined;

// Nilai yang dipakai filter/sort per kolom (No bukan properti data).
const filterValue = (d: SerahTerimaEkspedisiDetail, no: number, key: DtlKey): any => {
  switch (key) {
    case "no": return no;
    case "check": return d.check;
    case "nomor": return d.nomor;
    case "nama": return d.nama;
    case "tanggal": return d.tanggal;
    case "nilai": return d.nilai;
  }
};

// Baris tampil memegang index asli supaya edit/hapus tetap mengenai baris yang benar.
const filteredDetail = computed(() => {
  const rows = form.value.detail
    .map((d, i) => ({ d, no: i + 1, idx: i }))
    .filter(({ d, no }) =>
      DETAIL_COLS.every((c) =>
        matchColumnFilter(filterValue(d, no, c.key), colFilters.value[c.key])
      )
    );
  const key = sortKey.value;
  if (!key) return rows;
  const numeric = DETAIL_COLS.find((c) => c.key === key)?.filterType === "number";
  const dir = sortDir.value === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const va = filterValue(a.d, a.no, key);
    const vb = filterValue(b.d, b.no, key);
    return numeric
      ? (Number(va) - Number(vb)) * dir
      : String(va).localeCompare(String(vb), "id", { numeric: true }) * dir;
  });
  return rows;
});

// Siklus klik header: asc, desc, lalu kembali ke urutan asli.
const toggleSort = (key: DtlKey) => {
  if (sortKey.value !== key) {
    sortKey.value = key;
    sortDir.value = "asc";
  } else if (sortDir.value === "asc") {
    sortDir.value = "desc";
  } else {
    sortKey.value = null;
    sortDir.value = "asc";
  }
};

const openColFilter = (key: DtlKey, event: MouseEvent) => {
  if (openFilterCol.value === key) {
    openFilterCol.value = null;
    return;
  }
  // Samakan lebar dropdown dengan lebar header, lalu flip ke kiri bila
  // akan melewati tepi kanan layar (pola BaseBrowse.openColFilter).
  const POPUP_WIDTH = 190;
  const MARGIN = 8;
  const btn = event.currentTarget as HTMLElement;
  const th = btn.closest("th");
  if (th) {
    const thRect = th.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = thRect.left;
    if (left + POPUP_WIDTH + MARGIN > vw) {
      left = Math.min(btnRect.right, vw - MARGIN) - POPUP_WIDTH;
    }
    left = Math.max(MARGIN, Math.min(left, vw - POPUP_WIDTH - MARGIN));
    filterStyle.value = {
      position: "fixed",
      top: `${thRect.bottom + 2}px`,
      left: `${left}px`,
    };
  }
  openFilterCol.value = key;
};

const onColFilterUpdate = (key: string, val: ColumnFilterValue | null) => {
  colFilters.value = { ...colFilters.value, [key]: val };
};

const clearAllFilters = () => {
  colFilters.value = {};
  openFilterCol.value = null;
};

const activeFilterTitle = computed(() => {
  const k = openFilterCol.value;
  if (!k) return "";
  return DETAIL_COLS.find((c) => c.key === k)?.title || k;
});

const filterTypeOf = (key: string): FilterType =>
  DETAIL_COLS.find((c) => c.key === key)?.filterType || "text";

const filterRows = computed(() => form.value.detail.map((d, i) => ({ ...d, no: i + 1 })));

// Baris tersembunyi ikut tersimpan, jadi beri tahu bila ada centang tak terlihat.
const hiddenCheckedCount = computed(
  () =>
    form.value.detail.filter((d) => Number(d.check) === 1).length -
    filteredDetail.value.filter((r) => Number(r.d.check) === 1).length
);

const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

onMounted(loadData);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Serah Terima Ekspedisi' : 'Tambah Serah Terima Ekspedisi'"
    :icon="IconTruckDelivery"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="ste-layout">
      <div class="ste-header-grid">
        <fieldset class="ste-groupbox">
          <legend class="ste-legend">Informasi Serah Terima</legend>
          <div class="ste-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tipe</label>
              <select
                class="f-inp"
                :value="form.tipe"
                @change="onTipeChange(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="t in TIPE_LIST" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Nama Ekspedisi <span class="req">*</span></label>
              <input v-model="form.namaEkspedisi" class="f-inp" maxlength="300" placeholder="Nama ekspedisi..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Keterangan</label>
              <input v-model="form.keterangan" class="f-inp" maxlength="300" placeholder="Keterangan..." />
            </div>
          </div>
        </fieldset>

        <fieldset class="ste-groupbox">
          <legend class="ste-legend">Periode Load</legend>
          <div class="ste-groupbody">
            <div class="f-row">
              <label class="f-lbl">Tanggal Awal</label>
              <DsDatePicker v-model="form.tanggal1" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal Akhir</label>
              <DsDatePicker v-model="form.tanggal2" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl"></label>
              <button class="btn-load" type="button" :disabled="isLoadingDetail" @click="loadDetail">
                <IconRefresh :size="13" /> {{ isLoadingDetail ? "Memuat..." : "Load" }}
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <fieldset class="ste-groupbox ste-detail-group">
        <legend class="ste-legend">Detail Serah Terima</legend>
        <div class="detail-toolbar">
          <span v-if="activeFilterCount > 0" class="filter-count">
            {{ activeFilterCount }} filter aktif
          </span>
          <span v-else class="filter-count muted">{{ form.detail.length }} baris</span>
          <button
            v-if="activeFilterCount > 0"
            type="button"
            class="btn-filter-clear"
            @click="clearAllFilters"
          >
            <IconFilterOff :size="11" /> Hapus Filter
          </button>
        </div>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th
                    v-for="col in DETAIL_COLS"
                    :key="col.key"
                    :style="w(col.key)"
                    :class="col.cls"
                  >
                    <div class="th-inner">
                      <span
                        class="th-title"
                        :class="{ sortable: col.sortable }"
                        @click="col.sortable && toggleSort(col.key)"
                      >
                        {{ col.title }}
                      </span>
                      <IconChevronUp
                        v-if="sortKey === col.key && sortDir === 'asc'"
                        :size="11"
                        class="sort-ind"
                      />
                      <IconChevronDown
                        v-else-if="sortKey === col.key && sortDir === 'desc'"
                        :size="11"
                        class="sort-ind"
                      />
                      <button
                        v-if="col.filterType"
                        type="button"
                        class="col-filter-btn"
                        :class="{ active: hasFilter(col.key) }"
                        :title="`Filter ${col.title}`"
                        @click.stop="openColFilter(col.key, $event)"
                      >
                        <IconFilter v-if="hasFilter(col.key)" :size="9" :stroke-width="2.2" />
                        <IconAdjustmentsHorizontal v-else :size="9" :stroke-width="2.2" />
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="row in filteredDetail" :key="row.idx">
                  <td
                    class="tc"
                    :style="w('check')"
                    :id="colToElId('check', row.idx)"
                    :class="{ 'cell-active': isActiveCell(row.idx, 'check') }"
                    @click="enterEdit(row.idx, 'check')"
                  >
                    <input
                      v-model="row.d.check"
                      type="checkbox"
                      :true-value="1"
                      :false-value="0"
                      :aria-label="`Centang baris ${row.d.nomor}`"
                    />
                  </td>
                  <td class="tc row-no" :style="w('no')">{{ row.no }}</td>
                  <td class="mono" :style="w('nomor')">{{ row.d.nomor }}</td>
                  <td :style="w('nama')">{{ row.d.nama }}</td>
                  <td class="tc" :style="w('tanggal')">{{ row.d.tanggal }}</td>
                  <td class="tr" :style="w('nilai')">{{ fmt(row.d.nilai) }}</td>
                  <td class="tc" :style="w('action')">
                    <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(row.idx)">
                      <IconTrash :size="12" />
                    </button>
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="7" class="empty-state">
                    Belum ada detail. Klik <strong>Load</strong> pada panel Periode
                    Load untuk memuat dokumen.
                  </td>
                </tr>
                <tr v-else-if="filteredDetail.length === 0">
                  <td colspan="7" class="empty-state">
                    Tidak ada baris yang cocok dengan filter aktif.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-if="hiddenCheckedCount > 0" class="filter-note">
          {{ hiddenCheckedCount }} baris tercentang tersembunyi oleh filter, tetap ikut disimpan.
        </p>
      </fieldset>
    </div>
  </BaseForm>

  <ColumnFilter
    v-if="openFilterCol"
    :filter-type="filterTypeOf(openFilterCol)"
    :column-key="openFilterCol"
    :title="activeFilterTitle"
    :items="filterRows"
    :model-value="colFilters[openFilterCol] ?? null"
    :dropdown-style="filterStyle"
    @update:model-value="onColFilterUpdate(openFilterCol, $event)"
    @close="openFilterCol = null"
  />

  <OtorisasiDialog
    v-model="showOtorisasi"
    :variant="1"
    title="Otorisasi Rasio di Bawah 10%"
    :konteks="otorisasiKonteks"
    :keterangan="otorisasiKeterangan"
    @success="onOtorisasiSuccess"
    @fail="onOtorisasiFail"
    @cancel="onOtorisasiFail"
  />
</template>

<style scoped>
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.ste-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
  background: #FDFDFE;
}

.ste-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

.ste-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.ste-legend {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  background: #FDFDFE;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start;
  line-height: 1.4;
}

.ste-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ste-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-hint {
  font-size: 10px;
  color: var(--ds-text-muted, #8494A7);
  line-height: 1.4;
  margin-top: 2px;
}

.req {
  color: red;
}

.btn-load {
  height: 28px;
  padding: 0 14px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-load:hover:not(:disabled) {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-load:disabled {
  opacity: 0.6;
  cursor: default;
}

.detail-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--ds-border, #A0AAB8);
  overflow: hidden;
}

.detail-table-header {
  flex-shrink: 0;
  overflow: hidden;
}

.detail-table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-weight: 600;
  table-layout: fixed;
}

.detail-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.detail-table th {
  color: white;
  font-weight: 700;
  padding: 4px 6px;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
  border-bottom: 1px solid var(--ds-primary-dark, #0369a1);
}

.detail-table th:last-child {
  border-right: none;
}

.detail-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle;
  white-space: nowrap;
  color: #111827;
}

.detail-table td:last-child {
  border-right: none;
}

.detail-table tbody tr:nth-child(odd) {
  background: #F0F3F8;
}

.detail-table tbody tr:nth-child(even) {
  background: #E4EBF4;
}

.detail-table tbody tr:hover td {
  background: #D8E2EF;
}

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.mono {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 11px;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.btn-del {
  background: none;
  border: none;
  color: var(--ds-text-muted, #8494A7);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 0;
}

.btn-del:hover {
  background: #FEE2E2;
  color: #DC2626;
}

.tc {
  text-align: center;
}

.tr {
  text-align: right;
}

/* ── Toolbar di atas grid: jumlah baris + hapus filter ─────────── */
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  flex-shrink: 0;
  background: var(--ds-surface, #F0F3F8);
}

.filter-count {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ds-primary, #0284c7);
}

.filter-count.muted {
  font-weight: 500;
  color: var(--ds-text-secondary, #5A6A7E);
}

.btn-filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  background: #ffffff;
  color: var(--ds-primary, #0284c7);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-filter-clear:hover {
  background: var(--ds-primary-50, #E8EDF5);
}

/* ── Header dua lapis: judul (sort) + tombol filter per kolom ───── */
.th-inner {
  display: flex;
  align-items: center;
  gap: 3px;
}

.tc .th-inner {
  justify-content: center;
}

.tr .th-inner {
  justify-content: flex-end;
}

.th-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.th-title.sortable {
  cursor: pointer;
  user-select: none;
}

.sort-ind {
  flex: 0 0 auto;
}

.col-filter-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0;
  color: #ffffff;
  cursor: pointer;
}

.col-filter-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.col-filter-btn.active {
  background: #ffffff;
  color: var(--ds-primary, #0284c7);
  border-color: #ffffff;
}

.col-filter-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}

.filter-note {
  margin: 0;
  padding: 3px 6px;
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--ds-warning, #0284c7);
  background: #e1f5fe;
}

@media (max-width: 1024px) {
  .ste-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ste-layout {
    padding: 4px;
    gap: 4px;
  }

  .ste-groupbody {
    padding: 6px;
    gap: 4px;
  }
}
</style>
