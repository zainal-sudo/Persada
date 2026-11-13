<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconAdjustments, IconSearch, IconPlus, IconTrash, IconFileUpload, IconFileExcel } from "@tabler/icons-vue";
import * as XLSX from "xlsx";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  penyesuaianStokFormApi,
  type PenyesuaianStokForm,
  type PenyesuaianStokDetail,
} from "@/api/persediaan/penyesuaianStokFormApi";

const route = useRoute();
const router = useRouter();
const { handlePostSave } = useAfterSave({ onReset: () => { /* TODO: reset form */ } });
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<PenyesuaianStokForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  gudang: "",
  keterangan: "",
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const gudangOptions = ref<{ kode: string; nama: string }[]>([]);
const skuOptions = ref<any[]>([]);
const skuLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showSKUModal = ref(false);
const activeDetailIndex = ref(-1);

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadMaxNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await penyesuaianStokFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data penyesuaian stok.");
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    form.value.nomor = await penyesuaianStokFormApi.getMaxNomor(
      form.value.tanggal,
      authStore.cabangKode
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const loadGudang = async () => {
  try {
    gudangOptions.value = await penyesuaianStokFormApi.getGudang();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data gudang.");
  }
};

// ── Search SKU ───────────────────────────────────────────────────────
const searchSKU = async (query: string) => {
  if (!form.value.gudang) {
    toast.warning("Pilih gudang terlebih dahulu.");
    return;
  }
  skuLoading.value = true;
  try {
    skuOptions.value = await penyesuaianStokFormApi.searchSKU(form.value.gudang, query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SKU.");
  } finally {
    skuLoading.value = false;
  }
};

const openSKUModal = (idx: number) => {
  if (!form.value.gudang) {
    toast.warning("Pilih gudang terlebih dahulu.");
    return;
  }
  activeDetailIndex.value = idx;
  showSKUModal.value = true;
  searchSKU("");
};

const selectSKU = async (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  const duplicate = form.value.detail.find(
    (d, i) => i !== idx && d.sku === item.sku && d.expired === item.expired
  );
  if (duplicate) {
    toast.warning(`SKU dan expired ada yang sama dengan baris lain.`);
    return;
  }

  try {
    const detail = await penyesuaianStokFormApi.getDetailSKU(
      form.value.gudang, item.sku, item.expired
    );

    const d = form.value.detail[idx];
    d.sku = item.sku;
    d.expired = item.expired;
    d.namaBarang = detail.namaBarang;
    d.satuan = detail.satuan;
    d.idBatch = detail.idbatch;
    d.system = Number(detail.stok);
    d.harga = Number(detail.hargabeli);
    d.price = Number(detail.hargabeli) * 2;
    hitungNilai(d);

    showSKUModal.value = false;
    // Pola DO ("langsung ke qty"): setelah SKU dipilih, lanjut ke input Fisik baris yang sama.
    nextTick(() => psEnterEdit(idx, "fisik"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat detail SKU.");
  }
};

// ── Auto calculation ─────────────────────────────────────────────────
const hitungNilai = (d: PenyesuaianStokDetail) => {
  d.qty = Number(d.fisik) - Number(d.system);
  d.nilai = d.qty * Number(d.harga);
  d.nilaiPrice = d.nilai * 2;
};

// ── Formatted Number Input (same as DOFormView) ──────────────────────
// Input numerik TIDAK pakai type=number (ada spinner) dan TIDAK pakai
// v-model langsung (binding menimpa DOM value saat re-render). Pakai
// type=text + inputmode=numeric + rawInputValues: bebas ketik, format
// ribuan rapi saat blur (ala Excel).
const parseInput = (raw: string): number => {
  const n = Number(String(raw).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

const rawInputValues: Record<string, string> = {};

const getInputValue = (key: string, modelValue: number, decimals = 0) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startEdit = (key: string, e: Event, raw: number) => {
  // Pola DO (startQtyEdit): nilai 0 dikosongkan saat fokus — langsung ketik.
  const val = raw === 0 ? "" : String(raw);
  rawInputValues[key] = val;
  (e.target as HTMLInputElement).value = val;
};

const endEdit = (key: string, e: Event, raw: number, decimals = 0) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

const onFisikInput = (e: Event, d: PenyesuaianStokDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["fisik-" + idx] = el.value;
  d.fisik = parseInput(el.value);
  hitungNilai(d);
};

const onHargaInput = (e: Event, d: PenyesuaianStokDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["harga-" + idx] = el.value;
  d.harga = parseInput(el.value);
  hitungNilai(d);
};

// ── Detail Grid ──────────────────────────────────────────────────────
// ── Tambah Detail (dialog checklist SKU — pola DOFormView) ──────────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

const skuKey = (s: any) => `${String(s.sku)}|${s.expired || ""}`;

const isTambahDetailSelected = (item: any) =>
  selectedTambahDetail.value.some((s) => skuKey(s) === skuKey(item));

const toggleTambahDetail = (item: any) => {
  const idx = selectedTambahDetail.value.findIndex((s) => skuKey(s) === skuKey(item));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(item);
};

const allTambahDetailChecked = computed(() =>
  tambahDetailItems.value.length > 0 &&
  tambahDetailItems.value.every((s) => isTambahDetailSelected(s))
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const item of tambahDetailItems.value) {
      if (!isTambahDetailSelected(item)) selectedTambahDetail.value.push(item);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((s) => skuKey(s)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter((s) => !keys.has(skuKey(s)));
  }
};

const filteredTambahDetailItems = computed(() => {
  const q = tambahDetailSearch.value.toLowerCase().trim();
  if (!q) return tambahDetailItems.value;
  return tambahDetailItems.value.filter(
    (s) =>
      String(s.sku).toLowerCase().includes(q) ||
      String(s.namaBarang || "").toLowerCase().includes(q)
  );
});

const openTambahDetail = async () => {
  if (!form.value.gudang) {
    toast.warning("Pilih gudang terlebih dahulu.");
    return;
  }
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    // Daftar stok mengikuti gudang yang dipilih.
    tambahDetailItems.value = await penyesuaianStokFormApi.searchSKU(form.value.gudang, "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat stok.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Tambah banyak baris (reuse logika getDetailSKU + dup-guard selectSKU).
// Pencarian server-side (debounce) — SKU di luar batch awal tetap ketemu.
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    if (!form.value.gudang) return;
    tambahDetailLoading.value = true;
    try {
      tambahDetailItems.value = await penyesuaianStokFormApi.searchSKU(form.value.gudang, query);
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal mencari stok.");
    } finally {
      tambahDetailLoading.value = false;
    }
  }, 250);
};

const addSelectedTambahDetail = async () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const item of selectedTambahDetail.value) {
    // Dup-guard: SKU + expired yang sudah ada di detail di-skip diam-diam.
    if (form.value.detail.some((x) => x.sku === item.sku && (x.expired || "") === (item.expired || ""))) continue;
    try {
      const detail = await penyesuaianStokFormApi.getDetailSKU(
        form.value.gudang, item.sku, item.expired
      );
      const row = {
        no: form.value.detail.length + 1,
        sku: item.sku,
        namaBarang: detail.namaBarang,
        idBatch: detail.idbatch || "",
        satuan: detail.satuan,
        expired: item.expired || "",
        fisik: 0,
        system: Number(detail.stok) || 0,
        qty: 0,
        harga: Number(detail.hargabeli) || 0,
        nilai: 0,
        price: (Number(detail.hargabeli) || 0) * 2,
        nilaiPrice: 0,
      };
      hitungNilai(row as any);
      form.value.detail.push(row);
      added++;
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(e.response?.data?.message || `Gagal memuat detail SKU ${item.sku}.`);
    }
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  // Pola DO ("langsung ke qty"): fokus ke Fisik baris pertama yang baru (mode edit).
  if (added > 0) {
    nextTick(() => psEnterEdit(firstRow, "fisik"));
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Load Data All ────────────────────────────────────────────────────
const loadDataAll = async () => {
  if (!form.value.gudang) {
    toast.warning("Pilih gudang terlebih dahulu.");
    return;
  }
  try {
    const items = await penyesuaianStokFormApi.loadDataAll(form.value.gudang, form.value.tanggal);
    form.value.detail = items.map((item, i) => ({ ...item, no: i + 1 }));
    // Pola DO: sorot Fisik baris pertama — user langsung bisa koreksi.
    if (form.value.detail.length > 0) nextTick(() => psSetSelect(0, "fisik"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load data all.");
  }
};

// ── From Hitung Stok ─────────────────────────────────────────────────
const fromHitungStok = async () => {
  if (!form.value.gudang) {
    toast.warning("Pilih gudang terlebih dahulu.");
    return;
  }
  try {
    const items = await penyesuaianStokFormApi.fromHitungStok(form.value.gudang, form.value.tanggal);
    form.value.detail = items.map((item, i) => ({ ...item, no: i + 1 }));
    if (form.value.detail.length > 0) nextTick(() => psSetSelect(0, "fisik"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load dari hitung stok.");
  }
};

// ── From Excel ───────────────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null);

const fromExcel = () => {
  fileInputRef.value?.click();
};

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      form.value.detail = [];
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row[0]) continue;
        form.value.detail.push({
          no: form.value.detail.length + 1,
          sku: String(row[0]),
          namaBarang: String(row[1] || ""),
          idBatch: "",
          satuan: "PCS",
          expired: row[3] ? String(row[3]) : "",
          fisik: Number(row[2]) || 0,
          system: 0,
          qty: Number(row[2]) || 0,
          harga: Number(row[4]) || 0,
          nilai: Number(row[5]) || 0,
          price: 0,
          nilaiPrice: 0,
        });
      }
    } catch {
      toast.error("Gagal membaca file Excel.");
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = "";
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await penyesuaianStokFormApi.save(form.value);
    handlePostSave(action, String(form.value.nomor ?? ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif (urutan visual): sku (picker) → idBatch → expired (date,
// navigasi saja) → fisik ("qty"-nya koreksi stok) → harga.
const psCellId = (c: string, r: number) => `ps-cell-${c}-${r}`;

const psGrid = useDetailGrid({
  cols: ["sku", "idBatch", "expired", "fisik", "harga"],
  rowCount: () => form.value.detail.length,
  cellId: psCellId,
  cellPrefix: "ps-cell",
  onPicker: (r, c) => {
    if (c === "sku") openSKUModal(r);
  },
  typeEditCols: ["idBatch", "fisik", "harga"],
  onTypeEdit: (r, c, key) => {
    const el = document.getElementById(psCellId(c, r)) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    // expired = input date: fokus saja — biarkan native date picker bekerja.
    if (c === "expired") return;
    el.value = key;
    try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
});

const {
  focusCell: psFocusCell,
  gridBlur: psGridBlur,
  onGridCellFocus: psOnGridFocus,
  setSelect: psSetSelect,
  enterEdit: psEnterEdit,
} = psGrid;

const isActiveCell = (r: number, c: string) =>
  psFocusCell.value?.r === r && psFocusCell.value?.c === c;

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadGudang();
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Penyesuaian Stok' : 'Tambah Penyesuaian Stok Baru'"
    :icon="IconAdjustments"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="ps-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="ps-header-grid">
        <fieldset class="ps-groupbox">
          <legend class="ps-legend">Informasi Gudang</legend>
          <div class="ps-groupbody">
            <div class="f-row">
              <label class="f-lbl">Gudang <span class="req">*</span></label>
              <select v-model="form.gudang" class="f-inp">
                <option value="" disabled>-- Pilih Gudang --</option>
                <option v-for="g in gudangOptions" :key="g.kode" :value="g.kode">
                  {{ g.kode }} - {{ g.nama }}
                </option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Keterangan</label>
              <input v-model="form.keterangan" class="f-inp" placeholder="Keterangan..." />
            </div>
          </div>
        </fieldset>

        <fieldset class="ps-groupbox">
          <legend class="ps-legend">Informasi Transaksi</legend>
          <div class="ps-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ TOOLBAR ═══ -->
      <div class="ps-toolbar">
        <button class="btn-tool" type="button" @click="loadDataAll">
          <IconFileUpload :size="13" /> Load Data All
        </button>
        <button class="btn-tool" type="button" @click="fromExcel">
          <IconFileExcel :size="13" /> From Excel
        </button>
        <button class="btn-tool" type="button" @click="fromHitungStok">
          <IconFileUpload :size="13" /> From Hitung Stok
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls"
          style="display: none"
          @change="onFileChange"
        />
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="ps-groupbox ps-detail-group">
        <legend class="ps-legend">Detail Penyesuaian</legend>
        <div class="ps-detail-actions">
          <button class="btn-add-row" type="button" @click="openTambahDetail">
            <IconPlus :size="13" /> Tambah Detail
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 36px" class="tc">No</th>
                <th style="width: 90px">SKU</th>
                <th style="min-width: 180px">Nama Barang</th>
                <th style="width: 120px">IdBatch</th>
                <th style="width: 60px" class="tc">Satuan</th>
                <th style="width: 100px" class="tc">Expired</th>
                <th style="width: 70px" class="tr">Fisik</th>
                <th style="width: 80px" class="tr">Stok System</th>
                <th style="width: 80px" class="tr">Qty Koreksi</th>
                <th style="width: 90px" class="tr">Harga</th>
                <th style="width: 100px" class="tr">Nilai</th>
                <th style="width: 80px" class="tr">Price</th>
                <th style="width: 100px" class="tr">Nilai Price</th>
                <th style="width: 30px" class="tc"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc row-no">{{ idx + 1 }}</td>
                <td>
                  <div class="cell-search" :id="psCellId('sku', idx)" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                    <input :value="d.sku" class="cell-inp readonly-bg tc" readonly />
                    <button class="cell-btn" type="button" @click="openSKUModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td class="cell-muted">{{ d.namaBarang }}</td>
                <td><input v-model="d.idBatch" class="cell-inp" :id="psCellId('idBatch', idx)" :class="{ 'cell-active': isActiveCell(idx, 'idBatch') }" @focus="psOnGridFocus('idBatch', idx)" @blur="psGridBlur()" /></td>
                <td><input v-model="d.satuan" class="cell-inp tc readonly-bg" readonly /></td>
                <td><DsDatePicker v-model="d.expired" variant="cell" :id="psCellId('expired', idx)" @focus="psOnGridFocus('expired', idx)" @blur="psGridBlur()" /></td>
                <td>
                  <input type="text" inputmode="numeric" class="cell-inp tr" :id="psCellId('fisik', idx)" :class="{ 'cell-active': isActiveCell(idx, 'fisik') }" :value="getInputValue('fisik-' + idx, d.fisik, 0)" @focus="psOnGridFocus('fisik', idx); startEdit('fisik-' + idx, $event, d.fisik)" @input="onFisikInput($event, d, idx)" @blur="endEdit('fisik-' + idx, $event, d.fisik, 0); psGridBlur()" />
                </td>
                <td class="tr">{{ fmt(d.system) }}</td>
                <td class="tr">{{ fmt(d.qty) }}</td>
                <td>
                  <input type="text" inputmode="numeric" class="cell-inp tr" :id="psCellId('harga', idx)" :class="{ 'cell-active': isActiveCell(idx, 'harga') }" :value="getInputValue('harga-' + idx, d.harga, 2)" @focus="psOnGridFocus('harga', idx); startEdit('harga-' + idx, $event, d.harga)" @input="onHargaInput($event, d, idx)" @blur="endEdit('harga-' + idx, $event, d.harga, 2); psGridBlur()" />
                </td>
                <td class="tr">{{ fmt(d.nilai) }}</td>
                <td class="tr">{{ fmt(d.price) }}</td>
                <td class="tr">{{ fmt(d.nilaiPrice) }}</td>
                <td class="tc">
                  <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                    <IconTrash :size="12" />
                  </button>
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="14" class="empty-state">Belum ada detail. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH SKU ═══ -->
  <SearchModal
    v-model="showSKUModal"
    title="Pilih SKU"
    :columns="[
      { key: 'sku', title: 'SKU', width: '100px' },
      { key: 'expired', title: 'Expired', width: '100px', align: 'center' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'idbatch', title: 'IdBatch', width: '100px' },
      { key: 'stok', title: 'Stok', width: '80px', align: 'right' },
    ]"
    :items="skuOptions"
    :loading="skuLoading"
    :server-search="true"
    search-placeholder="Cari SKU..."
    @select="selectSKU"
    @search="searchSKU"
  />

  <!-- ═══ MODAL TAMBAH DETAIL (checklist SKU — pola DOFormView) ═══ -->
  <v-dialog v-model="showTambahDetailModal" max-width="680" scrollable>
    <v-card rounded="false">
      <v-card-title class="d-flex align-center pa-3" style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);">
        Tambah Detail
      </v-card-title>
      <v-card-text class="pa-3 pt-1">
        <div class="tb-search">
          <IconSearch :size="14" style="color: var(--ds-text-muted, #8494A7); flex-shrink: 0;" />
          <input
            v-model="tambahDetailSearch"
            type="text"
            class="tb-search-input"
            placeholder="Cari barang..."
            @input="onTambahDetailSearch(tambahDetailSearch)"
          />
        </div>
        <div v-if="tambahDetailLoading" class="modal-loading">Memuat...</div>
        <div v-else class="tb-table-wrap">
          <table class="modal-tbl">
            <thead>
              <tr>
                <th style="width: 30px" class="tc">
                  <input type="checkbox" :checked="allTambahDetailChecked" @change="toggleAllTambahDetail" />
                </th>
                <th style="width: 90px">SKU</th>
                <th>Nama Barang</th>
                <th style="width: 100px" class="tc">Expired</th>
                <th style="width: 80px" class="tr">Stok</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredTambahDetailItems" :key="skuKey(item)" class="modal-row" @click="toggleTambahDetail(item)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(item)" @change="toggleTambahDetail(item)" />
                </td>
                <td class="mono">{{ item.sku }}</td>
                <td>{{ item.namaBarang }}</td>
                <td class="tc">{{ item.expired || '-' }}</td>
                <td class="tr">{{ fmt(item.stok) }}</td>
              </tr>
              <tr v-if="filteredTambahDetailItems.length === 0">
                <td colspan="5" class="empty-state">Tidak ada barang yang cocok.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2 tb-actions">
        <span class="tb-count" v-if="selectedTambahDetail.length > 0">
          {{ selectedTambahDetail.length }} barang dipilih
        </span>
        <v-spacer />
        <v-btn variant="text" size="small" @click="showTambahDetailModal = false">Batal</v-btn>
        <v-btn size="small" color="primary" class="tb-add-btn" @click="addSelectedTambahDetail">
          Tambah ({{ selectedTambahDetail.length }})
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* ═══ Penyesuaian Stok Form — Steel Blue desktop ERP theme ═══ */

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.ps-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.ps-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.ps-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.ps-legend {
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

.ps-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group ────────────────────────────────────────────── */
.ps-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ps-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}

/* ── Toolbar ─────────────────────────────────────────────────── */
.ps-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  flex-shrink: 0;
}

.btn-tool {
  height: 26px;
  padding: 0 12px;
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

.btn-tool:hover {
  background: var(--ds-primary-dark, #0369a1);
}

/* ── Field Row ────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-lbl {
  width: 80px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.req { color: #c62828; }

/* ── Input (sunken desktop style) ─────────────────────────────── */
.f-inp {
  flex: 1;
  max-width: 400px;
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

/* ── Detail Table ─────────────────────────────────────────────── */
.detail-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
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

/* ── Zebra steel: baris bergantian dua nada biru muda (bukan putih)
   supaya field input putih menonjol sebagai area yang bisa diisi. ── */
.detail-table tbody tr:nth-child(odd) {
  background: #F0F3F8;
}

.detail-table tbody tr:nth-child(even) {
  background: #E4EBF4;
}

.detail-table tbody tr:hover td {
  background: #D8E2EF;
}

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.cell-muted {
  color: var(--ds-text, #0c4a6e);
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

/* ── Cell Input ───────────────────────────────────────────────── */
.cell-search {
  display: flex;
  gap: 2px;
}

.cell-inp {
  width: 100%;
  height: 20px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px;
  font-size: 11px;
  outline: none;
  background: white;
  box-sizing: border-box;
}

.cell-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}

.cell-inp.readonly-bg {
  cursor: default;
}

.cell-btn {
  height: 20px;
  width: 22px;
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

.cell-btn:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-add-row {
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
  gap: 3px;
  white-space: nowrap;
}

.btn-add-row:hover {
  background: var(--ds-primary-dark, #0369a1);
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
}

.btn-del:hover {
  background: #FEE2E2;
  color: #dc2626;
}

.tc { text-align: center; }
.tr { text-align: right; }

@media (max-width: 1024px) {
  .ps-header-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Modal Tambah Detail (checklist) ──────────────────────── */
.modal-loading {
  padding: 20px;
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 12px;
}

.modal-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.modal-tbl th {
  background: var(--ds-primary, #0284c7);
  color: white;
  font-weight: 700;
  padding: 5px 8px;
  text-align: left;
  white-space: nowrap;
}

.modal-tbl td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  white-space: nowrap;
}

.modal-row { cursor: pointer; }

.modal-row:hover td {
  background: var(--ds-primary-50, #E8EDF5);
}

.tb-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tb-search-input {
  flex: 1; height: 28px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: #fff;
}
.tb-search-input:focus { border-color: var(--ds-primary, #0284c7); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #0284c7); }
.tb-add-btn { border-radius: 0; text-transform: none; }

.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
</style>
