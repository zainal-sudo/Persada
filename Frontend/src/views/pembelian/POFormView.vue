<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconShoppingCart, IconSearch, IconPlus, IconTrash, IconHistory } from "@tabler/icons-vue";
import { poFormApi, type POForm, type PODetail } from "@/api/pembelian/poFormApi";
import DsDatePicker from "@/components/DsDatePicker.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useEscClose } from "@/composables/useEscClose";

const route = useRoute();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const attemptedSave = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<POForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  dateline: today,
  memo: "",
  pemesan: "",
  supKode: "",
  supNama: "",
  discFaktur: 0,
  discFakturPr: 0,
  amount: 0,
  taxAmount: 0,
  isTax: 1,
  detail: [],
});

// ── Field Error State ─────────────────────────────────────────────────
const supError = computed(() => attemptedSave.value && !form.value.supKode);

// ── Lookup Options ───────────────────────────────────────────────────
const supplierOptions = ref<any[]>([]);
const barangOptions = ref<any[]>([]);
const supplierLoading = ref(false);
const barangLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showSupplierModal = ref(false);
const showBarangModal = ref(false);
const activeDetailIndex = ref(-1);
const isAddRowMode = ref(false);

// ── Tambah Detail (dialog checklist barang — pola SOFormView) ────────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<any[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<any[]>([]);

const brgKey = (b: any) => String(b.kode);

const isTambahDetailSelected = (brg: any) =>
  selectedTambahDetail.value.some((b) => brgKey(b) === brgKey(brg));

const toggleTambahDetail = (brg: any) => {
  const idx = selectedTambahDetail.value.findIndex((b) => brgKey(b) === brgKey(brg));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(brg);
};

const allTambahDetailChecked = computed(
  () =>
    tambahDetailItems.value.length > 0 &&
    tambahDetailItems.value.every((b) => isTambahDetailSelected(b)),
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const brg of tambahDetailItems.value) {
      if (!isTambahDetailSelected(brg)) selectedTambahDetail.value.push(brg);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((b) => brgKey(b)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter(
      (b) => !keys.has(brgKey(b)),
    );
  }
};

const filteredTambahDetailItems = computed(() => {
  const q = tambahDetailSearch.value.toLowerCase().trim();
  if (!q) return tambahDetailItems.value;
  return tambahDetailItems.value.filter(
    (b) =>
      String(b.kode).toLowerCase().includes(q) ||
      String(b.nama || "").toLowerCase().includes(q),
  );
});

// Tambah satu baris (dup-guard: SKU sama sudah ada di detail).
const addBrgRow = (brg: any): boolean => {
  if (form.value.detail.some((x) => String(x.brgKode) === String(brg.kode))) return false;
  const harga = Number(brg.hargaBeli) || Number(brg.harga) || 0;
  form.value.detail.push({
    no: form.value.detail.length + 1,
    brgKode: brg.kode,
    brgNama: brg.nama,
    satuan: brg.satuan,
    qty: 1,
    harga: harga,
    discPr: 0,
    total: harga,
  });
  return true;
};

const openTambahDetail = async () => {
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    tambahDetailItems.value = await poFormApi.getBarang("");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat barang.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Pencarian server-side (debounce) — barang di luar batch awal tetap ketemu.
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    tambahDetailLoading.value = true;
    try {
      tambahDetailItems.value = await poFormApi.getBarang(query || "");
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal mencari barang.");
    } finally {
      tambahDetailLoading.value = false;
    }
  }, 250);
};

const addSelectedTambahDetail = () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih barang dahulu.");
    return;
  }
  let added = 0;
  for (const brg of selectedTambahDetail.value) {
    if (addBrgRow(brg)) added++;
  }
  if (!added) toast.warning("Barang terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  hitung();
};

// ── Riwayat Harga ────────────────────────────────────────────────────
const showRiwayatHargaModal = ref(false);
const riwayatHargaItems = ref<any[]>([]);
const riwayatHargaLoading = ref(false);
const riwayatHargaIndex = ref(-1);

