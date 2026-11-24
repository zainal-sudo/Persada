<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import DsSelect from "@/components/DsSelect.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { IconArrowsExchange, IconSearch, IconPlus, IconTrash, IconFileUpload } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  mutasiGudangFormApi,
  type MutasiGudangForm,
  type MutasiGudangDetail,
} from "@/api/persediaan/mutasiGudangFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<MutasiGudangForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  gudangAsal: "",
  gudangTujuan: "",
  keterangan: "",
  detail: [],
});

// ── Lookup Options ───────────────────────────────────────────────────
const gudangOptions = ref<{ kode: string; nama: string }[]>([]);
const gudangSelectOptions = computed(() =>
  gudangOptions.value.map((g) => ({ value: g.kode, label: `${g.kode} - ${g.nama}` })),
);
const skuOptions = ref<any[]>([]);
const skuLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showSKUModal = ref(false);
const activeDetailIndex = ref(-1);

// ── Navigasi grid detail (ala Excel) — keyboard-first ────────────────
const mgCellId = (c: string, r: number) => `mg-cell-${c}-${r}`;
const mgGrid = useDetailGrid({
  cols: ["sku", "qty", "idBatch", "ket"],
  rowCount: () => form.value.detail.length,
  cellId: mgCellId,
  cellPrefix: "mg-cell",
  onPicker: (r, c) => {
    if (c === "sku") openSKUModal(r);
  },
  typeEditCols: ["qty"],
});

const {
  focusCell: mgFocusCell,
  editMode: mgEditMode,
  gridBlur: mgGridBlur,
  onGridCellFocus: mgOnGridFocus,
  setSelect: mgSetSelect,
  enterEdit: mgEnterEdit,
  commitEdit: mgCommitEdit,
} = mgGrid;

const isActiveCell = (r: number, c: string) =>
  mgFocusCell.value?.r === r && mgFocusCell.value?.c === c;

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
    const data = await mutasiGudangFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data mutasi gudang.");
    router.push({ name: "mutasiGudangBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    form.value.nomor = await mutasiGudangFormApi.getMaxNomor(form.value.tanggal);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor mutasi.");
  }
};

const loadGudang = async () => {
  try {
    gudangOptions.value = await mutasiGudangFormApi.getGudang();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data gudang.");
  }
};

// ── Validasi Gudang ──────────────────────────────────────────────────
const validateGudang = (): boolean => {
  if (form.value.gudangAsal === form.value.gudangTujuan) {
    toast.warning("Gudang Asal tidak boleh sama dengan Gudang Tujuan.");
    return false;
  }
  return true;
};

