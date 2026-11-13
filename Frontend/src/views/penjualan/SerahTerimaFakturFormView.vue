<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import ColumnFilter, {
  type ColumnFilterValue,
  type FilterType,
} from "@/components/ColumnFilter.vue";
import { matchColumnFilter } from "@/composables/useColumnFilter";
import {
  IconFileCheck,
  IconSearch,
  IconFilter,
  IconFilterOff,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-vue";
import {
  serahTerimaFakturFormApi,
  type SerahTerimaFakturForm,
  type SerahTerimaFakturInvoice,
  type SerahTerimaFakturPihak,
} from "@/api/penjualan/serahTerimaFakturFormApi";
import DsDatePicker from "@/components/DsDatePicker.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useAuthStore } from "@/stores/authStore";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<SerahTerimaFakturForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  serah: "",
  serahNama: "",
  terima: "",
  terimaNama: "",
  memo: "",
  detail: [],
});

// Delphi edtPenyerah.Enabled := False kecuali user login = 'GUDANG'
const bolehGantiPenyerah = computed(() => authStore.userKode === "GUDANG");

// Delphi edtPenyerahExit: hanya boleh GUDANG / SALESMAN / DRIVER
const PENYERAH_SAH = ["GUDANG", "SALESMAN", "DRIVER"];

const pihakOptions = ref<SerahTerimaFakturPihak[]>([]);
const showPenyerahModal = ref(false);
const showPenerimaModal = ref(false);

// Tanggal sah terakhir, dipakai untuk menegakkan aturan Delphi
// "Perubahan tanggal tidak bisa beda bulan dan tahun" saat mode edit.
const tanggalTerpasang = ref(today);