// ── Hitung ────────────────────────────────────────────────────────────
const getAngkaPPN = (tanggal: string) => {
  const cutoff = new Date("2022-04-01");
  const t = tanggal ? new Date(tanggal) : new Date();
  return t >= cutoff ? 1.11 : 1.1;
};

const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum, d) => {
    const qty = Number(d.qty) || 0;
    const harga = Number(d.harga) || 0;
    const discPr = Number(d.discPr) || 0;
    return sum + (qty * harga * ((100 - discPr) / 100));
  }, 0);
});

const hitung = () => {
  const subtotal = subtotalBruto.value;
  const discPrValue = Number(form.value.discFakturPr) || 0;
  const discValue = Number(form.value.discFaktur) || 0;

  const totalDiscFaktur = (discPrValue / 100) * subtotal + discValue;
  const setelahDisc = subtotal - totalDiscFaktur;

  if (form.value.isTax === 1) {
    form.value.taxAmount = setelahDisc * (getAngkaPPN(form.value.tanggal) - 1);
    form.value.amount = setelahDisc * getAngkaPPN(form.value.tanggal);
  } else {
    form.value.taxAmount = 0;
    form.value.amount = setelahDisc;
  }
};

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await poFormApi.getNomor(form.value.tanggal, form.value.isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor PO.");
  }
};

