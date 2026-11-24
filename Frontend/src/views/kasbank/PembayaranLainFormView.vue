<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconCashOff, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  pembayaranLainFormApi,
  type PembayaranLainForm,
  type PembayaranLainDetail,
} from "@/api/kasbank/pembayaranLainFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const isLocked = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const blankForm = (): PembayaranLainForm => ({
  isEdit: false,
  nomor: "",
  tanggal: today,
  keterangan: "",
  nilai: 0,
  account: "",
  namaAccount: "",
  tipe: "KK",
  detail: [],
});
const form = ref<PembayaranLainForm>(blankForm());

// "Simpan & Baru": kosongkan form lalu ambil nomor transaksi baru.
const resetForm = () => {
  form.value = blankForm();
  isLocked.value = false;
  loadMaxNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Lookup Options ───────────────────────────────────────────────────
const accountOptions = ref<{ kode: string; nama: string }[]>([]);
const accountLoading = ref(false);
const costCenterOptions = ref<{ kode: string; nama: string }[]>([]);
const customerOptions = ref<{ kode: string; nama: string }[]>([]);
const customerLoading = ref(false);
const kendaraanOptions = ref<{ nopol: string; tipe: string }[]>([]);
const kendaraanLoading = ref(false);
const ekspedisiOptions = ref<{ id: string; nama: string }[]>([]);
const ekspedisiLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showAccountModal = ref(false);
const showAccountModalDetail = ref(false);
const showCustomerModal = ref(false);
const showKendaraanModal = ref(false);
const showEkspedisiModal = ref(false);
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
    const data = await pembayaranLainFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
    // Paritas Delphi: IsClosed = 'Sudah' → disable simpan
    isLocked.value = !!data.locked || route.query.locked === "1";
    if (isLocked.value) {
      toast.warning("Transaksi ini sudah tutup Periode,Tidak dapat di edit");
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data pembayaran lain.");
    router.push({ name: "pembayaranLainBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    // Paritas Delphi getmaxkode: prefix pakai KODE cabang (bukan nama)
    const cabang = authStore.cabangKode || "01";
    form.value.nomor = await pembayaranLainFormApi.getMaxNomor(
      form.value.tanggal,
      cabang,
      form.value.tipe
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const loadCostCenter = async () => {
  try {
    costCenterOptions.value = await pembayaranLainFormApi.searchCostCenter();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat cost center.");
  }
};

// False bila kode tidak ada di master (kode yatim di data lama).
const ccDikenal = (kode: string) =>
  !!kode && costCenterOptions.value.some((c: any) => c.kode === kode);

// ── Radio Kas/Bank ──────────────────────────────────────────────────
const onTipeChange = async () => {
  form.value.account = "";
  form.value.namaAccount = "";
  if (!form.value.isEdit) {
    await loadMaxNomor();
  }
};

// ── Search Account (Header) ──────────────────────────────────────────
const searchAccountHeader = async (query: string) => {
  accountLoading.value = true;
  try {
    accountOptions.value = await pembayaranLainFormApi.searchAccount(
      query || "",
      form.value.tipe
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari account.");
  } finally {
    accountLoading.value = false;
  }
};

const openAccountModal = () => {
  showAccountModal.value = true;
  searchAccountHeader("");
};

const selectAccountHeader = (item: any) => {
  form.value.account = item.kode;
  form.value.namaAccount = item.nama;
  showAccountModal.value = false;
};

// ── Search Account (Detail) ──────────────────────────────────────────
const searchAccountDetail = async (query: string) => {
  accountLoading.value = true;
  try {
    accountOptions.value = await pembayaranLainFormApi.searchAccount(query || "", form.value.tipe, "detail");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari account.");
  } finally {
    accountLoading.value = false;
  }
};

const openAccountModalDetail = (idx: number) => {
  activeDetailIndex.value = idx;
  showAccountModalDetail.value = true;
  searchAccountDetail("");
};

const selectAccountDetail = (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  form.value.detail[idx].account = item.kode;
  form.value.detail[idx].accountName = item.nama;
  showAccountModalDetail.value = false;
  // Pola DO ("langsung ke qty"): setelah account dipilih, lanjut ke input Nilai baris yang sama.
  nextTick(() => pblEnterEdit(idx, "nilai"));
};

// ── Search Customer ──────────────────────────────────────────────────
const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await pembayaranLainFormApi.searchCustomer(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari customer.");
  } finally {
    customerLoading.value = false;
  }
};

const openCustomerModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showCustomerModal.value = true;
  searchCustomer("");
};

const selectCustomer = (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  form.value.detail[idx].customer = item.kode;
  showCustomerModal.value = false;
};

// ── Search Kendaraan ─────────────────────────────────────────────────
const searchKendaraan = async (query: string) => {
  kendaraanLoading.value = true;
  try {
    kendaraanOptions.value = await pembayaranLainFormApi.searchKendaraan(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari kendaraan.");
  } finally {
    kendaraanLoading.value = false;
  }
};

const openKendaraanModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showKendaraanModal.value = true;
  searchKendaraan("");
};

const selectKendaraan = (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  form.value.detail[idx].kendaraan = item.nopol;
  showKendaraanModal.value = false;
};

// ── Search Ekspedisi ─────────────────────────────────────────────────
const searchEkspedisi = async (query: string) => {
  ekspedisiLoading.value = true;
  try {
    ekspedisiOptions.value = await pembayaranLainFormApi.searchEkspedisi(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari ekspedisi.");
  } finally {
    ekspedisiLoading.value = false;
  }
};

const openEkspedisiModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showEkspedisiModal.value = true;
  searchEkspedisi("");
};

const selectEkspedisi = (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;
  form.value.detail[idx].ekspedisi = item.id;
  form.value.detail[idx].ekspedisiNama = item.nama;
  showEkspedisiModal.value = false;
};

// ── Detail Grid ──────────────────────────────────────────────────────
const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Tambah Detail (dialog checklist account — pola DOFormView) ──────
const showTambahDetailModal = ref(false);
const tambahDetailItems = ref<{ kode: string; nama: string }[]>([]);
const tambahDetailLoading = ref(false);
const tambahDetailSearch = ref("");
const selectedTambahDetail = ref<{ kode: string; nama: string }[]>([]);

const accKey = (a: { kode: string }) => String(a.kode);

const isTambahDetailSelected = (acc: { kode: string; nama: string }) =>
  selectedTambahDetail.value.some((a) => accKey(a) === accKey(acc));

const toggleTambahDetail = (acc: { kode: string; nama: string }) => {
  const idx = selectedTambahDetail.value.findIndex((a) => accKey(a) === accKey(acc));
  if (idx >= 0) selectedTambahDetail.value.splice(idx, 1);
  else selectedTambahDetail.value.push(acc);
};

const allTambahDetailChecked = computed(() =>
  tambahDetailItems.value.length > 0 &&
  tambahDetailItems.value.every((a) => isTambahDetailSelected(a))
);

const toggleAllTambahDetail = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    for (const acc of tambahDetailItems.value) {
      if (!isTambahDetailSelected(acc)) selectedTambahDetail.value.push(acc);
    }
  } else {
    const keys = new Set(tambahDetailItems.value.map((a) => accKey(a)));
    selectedTambahDetail.value = selectedTambahDetail.value.filter((a) => !keys.has(accKey(a)));
  }
};

const filteredTambahDetailItems = computed(() => {
  const q = tambahDetailSearch.value.toLowerCase().trim();
  if (!q) return tambahDetailItems.value;
  return tambahDetailItems.value.filter(
    (a) =>
      String(a.kode).toLowerCase().includes(q) ||
      String(a.nama || "").toLowerCase().includes(q)
  );
});

const openTambahDetail = async () => {
  selectedTambahDetail.value = [];
  tambahDetailSearch.value = "";
  showTambahDetailModal.value = true;
  tambahDetailLoading.value = true;
  try {
    // Daftar akun detail: seluruh akun aktif (scope "detail"), bukan
    // hanya akun Kas/Bank seperti di kotak header.
    tambahDetailItems.value = await pembayaranLainFormApi.searchAccount("", form.value.tipe, "detail");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat account.");
  } finally {
    tambahDetailLoading.value = false;
  }
};

// Pencarian server-side (debounce) — account di luar batch awal tetap ketemu.
let tambahTimer: ReturnType<typeof setTimeout> | undefined;
const onTambahDetailSearch = (query: string) => {
  clearTimeout(tambahTimer);
  tambahTimer = setTimeout(async () => {
    tambahDetailLoading.value = true;
    try {
      tambahDetailItems.value = await pembayaranLainFormApi.searchAccount(query, form.value.tipe, "detail");
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error("Gagal mencari account.");
    } finally {
      tambahDetailLoading.value = false;
    }
  }, 250);
};

const addSelectedTambahDetail = () => {
  if (selectedTambahDetail.value.length === 0) {
    toast.warning("Pilih account dahulu.");
    return;
  }
  const firstRow = form.value.detail.length;
  let added = 0;
  for (const acc of selectedTambahDetail.value) {
    // Paritas Delphi (simpandata): tidak ada cek duplikat — akun sama boleh
    // masuk beberapa baris detail, setiap baris di-insert sendiri-sendiri.
    form.value.detail.push({
      no: form.value.detail.length + 1,
      account: acc.kode,
      accountName: acc.nama,
      nilai: 0,
      memo: "",
      costCenter: "",
      customer: "",
      kendaraan: "",
        kilometer: 0,
        ekspedisi: "",
        ekspedisiNama: "",
      });
    added++;
  }
  showTambahDetailModal.value = false;
  // Pola DO ("langsung ke qty"): fokus ke Nilai baris pertama yang baru (mode edit).
  if (added > 0) {
    nextTick(() => pblEnterEdit(firstRow, "nilai"));
  }
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif (urutan visual): akun (picker) → nilai → memo →
// costCenter (select) → customer (picker) → kendaraan (picker) →
// kilometer → ekspedisi (picker). Nama picker sesuai daftar useDetailGrid
// agar Enter langsung membuka modal pencarian.
const pblCellId = (c: string, r: number) => `pbl-cell-${c}-${r}`;

const pblGrid = useDetailGrid({
  cols: ["akun", "nilai", "memo", "costCenter", "customer", "kendaraan", "kilometer", "ekspedisi"],
  rowCount: () => form.value.detail.length,
  cellId: pblCellId,
  cellPrefix: "pbl-cell",
  onPicker: (r, c) => {
    if (c === "akun") openAccountModalDetail(r);
    else if (c === "customer") openCustomerModal(r);
    else if (c === "kendaraan") openKendaraanModal(r);
    else if (c === "ekspedisi") openEkspedisiModal(r);
  },
  typeEditCols: ["nilai", "memo", "costCenter", "kilometer"],
  onTypeEdit: (r, c, key) => {
    const d = form.value.detail[r];
    if (!d) return;
    const el = document.getElementById(pblCellId(c, r)) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    // costCenter = <select>: fokus saja — user pilih opsi lewat ketik native.
    if (c === "costCenter") return;
    if (c === "nilai") {
      rawInputValues[`nilai-${r}`] = key;
      el.value = key;
      d.nilai = Number(key) || 0;
    } else if (c === "memo") {
      el.value = key;
      d.memo = key;
    } else if (c === "kilometer") {
      rawInputValues[`kilometer-${r}`] = key;
      el.value = key;
      d.kilometer = Number(key) || 0;
    }
    try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
});

const {
  focusCell: pblFocusCell,
  gridBlur: pblGridBlur,
  onGridCellFocus: pblOnGridFocus,
  setSelect: pblSetSelect,
  enterEdit: pblEnterEdit,
} = pblGrid;

const isActiveCell = (r: number, c: string) =>
  pblFocusCell.value?.r === r && pblFocusCell.value?.c === c;

// ── Validasi ─────────────────────────────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  // Paritas Delphi: transaksi tutup periode tidak boleh disimpan
  if (isLocked.value) {
    toast.warning("Transaksi ini sudah tutup Periode,Tidak dapat di edit");
    return false;
  }
  // Paritas Delphi cxButton1/2Click: cekTutupPeriode sebelum simpan
  try {
    if (await pembayaranLainFormApi.cekPeriode(form.value.tanggal)) {
      toast.warning("Periode ini sudah di tutup.");
      return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
  }
  if (!form.value.account) {
    toast.warning("Account belum dipilih.");
    return false;
  }

  let totalDebet = 0;
  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.account) {
      toast.warning(`Account baris ${i + 1} belum dipilih.`);
      return false;
    }
    if (Number(d.nilai) > 0) {
      totalDebet += Number(d.nilai);
    }

    // Cek validasi khusus
    const cek = await pembayaranLainFormApi.cekBiaya(d.account);
    if (cek.needCostCenter && !d.costCenter) {
      toast.warning(`Costcenter Biaya belum di setting (baris ${i + 1}).`);
      return false;
    }
    if (cek.needCustomer && !d.customer) {
      toast.warning(`Customer Biaya UM DAN PROMOSI harus diisi (baris ${i + 1}).`);
      return false;
    }
    if (cek.needKendaraan && !d.kendaraan) {
      toast.warning(`Kendaraan harus diisi (baris ${i + 1}).`);
      return false;
    }
    // Kilometer boleh 0 bila ada kendaraan.
    if (cek.needEkspedisi && !d.ekspedisi) {
      toast.warning(`Ekspedisi harus diisi (baris ${i + 1}).`);
      return false;
    }
  }

  if (totalDebet !== Number(form.value.nilai)) {
    toast.warning("Nilai debet dan kredit tidak sama.");
    return false;
  }

  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await pembayaranLainFormApi.save(form.value);
    const nomor = res?.nomor || form.value.nomor;
    handlePostSave(action, nomor);
    toast.success("Data pembayaran lain berhasil disimpan.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadCostCenter();
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

// Total detail (hanya nilai > 0) — paritas cek saldo di validateSave.
const totalDetail = computed(() =>
  form.value.detail.reduce((s, d) => s + (Number(d.nilai) > 0 ? Number(d.nilai) : 0), 0),
);

// Nilai header selalu mengikuti total detail.
watch(totalDetail, (v) => {
  form.value.nilai = v;
}, { immediate: true });

// ── Formatted Number Input (same as DOFormView) ──────────────────────
const rawInputValues: Record<string, string> = {};

const getInputValue = (key: string, modelValue: number, decimals = 0) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startEdit = (key: string, e: Event, raw: number) => {
  // Pola DO (startQtyEdit): nilai 0 dikosongkan saat fokus, langsung ketik.
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

const onNilaiInput = (e: Event, d: any, idx: number, field: string) => {
  const el = e.target as HTMLInputElement;
  rawInputValues[field + '-' + idx] = el.value;
  d[field] = Number(el.value.replace(/,/g, '')) || 0;
};
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pembayaran Lain-Lain' : 'Tambah Pembayaran Lain-Lain Baru'"
    :icon="IconCashOff"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="pl-layout">
      <!-- ═══ HEADER ═══ -->
      <div class="pl-header-grid">
        <!-- Account Info -->
        <fieldset class="pl-groupbox">
          <legend class="pl-legend">Informasi Account</legend>
          <div class="pl-groupbody">
            <div class="f-row">
              <label class="f-lbl">Account <span class="req">*</span></label>
              <div class="search-group">
                <input :value="form.account" class="f-inp readonly-bg" readonly placeholder="Kode" />
                <input :value="form.namaAccount" class="f-inp readonly-bg" style="flex:2" readonly placeholder="Nama account..." />
                <button class="btn-search" type="button" @click="openAccountModal">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Memo</label>
              <input v-model="form.keterangan" class="f-inp" placeholder="Keterangan..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Nilai <span class="req">*</span></label>
              <input type="text" class="f-inp readonly-bg text-right" style="max-width:200px" :value="getInputValue('header-nilai', form.nilai, 0)" readonly />
            </div>
          </div>
        </fieldset>

        <!-- Transaksi Info -->
        <fieldset class="pl-groupbox">
          <legend class="pl-legend">Informasi Transaksi</legend>
          <div class="pl-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row check-row">
              <label class="radio-lbl">
                <input v-model="form.tipe" type="radio" value="KK" @change="onTipeChange" :disabled="isEdit" /> Kas
              </label>
              <label class="radio-lbl">
                <input v-model="form.tipe" type="radio" value="BK" @change="onTipeChange" :disabled="isEdit" /> Bank
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="pl-groupbox pl-detail-group">
        <legend class="pl-legend">Detail Pembayaran</legend>
        <div class="pl-detail-actions">
          <button class="btn-add-row" type="button" @click="openTambahDetail">
            <IconPlus :size="13" /> Tambah Detail
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 36px" class="tc">No</th>
                <th style="width: 95px">Account</th>
                <th style="min-width: 200px">Account Name</th>
                <th style="width: 120px" class="tr">Nilai</th>
                <th style="width: 200px">Keterangan</th>
                <th style="width: 120px">Cost Center</th>
                <th style="width: 130px">Customer</th>
                <th style="width: 80px">Kendaraan</th>
                <th style="width: 90px" class="tr">Kilometer</th>
                <th style="width: 100px">Ekspedisi</th>
                <th style="width: 30px" class="tc"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc row-no">{{ idx + 1 }}</td>
                <td>
                  <div class="cell-search" :id="pblCellId('akun', idx)" :class="{ 'cell-active': isActiveCell(idx, 'akun') }">
                    <input :value="d.account" class="cell-inp readonly-bg tc" readonly />
                    <button class="cell-btn" type="button" @click="openAccountModalDetail(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td class="cell-muted">{{ d.accountName }}</td>
                <td>
                  <input type="text" inputmode="numeric" class="cell-inp tr" :id="pblCellId('nilai', idx)" :class="{ 'cell-active': isActiveCell(idx, 'nilai') }" :value="getInputValue('nilai-' + idx, d.nilai, 0)" @focus="pblOnGridFocus('nilai', idx); startEdit('nilai-' + idx, $event, d.nilai)" @input="onNilaiInput($event, d, idx, 'nilai')" @blur="endEdit('nilai-' + idx, $event, d.nilai, 0); pblGridBlur()" />
                </td>
                <td><input v-model="d.memo" class="cell-inp" :id="pblCellId('memo', idx)" :class="{ 'cell-active': isActiveCell(idx, 'memo') }" @focus="pblOnGridFocus('memo', idx)" @blur="pblGridBlur()" /></td>
                <td>
                  <select v-model="d.costCenter" class="cell-inp" :id="pblCellId('costCenter', idx)" :class="{ 'cell-active': isActiveCell(idx, 'costCenter') }" @focus="pblOnGridFocus('costCenter', idx)" @blur="pblGridBlur()">
                    <option value="" disabled>-- Pilih --</option>
                    <!-- Kode yatim (tidak ada di tcostcenter) tetap ditampilkan sebagai
                         kode — tanpa ini select tampil kosong padahal isinya ada. -->
                    <option v-if="d.costCenter && !ccDikenal(d.costCenter)" :value="d.costCenter">{{ d.costCenter }}</option>
                    <option v-for="cc in costCenterOptions" :key="cc.kode" :value="cc.kode">
                      {{ cc.nama }}
                    </option>
                  </select>
                </td>
                <td>
                  <div class="cell-search" :id="pblCellId('customer', idx)" :class="{ 'cell-active': isActiveCell(idx, 'customer') }">
                    <input :value="d.customer" class="cell-inp readonly-bg" readonly placeholder="Customer..." />
                    <button class="cell-btn" type="button" @click="openCustomerModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td>
                  <div class="cell-search" :id="pblCellId('kendaraan', idx)" :class="{ 'cell-active': isActiveCell(idx, 'kendaraan') }">
                    <input :value="d.kendaraan" class="cell-inp readonly-bg" readonly placeholder="Nopol..." />
                    <button class="cell-btn" type="button" @click="openKendaraanModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td>
                  <input type="text" inputmode="numeric" class="cell-inp tr" :id="pblCellId('kilometer', idx)" :class="{ 'cell-active': isActiveCell(idx, 'kilometer') }" :value="getInputValue('kilometer-' + idx, d.kilometer, 0)" @focus="pblOnGridFocus('kilometer', idx); startEdit('kilometer-' + idx, $event, d.kilometer)" @input="onNilaiInput($event, d, idx, 'kilometer')" @blur="endEdit('kilometer-' + idx, $event, d.kilometer, 0); pblGridBlur()" />
                </td>
                <td>
                  <div class="cell-search" :id="pblCellId('ekspedisi', idx)" :class="{ 'cell-active': isActiveCell(idx, 'ekspedisi') }">
                    <input :value="d.ekspedisiNama || d.ekspedisi" class="cell-inp readonly-bg" readonly placeholder="Ekspedisi..." :title="d.ekspedisiNama || d.ekspedisi" />
                    <button class="cell-btn" type="button" @click="openEkspedisiModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td class="tc">
                  <button class="btn-del" type="button" title="Hapus baris" @click="removeRow(idx)">
                    <IconTrash :size="12" />
                  </button>
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="11" class="empty-state">Belum ada detail. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="footer-row">
                <td colspan="3" class="tc">TOTAL</td>
                <td class="tr">{{ getInputValue('total', totalDetail, 0) }}</td>
                <td colspan="7"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH ACCOUNT (HEADER) ═══ -->
  <SearchModal
    v-model="showAccountModal"
    title="Pilih Account"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Account' },
    ]"
    :items="accountOptions"
    :loading="accountLoading"
    :server-search="true"
    search-placeholder="Cari account..."
    @select="selectAccountHeader"
    @search="searchAccountHeader"
  />

  <!-- ═══ MODAL SEARCH ACCOUNT (DETAIL) ═══ -->
  <SearchModal
    v-model="showAccountModalDetail"
    title="Pilih Account"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Account' },
    ]"
    :items="accountOptions"
    :loading="accountLoading"
    :server-search="true"
    search-placeholder="Cari account..."
    @select="selectAccountDetail"
    @search="searchAccountDetail"
  />

  <!-- ═══ MODAL SEARCH CUSTOMER ═══ -->
  <SearchModal
    v-model="showCustomerModal"
    title="Pilih Customer"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Customer' },
    ]"
    :items="customerOptions"
    :loading="customerLoading"
    :server-search="true"
    search-placeholder="Cari customer..."
    @select="selectCustomer"
    @search="searchCustomer"
  />

  <!-- ═══ MODAL SEARCH KENDARAAN ═══ -->
  <SearchModal
    v-model="showKendaraanModal"
    title="Pilih Kendaraan"
    :columns="[
      { key: 'nopol', title: 'No. Polisi', width: '100px' },
      { key: 'tipe', title: 'Tipe', width: '100px' },
    ]"
    :items="kendaraanOptions"
    :loading="kendaraanLoading"
    :server-search="true"
    search-placeholder="Cari kendaraan..."
    @select="selectKendaraan"
    @search="searchKendaraan"
  />

  <!-- ═══ MODAL SEARCH EKSPEDISI ═══ -->
  <SearchModal
    v-model="showEkspedisiModal"
    title="Pilih Ekspedisi"
    :columns="[
      { key: 'id', title: 'ID', width: '100px' },
      { key: 'nama', title: 'Nama Ekspedisi' },
    ]"
    :items="ekspedisiOptions"
    :loading="ekspedisiLoading"
    :server-search="true"
    search-placeholder="Cari ekspedisi..."
    @select="selectEkspedisi"
    @search="searchEkspedisi"
  />

  <!-- ═══ MODAL TAMBAH DETAIL (checklist account — pola DOFormView) ═══ -->
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
            placeholder="Cari account..."
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
                <th style="width: 100px">Kode</th>
                <th>Nama Account</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="acc in filteredTambahDetailItems" :key="acc.kode" class="modal-row" @click="toggleTambahDetail(acc)">
                <td class="tc" @click.stop>
                  <input type="checkbox" :checked="isTambahDetailSelected(acc)" @change="toggleTambahDetail(acc)" />
                </td>
                <td class="mono">{{ acc.kode }}</td>
                <td>{{ acc.nama }}</td>
              </tr>
              <tr v-if="filteredTambahDetailItems.length === 0">
                <td colspan="3" class="empty-state">Tidak ada account yang cocok.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
      <v-card-actions class="pa-2 tb-actions">
        <span class="tb-count" v-if="selectedTambahDetail.length > 0">
          {{ selectedTambahDetail.length }} account dipilih
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
/* ═══ Pembayaran Lain Form — matches DOFormView / SOFormView ═══ */

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.pl-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.pl-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.pl-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.pl-legend {
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

.pl-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group ────────────────────────────────────────────── */
.pl-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pl-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
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

.text-right { text-align: right; }

/* ── Search Group ─────────────────────────────────────────────── */
.search-group {
  display: flex;
  flex: 1;
  max-width: 400px;
  gap: 2px;
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

.btn-search:hover {
  background: var(--ds-primary-dark, #0369a1);
}

/* ── Radio ────────────────────────────────────────────────────── */
.check-row {
  display: flex;
  gap: 16px;
}

.radio-lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  cursor: pointer;
}

.radio-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 14px;
  height: 14px;
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

/* Baris TOTAL beku di bawah grid — tetap terlihat saat detail di-scroll. */
.detail-table tfoot td {
  position: sticky;
  bottom: 0;
  background: var(--ds-primary-50, #E8EDF5);
}

.footer-row {
  font-weight: 700;
}

.footer-row td {
  padding: 2px 4px;
  border-top: 2px solid var(--ds-primary, #0284c7);
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
  .pl-header-grid {
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