const loadNomor = async () => {
  try {
    const res = await serahTerimaFakturFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const loadPihak = async () => {
  try {
    pihakOptions.value = await serahTerimaFakturFormApi.getUsers();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat daftar pihak serah terima.");
  }
};

// Antrean mengikuti nilai Penyerah (Delphi loaddataInvoice)
const loadInvoice = async () => {
  if (!form.value.serah) {
    form.value.detail = [];
    return;
  }
  try {
    form.value.detail = await serahTerimaFakturFormApi.getInvoice(
      form.value.serah
    );
    // Antrean baru → filter lama tidak relevan lagi.
    resetFilters();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat antrean faktur.");
  }
};

const selectPenyerah = async (p: SerahTerimaFakturPihak) => {
  showPenyerahModal.value = false;
  if (!bolehGantiPenyerah.value) {
    toast.warning("Anda tidak berhak mengganti penyerah.");
    return;
  }
  if (!PENYERAH_SAH.includes(p.kode)) {
    toast.warning("Hanya bisa di ubah ke Gudang/Salesman/Driver.");
    await paksaPenyerahGudang();
    return;
  }
  form.value.serah = p.kode;
  form.value.serahNama = p.nama;
  await loadInvoice();
};

const paksaPenyerahGudang = async () => {
  form.value.serah = "GUDANG";
  form.value.serahNama =
    pihakOptions.value.find((x) => x.kode === "GUDANG")?.nama || "";
  await loadInvoice();
};

const selectPenerima = (p: SerahTerimaFakturPihak) => {
  form.value.terima = p.kode;
  form.value.terimaNama = p.nama;
  showPenerimaModal.value = false;
};

const onTanggalChange = async (val: string | null) => {
  if (!val) return;

  if (isEdit.value) {
    if (val.slice(0, 7) !== tanggalTerpasang.value.slice(0, 7)) {
      toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun.");
      form.value.tanggal = tanggalTerpasang.value;
      return;
    }
    form.value.tanggal = val;
    tanggalTerpasang.value = val;
    return;
  }

  form.value.tanggal = val;
  tanggalTerpasang.value = val;
  await loadNomor();
};

const validateSave = () => {
  if (!form.value.terima) {
    toast.warning("Penerima belum di pilih.");
    return false;
  }
  const tercentang = form.value.detail.filter((d) => Number(d.check) === 1);
  if (tercentang.length === 0) {
    toast.warning("Minimal satu faktur harus dicentang.");
    return false;
  }
  return true;
};

const loadData = async () => {
  const nomor = route.params.nomor as string | undefined;
  if (!nomor) {
    form.value.isEdit = false;
    // Penyerah default = user login (Delphi refreshdata)
    form.value.serah = authStore.userKode;
    form.value.serahNama =
      pihakOptions.value.find((x) => x.kode === authStore.userKode)?.nama || "";
    await loadNomor();
    await loadInvoice();
    return;
  }

  isLoading.value = true;
  try {
    const data = await serahTerimaFakturFormApi.getDetailForm(
      decodeURIComponent(nomor)
    );
    form.value = { ...data, isEdit: true };
    tanggalTerpasang.value = data.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "serahTerimaFakturBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const resetForm = async () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    serah: authStore.userKode,
    serahNama:
      pihakOptions.value.find((x) => x.kode === authStore.userKode)?.nama || "",
    terima: "",
    terimaNama: "",
    memo: "",
    detail: [],
  };
  tanggalTerpasang.value = today;
  await loadNomor();
  await loadInvoice();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  if (!validateSave()) return;

  isSaving.value = true;
  try {
    const res = await serahTerimaFakturFormApi.save(form.value);
    const nomor = res.data?.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

onMounted(async () => {
  await loadPihak();
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

// ── Filter kolom tabel detail ─────────────────────────────────────────
// Filter bersifat TAMPILAN saja: form.value.detail tidak pernah diubah,
// jadi baris yang tersembunyi tapi tercentang tetap ikut terkirim saat
// save (backend memilih berdasarkan d.check — lihat serahTerimaFakturFormService).
type DtlKey =
  | "no"
  | "salesman"
  | "faktur"
  | "tanggal"
  | "ppn"
  | "nilai"
  | "customer"
  | "check";

// Satu sumber kebenaran untuk judul, lebar, dan tipe filter.
const DETAIL_COLS: {
  key: DtlKey;
  title: string;
  width?: string;
  minWidth?: string;
  cls?: string;
  filterType: FilterType;
}[] = [
  { key: "no", title: "No", width: "36px", cls: "tc", filterType: "number" },
  { key: "salesman", title: "Salesman", minWidth: "160px", filterType: "text" },
  { key: "faktur", title: "Faktur Penjualan", width: "170px", filterType: "text" },
  { key: "tanggal", title: "Tanggal Faktur", width: "100px", cls: "tc", filterType: "date" },
  { key: "ppn", title: "PPN", width: "100px", cls: "tr", filterType: "number" },
  { key: "nilai", title: "Nilai", width: "120px", cls: "tr", filterType: "number" },
  { key: "customer", title: "Customer", minWidth: "180px", filterType: "text" },
  { key: "check", title: "Check", width: "60px", cls: "tc", filterType: "select" },
];

const colFilters = ref<Record<string, ColumnFilterValue | null>>({});
const openFilterCol = ref<string | null>(null);
const filterStyle = ref<Record<string, string>>({});

const activeFilterCount = computed(
  () =>
    Object.values(colFilters.value).filter((f) => f !== null).length
);

const hasFilter = (key: string) =>
  colFilters.value[key] !== null && colFilters.value[key] !== undefined;

// Nilai yang dipakai filter per kolom (No bukan data → pakai urutan asli).
const filterValue = (d: SerahTerimaFakturInvoice, no: number, key: DtlKey): any => {
  switch (key) {
    case "no": return no;
    case "faktur": return d.faktur;
    case "salesman": return d.salesman;
    case "tanggal": return d.tanggal;
    case "ppn": return d.ppn;
    case "nilai": return d.nilai;
    case "customer": return d.customer;
    case "check": return d.check;
  }
};

// Baris yang tampil + nomor urut ASLI (bukan nomor hasil filter), supaya
// angka di layar tetap sama dengan yang tersimpan.
const filteredDetail = computed(() =>
  form.value.detail
    .map((d, i) => ({ d, no: i + 1 }))
    .filter(({ d, no }) =>
      DETAIL_COLS.every(({ key }) =>
        matchColumnFilter(filterValue(d, no, key), colFilters.value[key])
      )
    )
);

const openColFilter = (key: string, event: MouseEvent) => {
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

const resetFilters = () => {
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

// Baris tersembunyi ikut tersimpan → bukan salah filter kalau validate
// tetap lolos sementara tidak ada baris terlihat yang tercentang.
const hiddenCheckedCount = computed(
  () =>
    form.value.detail.length -
    filteredDetail.value.filter((r) => Number(r.d.check) === 1).length
);
</script>

<template>
  <BaseForm
    :title="
      isEdit
        ? 'Ubah Serah Terima Faktur'
        : 'Tambah Serah Terima Faktur Baru'
    "
    :icon="IconFileCheck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="sf-layout">
      <div class="sf-header-grid">
        <!-- Pihak -->
        <fieldset class="sf-groupbox">
          <legend class="sf-legend">Pihak Serah Terima</legend>
          <div class="sf-groupbody">
            <div class="f-row">
              <label class="f-lbl">Penyerah</label>
              <div class="search-group">
                <input
                  :value="form.serah"
                  class="f-inp w-30 readonly-bg"
                  readonly
                  placeholder="Kode"
                />
                <input
                  :value="form.serahNama"
                  class="f-inp w-70 readonly-bg"
                  readonly
                  placeholder="Penyerah..."
                />
                <button
                  class="btn-search"
                  type="button"
                  :disabled="!bolehGantiPenyerah"
                  :title="
                    bolehGantiPenyerah
                      ? 'Pilih penyerah'
                      : 'Hanya user GUDANG yang boleh mengganti penyerah'
                  "
                  @click="showPenyerahModal = true"
                >
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Penerima</label>
              <div class="search-group">
                <input
                  :value="form.terima"
                  class="f-inp w-30 readonly-bg"
                  readonly
                  placeholder="Kode"
                />
                <input
                  :value="form.terimaNama"
                  class="f-inp w-70 readonly-bg"
                  readonly
                  placeholder="Pilih penerima..."
                />
                <button
                  class="btn-search"
                  type="button"
                  title="Pilih penerima"
                  @click="showPenerimaModal = true"
                >
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="2"></textarea>
            </div>
          </div>
        </fieldset>

        <!-- Dokumen -->
        <fieldset class="sf-groupbox">
          <legend class="sf-legend">Dokumen</legend>
          <div class="sf-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker
                v-model="form.tanggal"
                variant="form"
                @change="onTanggalChange"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl"></label>
              <button type="button" class="btn-load" @click="loadInvoice">
                Muat Antrean
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <fieldset class="sf-groupbox sf-detail-group">
        <legend class="sf-legend">Daftar Faktur Diserahkan</legend>
        <div class="detail-toolbar">
          <span v-if="activeFilterCount" class="filter-count">
            {{ activeFilterCount }} filter aktif
          </span>
          <span v-else class="filter-count muted">
            {{ form.detail.length }} faktur
          </span>
          <button
            v-if="activeFilterCount"
            type="button"
            class="btn-filter-clear"
            @click="clearAllFilters"
          >
            <IconFilterOff :size="13" />
            Hapus Filter
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th
                  v-for="col in DETAIL_COLS"
                  :key="col.key"
                  :style="
                    col.width
                      ? { width: col.width }
                      : col.minWidth
                        ? { minWidth: col.minWidth }
                        : {}
                  "
                  :class="col.cls"
                >
                  <div class="th-inner">
                    <span class="th-title">{{ col.title }}</span>
                    <button
                      type="button"
                      class="col-filter-btn"
                      :class="{ active: hasFilter(col.key) }"
                      :title="`Filter ${col.title}`"
                      @click.stop="openColFilter(col.key, $event)"
                    >
                      <IconFilter
                        v-if="hasFilter(col.key)"
                        :size="9"
                        :stroke-width="2.2"
                      />
                      <IconAdjustmentsHorizontal
                        v-else
                        :size="9"
                        :stroke-width="2.2"
                      />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredDetail" :key="row.d.faktur">
                <td class="tc row-no">{{ row.no }}</td>
                <td>{{ row.d.salesman }}</td>
                <td>{{ row.d.faktur }}</td>
                <td class="tc">{{ row.d.tanggal }}</td>
                <td class="tr">{{ fmt(row.d.ppn) }}</td>
                <td class="tr bold">{{ fmt(row.d.nilai) }}</td>
                <td>{{ row.d.customer }}</td>
                <td class="tc">
                  <input
                    v-model="row.d.check"
                    type="checkbox"
                    :true-value="1"
                    :false-value="0"
                    :aria-label="`Centang faktur ${row.d.faktur}`"
                  />
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="8" class="empty-state">
                  Tidak ada faktur pada antrean penyerah ini. Periksa nilai
                  Penyerah atau klik Muat Antrean.
                </td>
              </tr>
              <tr v-else-if="filteredDetail.length === 0">
                <td colspan="8" class="empty-state">
                  Tidak ada faktur yang cocok dengan filter aktif.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="hiddenCheckedCount > 0" class="filter-note">
          {{ hiddenCheckedCount }} faktur tercentang tersembunyi oleh filter —
          tetap ikut disimpan.
        </p>
      </fieldset>
    </div>
  </BaseForm>

  <ColumnFilter
    v-if="openFilterCol"
    :filter-type="filterTypeOf(openFilterCol)"
    :column-key="openFilterCol"
    :title="activeFilterTitle"
    :items="form.detail"
    :model-value="colFilters[openFilterCol] ?? null"
    :dropdown-style="filterStyle"
    @update:model-value="onColFilterUpdate(openFilterCol, $event)"
    @close="openFilterCol = null"
  />

  <SearchModal
    v-model="showPenyerahModal"
    title="Pilih Penyerah"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama' },
    ]"
    :items="pihakOptions"
    search-placeholder="Cari penyerah..."
    @select="selectPenyerah"
  />

  <SearchModal
    v-model="showPenerimaModal"
    title="Pilih Penerima"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama' },
    ]"
    :items="pihakOptions"
    search-placeholder="Cari penerima..."
    @select="selectPenerima"
  />
</template>

<style scoped>
/* Klasik desktop: group box berjudul, input sunken, sudut tajam, tanpa bayangan. */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.sf-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.sf-header-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 6px;
  flex-shrink: 0;
}

.sf-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.sf-legend {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start;
  line-height: 1.4;
}

.sf-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sf-detail-group {
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

.f-lbl {
  width: 70px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.f-inp {
  flex: 1;
  max-width: 300px;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

.f-txa {
  flex: 1;
  max-width: 300px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 4px 5px;
  font-size: 11px;
  outline: none;
  resize: vertical;
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-txa:focus {
  border-color: var(--ds-primary, #0284c7);
}

.search-group {
  display: flex;
  gap: 2px;
  flex: 1;
}

.w-30 {
  width: 30%;
  flex: none !important;
}
.w-70 {
  width: 70%;
}

.btn-search {
  height: 24px;
  width: 26px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-search:hover:not(:disabled) {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-search:disabled {
  background: var(--ds-text-muted, #8494A7);
  border-color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

.btn-load {
  height: 24px;
  padding: 0 10px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-load:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.detail-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* max-height = jaring pengaman dari SettingEstimasiSalesmanView.
     flex:1 di dalam <fieldset> bisa tidak dihormati browser; kalau wrap tidak
     jadi scroller, mouse-wheel jatuh ke .sf-layout (overflow:hidden — tetap
     bisa di-scroll) dan sticky th tidak pernah aktif. Dengan batas eksplisit,
     wrap selalu jadi scroller. */
  max-height: 480px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-weight: 500;
}

.detail-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.detail-table th {
  /* Background WAJIB di th, bukan di thead tr: th yang sticky menempel,
     sedangkan tr tetap di posisi aslinya — kalau warnanya di tr, bar biru
     ikut ter-scroll keluar dan header jadi transparan. */
  background: var(--ds-primary, #0284c7);
  color: white;
  font-weight: 700;
  padding: 4px 6px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
  border-bottom: 1px solid var(--ds-primary-dark, #0369a1);
}

.detail-table th:last-child {
  border-right: none;
}

/* Header dua lapis: judul + tombol filter per kolom */
.th-inner {
  display: flex;
  align-items: center;
  gap: 3px;
}
.th-title {
  flex: 1 1 auto;
  min-width: 0;
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

/* Toolbar di atas grid: jumlah baris + hapus filter */
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
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
.filter-note {
  margin: 0;
  padding: 3px 6px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  background: var(--ds-warning, #0284c7);
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 600;
}

.detail-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle;
  white-space: nowrap;
}

.detail-table td:last-child {
  border-right: none;
}

.detail-table tbody tr:nth-child(even) {
  background: var(--ds-surface, #F0F3F8);
}

.detail-table tbody tr:hover td {
  background: var(--ds-primary-50, #E8EDF5);
}

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-secondary, #5A6A7E);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

.tc {
  text-align: center;
}
.tr {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bold {
  font-weight: 700;
}
</style>