// ── Lookup ────────────────────────────────────────────────────────────
const searchSupplier = async (query: string) => {
  supplierLoading.value = true;
  try {
    supplierOptions.value = await poFormApi.getSupplier(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari supplier.");
  } finally {
    supplierLoading.value = false;
  }
};

const searchBarang = async (query: string) => {
  barangLoading.value = true;
  try {
    barangOptions.value = await poFormApi.getBarang(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    barangLoading.value = false;
  }
};

// ── Select ────────────────────────────────────────────────────────────
const selectSupplier = (sup: any) => {
  form.value.supKode = sup.kode;
  form.value.supNama = sup.nama;
  showSupplierModal.value = false;
};

const openBarangModal = (idx: number) => {
  activeDetailIndex.value = idx;
  isAddRowMode.value = false;
  showBarangModal.value = true;
  searchBarang("");
};

const selectBarang = (brg: any) => {
  if (isAddRowMode.value) {
    const harga = Number(brg.hargaBeli) || Number(brg.harga) || 0;
    form.value.detail.push({
      no: form.value.detail.length + 1,
      brgKode: brg.kode,
      brgNama: brg.nama,
      satuan: brg.satuan,
      qty: 1,
      harga: harga,
      discPr: 0,
      total: harga,
    });
  } else {
    const idx = activeDetailIndex.value;
    if (idx < 0 || !form.value.detail[idx]) return;
    const d = form.value.detail[idx];
    d.brgKode = brg.kode;
    d.brgNama = brg.nama;
    d.satuan = brg.satuan;
    d.harga = Number(brg.hargaBeli) || Number(brg.harga) || 0;
    d.discPr = 0;
    d.total = d.qty * d.harga;
  }
  showBarangModal.value = false;
  hitung();
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
  hitung();
};

const updateRowTotal = (d: PODetail) => {
  d.total = (d.qty * d.harga * (100 - d.discPr)) / 100;
  hitung();
};

const openRiwayatHargaModal = async (idx: number) => {
  const d = form.value.detail[idx];
  if (!d.brgKode || !form.value.supKode) {
    toast.warning("Supplier dan barang harus dipilih dulu.");
    return;
  }
  riwayatHargaIndex.value = idx;
  showRiwayatHargaModal.value = true;
  riwayatHargaLoading.value = true;
  try {
    riwayatHargaItems.value = await poFormApi.getRiwayatHarga(
      d.brgKode,
      form.value.supKode,
      form.value.nomor
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat riwayat harga.");
  } finally {
    riwayatHargaLoading.value = false;
  }
};

const selectRiwayatHarga = (item: any) => {
  const idx = riwayatHargaIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  const d = form.value.detail[idx];
  d.harga = Number(item.Harga);
  d.discPr = Number(item.Disc) || 0;
  updateRowTotal(d);
  showRiwayatHargaModal.value = false;
};

// ── Format ────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtInt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Math.round(v || 0));

const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// ── Watch ─────────────────────────────────────────────────────────────
watch([() => form.value.tanggal, () => form.value.isTax], ([_, __]) => {
  if (!isEdit.value) {
    loadNomor();
  }
});

// ── Save ──────────────────────────────────────────────────────────────
const { handlePostSave } = useAfterSave({
  onReset: () => {
    form.value = {
      isEdit: false,
      nomor: "",
      tanggal: today,
      dateline: today,
      memo: "",
      pemesan: "",
      supKode: "",
      supNama: "",
      discFaktur: 0,
      discFakturPr: 0,
      amount: 0,
      taxAmount: 0,
      isTax: 1,
      detail: [],
    };
    attemptedSave.value = false;
    loadNomor();
  },
});
const onSubmit = async (action: "new" | "close" = "close") => {
  attemptedSave.value = true;
  if (!form.value.supKode || form.value.detail.length === 0) {
    toast.warning("Supplier dan minimal 1 baris detail wajib diisi.");
    return;
  }
  form.value.isEdit = isEdit.value;
  isSaving.value = true;
  try {
    await poFormApi.save(form.value);
    toast.success("PO berhasil disimpan.");
    handlePostSave(action, form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan PO.");
  } finally {
    isSaving.value = false;
  }
};

// ── Load Edit ─────────────────────────────────────────────────────────
onMounted(async () => {
  if (isEdit.value) {
    const nomor = String(route.params.nomor);
    isLoading.value = true;
    try {
      const data = await poFormApi.getDetailForm(nomor);
      form.value = { ...form.value, ...data, isEdit: true };
      form.value.isTax = Number(data.isTax) || 0;
      hitung();
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(e.response?.data?.message || "Gagal memuat data PO.");
    } finally {
      isLoading.value = false;
    }
  } else {
    loadNomor();
  }
});

// ── Detail Grid ──────────────────────────────────────────────────────
useDetailGrid({
  cols: ["kode", "qty", "harga", "discPr"],
  rowCount: () => form.value.detail.length,
  cellId: (c, r) => `po-${c}-${r}`,
  typeEditCols: ["qty", "harga", "discPr"],
});
</script>

<template>
  <BaseForm
    title="Purchase Order"
    :icon="IconShoppingCart"
    :is-loading="isLoading"
    :is-saving="isSaving"
    @save-action="onSubmit"
  >
    <div class="po-layout">
      <div class="po-header-grid">
        <fieldset class="po-groupbox">
          <legend class="po-legend">Informasi PO</legend>
          <div class="po-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" :disabled="isEdit" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Dateline</label>
              <DsDatePicker v-model="form.dateline" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Pemesan</label>
              <input v-model="form.pemesan" class="f-inp" placeholder="Nama pemesan" />
            </div>
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="3" placeholder="Keterangan PO..."></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset class="po-groupbox">
          <legend class="po-legend">Supplier &amp; Diskon</legend>
          <div class="po-groupbody">
            <div class="f-row" :class="{ 'field-error-row': supError }">
              <label class="f-lbl">Supplier</label>
              <div class="search-group">
                <input :value="form.supNama" class="f-inp readonly-bg" readonly placeholder="Pilih supplier..." />
                <button
                  class="btn-search"
                  type="button"
                  title="Pilih supplier"
                  @click="showSupplierModal = true; searchSupplier('')"
                >
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div v-if="supError" class="field-error-text">Supplier wajib dipilih.</div>
            <div class="f-row">
              <label class="f-lbl">Disc Faktur</label>
              <input
                :value="form.discFakturPr"
                type="text"
                inputmode="numeric"
                class="f-inp tr"
                @input="(e: any) => { form.discFakturPr = parseInput(e.target.value); hitung(); }"
              />
              <span class="calc-unit">%</span>
              <input
                :value="form.discFaktur"
                type="text"
                inputmode="numeric"
                class="f-inp tr"
                @input="(e: any) => { form.discFaktur = parseInput(e.target.value); hitung(); }"
              />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" @change="hitung" />
                PPN 11%
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <fieldset class="po-groupbox po-detail-group">
        <legend class="po-legend">Detail Barang</legend>
        <div class="detail-toolbar">
          <button class="btn-add" type="button" @click="openTambahDetail">
            <IconPlus :size="13" />
            Tambah Baris
          </button>
        </div>
      <div class="table-wrap">
        <table class="ds-tbl">
          <thead>
            <tr>
              <th style="width: 40px">No</th>
              <th style="width: 90px">SKU</th>
              <th style="min-width: 180px">Nama Barang</th>
              <th style="width: 90px" class="tc">Satuan</th>
              <th style="width: 110px" class="tr">Qty</th>
              <th style="width: 130px" class="tr">Harga</th>
              <th style="width: 90px" class="tr">Disc %</th>
              <th style="width: 150px" class="tr">Total</th>
              <th style="width: 70px" class="tc">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in form.detail" :key="idx">
              <td class="tc">{{ d.no }}</td>
              <td class="mono">{{ d.brgKode }}</td>
              <td>
                <div class="d-flex align-center">
                  <span class="text-truncate" style="max-width: 170px">{{ d.brgNama }}</span>
                  <v-btn
                    v-if="d.brgKode"
                    icon
                    size="x-small"
                    class="ms-1"
                    @click="openRiwayatHargaModal(idx)"
                    title="Riwayat Harga"
                  >
                    <IconHistory :size="12" />
                  </v-btn>
                </div>
              </td>
              <td class="tc">{{ d.satuan }}</td>
              <td>
                <input
                  v-model="d.qty"
                  type="number"
                  class="ds-cell-input tr"
                  @input="(e: any) => { d.qty = parseInput(e.target.value); updateRowTotal(d); }"
                />
              </td>
              <td>
                <input
                  v-model="d.harga"
                  type="text"
                  class="ds-cell-input tr"
                  @input="(e: any) => { d.harga = parseInput(e.target.value); updateRowTotal(d); }"
                />
              </td>
              <td>
                <input
                  v-model="d.discPr"
                  type="number"
                  class="ds-cell-input tr"
                  @input="(e: any) => { d.discPr = parseInput(e.target.value); updateRowTotal(d); }"
                />
              </td>
              <td class="tr bold accent">{{ fmt(d.total) }}</td>
              <td class="tc">
                <div class="d-flex justify-center gap-1">
                  <v-btn icon size="x-small" @click="openBarangModal(idx)">
                    <IconSearch :size="12" />
                  </v-btn>
                  <v-btn icon size="x-small" color="error" @click="removeRow(idx)">
                    <IconTrash :size="12" />
                  </v-btn>
                </div>
              </td>
            </tr>
            <tr v-if="form.detail.length === 0">
              <td colspan="9" class="empty-td">Belum ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>

      </fieldset>

      <div class="po-footer-grid">
        <fieldset class="po-groupbox">
          <legend class="po-legend">Perhitungan</legend>
          <div class="po-groupbody calc-body">
            <div class="calc-row">
              <label class="calc-lbl">Subtotal</label>
              <span class="calc-val">{{ fmt(subtotalBruto) }}</span>
            </div>
            <div class="calc-row">
              <label class="calc-lbl">Disc Faktur</label>
              <span class="calc-val">{{ fmt((form.discFakturPr / 100) * subtotalBruto + form.discFaktur) }}</span>
            </div>
            <div class="calc-row">
              <label class="calc-lbl">PPN</label>
              <span class="calc-val calc-val-muted">{{ fmt(form.taxAmount) }}</span>
            </div>
            <div class="calc-row calc-total-row">
              <label class="calc-lbl calc-lbl-total">TOTAL</label>
              <span class="calc-val-total">{{ fmt(form.amount) }}</span>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </BaseForm>

  <SearchModal
    v-model="showSupplierModal"
    title="Pilih Supplier"
    :items="supplierOptions"
    :loading="supplierLoading"
    :columns="[
      { key: 'kode', title: 'Kode' },
      { key: 'nama', title: 'Nama' },
      { key: 'alamat', title: 'Alamat' },
    ]"
    :server-search="true"
    search-placeholder="Cari supplier..."
    @search="searchSupplier"
    @select="selectSupplier"
  />

  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang"
    :items="barangOptions"
    :loading="barangLoading"
    :columns="[
      { key: 'kode', title: 'Kode' },
      { key: 'nama', title: 'Nama' },
      { key: 'satuan', title: 'Satuan' },
    ]"
    :server-search="true"
    search-placeholder="Cari barang..."
    @search="searchBarang"
    @select="selectBarang"
  />

  <v-dialog v-model="showTambahDetailModal" max-width="680" scrollable>
    <v-card rounded="false">
      <v-card-title
        class="d-flex align-center pa-3"
        style="font-size: 13px; font-weight: 700; border-top: 3px solid var(--ds-primary, #0284c7);"
      >
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
                <th style="width: 90px">Kode</th>
                <th>Nama Barang</th>
                <th style="width: 70px" class="tc">Satuan</th>
                <th style="width: 110px" class="tr">Harga Beli</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="brg in filteredTambahDetailItems"
                :key="brg.kode"
                class="modal-row"
                @click="toggleTambahDetail(brg)"
              >
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(brg)" @change="toggleTambahDetail(brg)" />
                </td>
                <td class="mono">{{ brg.kode }}</td>
                <td>{{ brg.nama }}</td>
                <td class="tc">{{ brg.satuan }}</td>
                <td class="tr">{{ fmt(Number(brg.hargaBeli) || Number(brg.harga) || 0) }}</td>
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

  <v-dialog v-model="showRiwayatHargaModal" max-width="700" persistent>
    <v-card rounded="false">
      <v-card-title class="ds-title">Riwayat Harga</v-card-title>
      <v-card-text class="pa-3">
        <div v-if="riwayatHargaLoading" class="py-3 text-center">
          <v-progress-circular indeterminate size="18" />
        </div>
        <table v-else class="ds-tbl compact">
          <thead>
            <tr>
              <th>Nomor PO</th>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th class="tr">Harga</th>
              <th class="tr">Disc %</th>
              <th class="tc">Pilih</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in riwayatHargaItems" :key="idx">
              <td class="mono">{{ item.Nomor }}</td>
              <td>{{ item.Tanggal }}</td>
              <td>{{ item.Supplier }}</td>
              <td class="tr">{{ fmtInt(item.Harga) }}</td>
              <td class="tr">{{ item.Disc }}</td>
              <td class="tc">
                <v-btn size="x-small" @click="selectRiwayatHarga(item)">Pilih</v-btn>
              </td>
            </tr>
            <tr v-if="riwayatHargaItems.length === 0">
              <td colspan="6" class="empty-td">Tidak ada riwayat.</td>
            </tr>
          </tbody>
        </table>
      </v-card-text>
      <v-card-actions class="pa-2">
        <v-spacer />
        <v-btn size="small" variant="outlined" @click="showRiwayatHargaModal = false">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* ── Layout utama ── */
.po-layout { display: flex; flex-direction: column; gap: 6px; padding: 6px; height: 100%; overflow: hidden; }
.po-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; }
.po-groupbox { border: 1px solid var(--ds-border, #A0AAB8); padding: 0; margin: 0; display: flex; flex-direction: column; min-width: 0; background: white; }
.po-legend { font-size: 11px; font-weight: 700; color: var(--ds-primary, #0284c7); text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 6px; margin-left: 6px; background: var(--ds-surface, #F0F3F8); border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none; align-self: flex-start; line-height: 1.4; }
.po-groupbody { padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.po-detail-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }

/* ── Baris field ── */
.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-row-top { align-items: flex-start; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.search-group { display: flex; flex: 1; gap: 2px; }
.f-inp { flex: 1; min-width: 0; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; background: white; color: #1f2937; }
.f-inp:focus, .f-txa:focus { outline: none; border-color: var(--ds-primary, #0284c7); }
.f-inp.tr { text-align: right; font-variant-numeric: tabular-nums; }
.readonly-bg { background: var(--ds-surface-inset, #E0E4EA); }
.btn-search { height: 24px; width: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); cursor: pointer; }
.btn-search:hover { background: var(--ds-primary-dark, #0369a1); }
.f-txa { flex: 1; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 4px 5px; font-size: 11px; resize: vertical; font-family: inherit; }
.check-row { display: flex; gap: 12px; }
.check-lbl { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; cursor: pointer; }
.check-lbl input { accent-color: var(--ds-primary, #0284c7); }
.calc-unit { font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); }
.field-error-row .f-inp { border-color: #d32f2f !important; }
.field-error-text { color: #d32f2f; font-size: 10px; font-weight: 600; margin-top: -2px; }

/* ── Detail toolbar ── */
.detail-toolbar { display: flex; justify-content: flex-end; padding: 6px 8px 0; }
.btn-add { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px; font-size: 11px; font-weight: 600; color: white; background: var(--ds-primary, #0284c7); border: 1px solid var(--ds-primary-dark, #0369a1); cursor: pointer; }
.btn-add:hover { background: var(--ds-primary-dark, #0369a1); }

/* ── Tabel detail ── */
.table-wrap { flex: 1; min-height: 0; margin: 6px 8px 8px; border: 1px solid var(--ds-border, #A0A8B8); overflow: auto; }
.ds-tbl { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 500; }
.ds-tbl thead th { position: sticky; top: 0; z-index: 1; background: var(--ds-primary, #0284c7); color: white; font-weight: 700; padding: 5px 6px; font-size: 10px; text-transform: uppercase; text-align: left; white-space: nowrap; border-right: 1px solid var(--ds-primary-dark, #0369a1); }
.ds-tbl td { padding: 3px 5px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); border-right: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.ds-tbl tbody tr:nth-child(odd) { background: #F0F3F8; }
.ds-tbl tbody tr:nth-child(even) { background: #E4EBF4; }
.ds-tbl tbody tr:hover td { background: #D8E2EF; }
.ds-tbl.compact th, .ds-tbl.compact td { padding: 3px 5px; }
.ds-cell-input { width: 100%; height: 22px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 4px; font-size: 11px; background: white; }
.ds-cell-input:focus { outline: none; border-color: var(--ds-primary, #0284c7); }

/* ── Footer perhitungan ── */
.po-footer-grid { display: flex; justify-content: flex-end; flex-shrink: 0; }
.po-footer-grid .po-groupbox { width: 340px; }
.calc-body { padding: 6px 8px; gap: 3px; }
.calc-row { display: flex; align-items: center; gap: 4px; }
.calc-lbl { width: 90px; font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); }
.calc-val { margin-left: auto; font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; }
.calc-val-muted { color: var(--ds-text-secondary, #5A6A7E); }
.calc-total-row { border-top: 1px solid var(--ds-border-light, #C4CAD3); padding-top: 4px; margin-top: 2px; }
.calc-lbl-total { font-weight: 700; color: #1f2937; }
.calc-val-total { margin-left: auto; font-weight: 700; font-size: 13px; color: var(--ds-primary, #0284c7); font-variant-numeric: tabular-nums; }

/* ── Bersama ── */
.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
.mono { font-family: monospace; font-size: 10px; }
.empty-td { text-align: center; color: #9ca3af; font-style: italic; padding: 12px; }

/* ── Dialog Tambah Detail (pola SOFormView) ── */
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
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th {
  background: var(--ds-primary, #0284c7); color: white; font-weight: 700;
  padding: 5px 8px; text-align: left; white-space: nowrap;
}
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 11px; padding: 24px 12px; white-space: normal; }

@media (max-width: 1100px) {
  .po-header-grid { grid-template-columns: 1fr; }
  .po-footer-grid .po-groupbox { width: 100%; }
}
</style>