// ── Search SKU ───────────────────────────────────────────────────────
const searchSKU = async (query: string) => {
  if (!form.value.gudangAsal) {
    toast.warning("Pilih gudang asal terlebih dahulu.");
    return;
  }
  skuLoading.value = true;
  try {
    skuOptions.value = await mutasiGudangFormApi.searchSKU(form.value.gudangAsal, query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari SKU.");
  } finally {
    skuLoading.value = false;
  }
};

const openSKUModal = (idx: number) => {
  if (!form.value.gudangAsal) {
    toast.warning("Pilih gudang asal terlebih dahulu.");
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
    (d, i) => i !== idx && d.sku === item.sku && (d.idBatch || "") === (item.idBatch || item.idbatch || "")
  );
  if (duplicate) {
    toast.warning(`SKU dan Id Batch sudah ada di baris lain.`);
    return;
  }

  try {
    const detail = await mutasiGudangFormApi.getDetailSKU(
      form.value.gudangAsal,
      item.sku,
      item.expired
    );

    const d = form.value.detail[idx];
    d.sku = item.sku;
    d.expired = item.expired;
    d.namaBarang = detail.namaBarang;
    d.satuan = detail.satuan;
    d.idBatch = detail.idBatch || "";
    d.gudang = form.value.gudangAsal;

    showSKUModal.value = false;
    // Pola DO ("langsung ke qty"): setelah SKU dipilih, lanjut ke input Qty baris yang sama.
    nextTick(() => mgEnterEdit(idx, "qty"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat detail SKU.");
  }
};

// ── Validate Qty ─────────────────────────────────────────────────────
const validateQty = async (d: MutasiGudangDetail): Promise<boolean> => {
  if (!d.sku || !d.expired || !form.value.gudangAsal) return true;
  try {
    const stok = await mutasiGudangFormApi.getStok(form.value.gudangAsal, d.sku, d.expired);
    if (Number(d.qty) > stok) {
      toast.warning(`Qty melebihi Stok di Gudang (stok: ${stok}).`);
      d.qty = stok;
      return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return true;
  }
  return true;
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Tambah Detail (dialog checklist barang — pola Retur Penjualan) ──
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

// PK barang = kode barang + id batch
const batchKey = (b: any) => `${String(b.sku)}|${b.idBatch || b.idbatch || ""}`;

const isTambahDetailSelected = (brg: any) =>
  selectedTambahDetail.value.some((b) => batchKey(b) === batchKey(brg));

const toggleTambahDetail = (brg: any) => {
  const idx = selectedTambahDetail.value.findIndex((b) => batchKey(b) === batchKey(brg));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(brg);
};

const allTambahDetailChecked = computed(() =>
  tambahDetailItems.value.length > 0 &&
  tambahDetailItems.value.every((b) => isTambahDetailSelected(b))
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahDetailItems.value) {
      if (!isTambahDetailSelected(brg)) selectedTambahDetail.value.push(brg);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((b) => batchKey(b)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter((b) => !keys.has(batchKey(b)));
  }
};

const openTambahDetail = async () => {
  if (!form.value.gudangAsal) {
    toast.warning("Pilih gudang asal terlebih dahulu.");
    return;
  }
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await mutasiGudangFormApi.searchSKU(form.value.gudangAsal, "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

const onTambahDetailSearch = async (query: string) => {
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await mutasiGudangFormApi.searchSKU(form.value.gudangAsal, query);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

const addSelectedTambahDetail = () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  // PK barang = kode barang + id batch
  const existsKey = (sku: any, idBatch: any) => `${String(sku)}|${idBatch || ""}`;
  const existing = new Set(form.value.detail.map((d) => existsKey(d.sku, d.idBatch)));
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    const key = existsKey(brg.sku, brg.idBatch || brg.idbatch);
    if (existing.has(key)) continue;
    existing.add(key);
    form.value.detail.push({
      no: form.value.detail.length + 1,
      sku: String(brg.sku),
      namaBarang: brg.namaBarang || "",
      satuan: brg.satuan || "",
      qty: 0,
      expired: brg.expired || "",
      keterangan: "",
      gudang: form.value.gudangAsal,
      idBatch: brg.idBatch || brg.idbatch || "",
    });
    added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  // Pola DO ("langsung ke qty"): fokus ke Qty baris pertama yang baru (mode edit).
  if (added > 0) {
    nextTick(() => mgEnterEdit(firstRow, "qty"));
  }
};

// ── Load Data All ────────────────────────────────────────────────────
const loadDataAll = async () => {
  if (!form.value.gudangAsal) {
    toast.warning("Pilih gudang asal terlebih dahulu.");
    return;
  }

  try {
    const items = await mutasiGudangFormApi.loadDataAll(form.value.gudangAsal);
    form.value.detail = items.map((item, i) => ({
      ...item,
      no: i + 1,
    }));
    toast.success(`${items.length} data berhasil dimuat.`);
    // Pola DO: sorot Qty baris pertama — user langsung bisa mengisi.
    if (items.length > 0) nextTick(() => mgSetSelect(0, "qty"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal load data all.");
  }
};

// ── Reset ( utk aksi "Simpan & Baru" ) ────────────────────────────────
const resetForm = () => {
  form.value = { isEdit: false, nomor: "", tanggal: today, gudangAsal: "", gudangTujuan: "", keterangan: "", detail: [] };
  loadMaxNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Save (kontrak A: BaseForm emit save-action 'new' | 'close') ───────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;

  if (!form.value.gudangAsal) {
    toast.warning("Gudang Asal belum dipilih.");
    return;
  }
  if (!form.value.gudangTujuan) {
    toast.warning("Gudang Tujuan belum dipilih.");
    return;
  }
  if (!(await validateGudang())) return;

  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.sku || d.sku === "0") {
      toast.warning(`SKU Baris ${i + 1} belum dipilih.`);
      return;
    }
  }

  isSaving.value = true;
  try {
    await mutasiGudangFormApi.save(form.value);
    toast.success("Data mutasi gudang berhasil disimpan.");
    handlePostSave(action, String(form.value.nomor ?? ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadGudang();
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

// ── Formatted Number Input (same as DOFormView) ──────────────────────
// Qty TIDAK pakai type=number (ada spinner) dan TIDAK pakai v-model langsung
// (binding menimpa DOM value saat re-render). Pakai type=text +
// inputmode=numeric + rawInputValues: bebas ketik, format ribuan saat blur.
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

const onQtyInput = (e: Event, d: MutasiGudangDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["qty-" + idx] = el.value;
  d.qty = parseInput(el.value);
};
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Mutasi Gudang' : 'Tambah Mutasi Gudang Baru'"
    :icon="IconArrowsExchange"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="mg-form">
      <!-- ═══ HEADER ═══ -->
      <div class="mg-header-grid">
        <!-- Informasi Mutasi -->
        <fieldset class="mg-groupbox">
          <legend class="mg-legend">Informasi Mutasi</legend>
          <div class="mg-groupbody">
            <div class="f-row">
              <label class="f-lbl">Gudang Asal <span class="req">*</span></label>
              <DsSelect
                v-model="form.gudangAsal"
                :options="gudangSelectOptions"
                variant="form"
                placeholder="-- Pilih Gudang --"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Gudang Tujuan <span class="req">*</span></label>
              <DsSelect
                v-model="form.gudangTujuan"
                :options="gudangSelectOptions"
                variant="form"
                placeholder="-- Pilih Gudang --"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Keterangan</label>
              <input v-model="form.keterangan" class="f-inp" placeholder="Keterangan..." />
            </div>
          </div>
        </fieldset>

        <!-- Informasi Transaksi -->
        <fieldset class="mg-groupbox">
          <legend class="mg-legend">Informasi Transaksi</legend>
          <div class="mg-groupbody">
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

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="mg-groupbox mg-detail-group">
        <legend class="mg-legend">Detail Mutasi</legend>
        <div class="mg-detail-actions">
          <button class="btn-tool" type="button" @click="loadDataAll">
            <IconFileUpload :size="13" /> Load Data All
          </button>
          <button class="btn-add-row" type="button" @click="openTambahDetail">
            <IconPlus :size="12" /> Tambah Detail
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 36px" class="tc">No</th>
                <th style="width: 90px">SKU</th>
                <th style="min-width: 180px">Nama Barang</th>
                <th style="width: 70px" class="tr">QTY</th>
                <th style="width: 60px" class="tc">Satuan</th>
                <th style="width: 110px" class="tc">Id Batch</th>
                <th style="width: 100px" class="tc">Expired</th>
                <th style="width: 150px">Keterangan</th>
                <th style="width: 100px">Gudang Asal</th>
                <th style="width: 30px" class="tc"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc row-no">{{ idx + 1 }}</td>
                <td>
                  <div class="cell-search">
                    <input :value="d.sku" class="cell-inp tc readonly-bg" :id="mgCellId('sku', idx)" :class="{ 'cell-active': isActiveCell(idx, 'sku') }" readonly @focus="mgOnGridFocus('sku', idx)" @blur="mgGridBlur()" />
                    <button class="cell-btn" type="button" @click="openSKUModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td class="cell-muted">{{ d.namaBarang }}</td>
                <td>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="cell-inp tr"
                    :id="mgCellId('qty', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'qty') }"
                    :value="getInputValue('qty-' + idx, d.qty, 0)"
                    @focus="mgOnGridFocus('qty', idx); startEdit('qty-' + idx, $event, d.qty)"
                    @input="onQtyInput($event, d, idx)"
                    @blur="endEdit('qty-' + idx, $event, d.qty, 0); validateQty(d); mgGridBlur()"
                  />
                </td>
                <td class="tc">{{ d.satuan || '-' }}</td>
                <td><input v-model="d.idBatch" class="cell-inp" :id="mgCellId('idBatch', idx)" :class="{ 'cell-active': isActiveCell(idx, 'idBatch') }" @focus="mgOnGridFocus('idBatch', idx)" @blur="mgGridBlur()" /></td>
                <td class="tc">{{ d.expired || '-' }}</td>
                <td><input v-model="d.keterangan" class="cell-inp" :id="mgCellId('ket', idx)" :class="{ 'cell-active': isActiveCell(idx, 'ket') }" @focus="mgOnGridFocus('ket', idx)" @blur="mgGridBlur()" /></td>
                <td>{{ d.gudang || '-' }}</td>
                <td class="tc">
                  <button class="btn-del" type="button" @click="removeRow(idx)">
                    <IconTrash :size="12" />
                  </button>
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="10" class="tc empty-cell">Belum ada detail.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL TAMBAH DETAIL (checklist barang — pola Retur Penjualan) ═══ -->
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
                <th style="width: 80px">SKU</th>
                <th>Nama Barang</th>
                <th style="width: 70px" class="tc">Satuan</th>
                <th style="width: 90px" class="tr">Stok</th>
                <th style="width: 100px" class="tc">Id Batch</th>
                <th style="width: 100px" class="tc">Expired</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brg in tambahDetailItems" :key="brg.sku + '|' + (brg.idBatch || brg.idbatch || '')" class="modal-row" @click="toggleTambahDetail(brg)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.sku }}</td>
                <td>{{ brg.namaBarang }}</td>
                <td class="tc">{{ brg.satuan }}</td>
                <td class="tr">{{ fmt(brg.stok) }}</td>
                <td class="mono tc">{{ brg.idBatch || brg.idbatch || '-' }}</td>
                <td class="tc">{{ brg.expired || '-' }}</td>
              </tr>
              <tr v-if="tambahDetailItems.length === 0">
                <td colspan="7" class="empty-state">Tidak ada barang yang cocok.</td>
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

  <!-- ═══ MODAL SEARCH SKU ═══ -->
  <SearchModal
    v-model="showSKUModal"
    title="Pilih SKU"
    :columns="[
      { key: 'sku', title: 'SKU', width: '100px' },
      { key: 'expired', title: 'Expired', width: '100px', align: 'center' },
      { key: 'namaBarang', title: 'Nama Barang' },
      { key: 'idBatch', title: 'Id Batch', width: '100px' },
      { key: 'satuan', title: 'Satuan', width: '60px', align: 'center' },
      { key: 'stok', title: 'Stok', width: '80px', align: 'right' },
    ]"
    :items="skuOptions"
    :loading="skuLoading"
    :server-search="true"
    search-placeholder="Cari SKU..."
    @select="selectSKU"
    @search="searchSKU"
  />
</template>

<style scoped>
.mg-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.mg-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px; /* kanon DO/PS: groupbox utama + transaksi sempit */
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) — kanonik ala DO/SO/FP ─────────────── */
.mg-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}
.mg-legend {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  line-height: 1.4;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none;
  align-self: flex-start;
}
.mg-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group — kanonik ala DO/PS ────────────────────────── */
.mg-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.mg-detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
}

/* ── Form Fields — kanonik ala DO/SO/FP ──────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}
.f-lbl {
  width: 100px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}
.req { color: #c62828; font-weight: 700; }

.f-inp {
  flex: 1;
  min-width: 0;
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
.f-inp:focus { border-color: var(--ds-primary, #0284c7); }
.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

/* ── Buttons — kanonik ala DO/SO/FP ──────────────────────────── */
.btn-tool {
  height: 26px; padding: 0 12px;
  background: var(--ds-primary, #0284c7); color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.btn-tool:hover { background: var(--ds-primary-dark, #0369a1); }

.btn-add-row {
  height: 28px; padding: 0 14px;
  background: var(--ds-primary, #0284c7); color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 3px;
  white-space: nowrap;
}
.btn-add-row:hover { background: var(--ds-primary-dark, #0369a1); }

/* ── Detail Table ────────────────────────────────────── */
.detail-table-wrap {
  flex: 1; min-height: 0; overflow: auto;
  border-top: 1px solid var(--ds-border, #A0AAB8);
}

.detail-table {
  width: 100%; border-collapse: collapse; font-size: 11px;
  font-weight: 500;
}
.detail-table thead tr { background: var(--ds-primary, #0284c7); }
.detail-table th {
  color: white; font-weight: 700; padding: 4px 6px;
  white-space: nowrap; text-align: left;
  position: sticky; top: 0; z-index: 1;
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
  border-right: 1px solid var(--ds-primary-dark, #0369a1);
  border-bottom: 1px solid var(--ds-primary-dark, #0369a1);
}
.detail-table th:last-child { border-right: none; }
.detail-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle; white-space: nowrap;
}
.detail-table td:last-child { border-right: none; }

.row-no { color: var(--ds-text-muted, #8494A7); font-size: 10px; }

.cell-muted { color: var(--ds-text, #0c4a6e); font-weight: 600; }
/* ── Zebra steel: baris bergantian dua nada biru muda (bukan putih)
   supaya field input putih menonjol sebagai area yang bisa diisi. ── */
.detail-table tbody tr:nth-child(odd) { background: #F0F3F8; }
.detail-table tbody tr:nth-child(even) { background: #E4EBF4; }
.detail-table tbody tr:hover td { background: #D8E2EF; }

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.cell-search { display: flex; gap: 2px; }
.cell-inp {
  width: 100%; height: 20px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 3px; font-size: 11px; outline: none; box-sizing: border-box;
  background: white; /* kotak putih = bisa diisi — kontras dengan zebra steel */
}
.cell-inp:focus { border-color: var(--ds-primary, #0284c7); }

.cell-inp.readonly-bg { cursor: default; }

.cell-btn {
  height: 20px; width: 22px;
  background: var(--ds-primary, #0284c7); color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
}
.cell-btn:hover { background: var(--ds-primary-dark, #0369a1); }

.btn-del {
  background: none; border: none;
  color: var(--ds-text-muted, #8494A7); cursor: pointer;
  padding: 2px; border-radius: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-del:hover { background: #FEE2E2; color: #dc2626; }
.tc { text-align: center; }
.tr { text-align: right; }

@media (max-width: 1024px) {
  .mg-header-grid { grid-template-columns: 1fr; }
}

.empty-cell { color: #9e9e9e; font-style: italic; padding: 12px; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

/* ── Modal Tambah Detail (checklist) ──────────────────────── */
.tb-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tb-search-input {
  flex: 1; height: 28px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 8px; font-size: 12px; outline: none; background: #fff;
}
.tb-search-input:focus { border-color: var(--ds-primary, #0284c7); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th {
  background: var(--ds-primary, #0284c7); color: #fff; font-weight: 700;
  padding: 5px 8px; text-align: left; white-space: nowrap; position: sticky; top: 0;
}
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); font-style: italic; padding: 16px; }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #0284c7); }
.tb-add-btn { border-radius: 0; text-transform: none; }
</style>