<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconCash, IconSearch } from "@tabler/icons-vue";
import { bayarBiayaPromosiFormApi, type BayarBiayaPromosiForm, type BayarBiayaPromosiDetail } from "@/api/penjualan/bayarBiayaPromosiFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<BayarBiayaPromosiForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  cusKode: "",
  cusNama: "",
  alamat: "",
  rekKode: "",
  rekNama: "",
  nilai: 0,
  keterangan: "",
  detail: [],
});

// ── Options ──────────────────────────────────────────────────────────
const customerOptions = ref<any[]>([]);
const rekeningOptions = ref<any[]>([]);
const customerLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showCustomerModal = ref(false);
const showRekeningModal = ref(false);

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await bayarBiayaPromosiFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

// ── Load Options ─────────────────────────────────────────────────────
const loadOptions = async () => {
  try {
    rekeningOptions.value = await bayarBiayaPromosiFormApi.getRekening();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data rekening.");
  }
};

// ── Search Customer ──────────────────────────────────────────────────
const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await bayarBiayaPromosiFormApi.getCustomer(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari customer.");
  } finally {
    customerLoading.value = false;
  }
};

const selectCustomer = async (cust: any) => {
  form.value.cusKode = cust.kode;
  form.value.cusNama = cust.nama;
  form.value.alamat = cust.alamat || "";
  showCustomerModal.value = false;
  await loadInvoice();

  // Pola DOFormView: setelah invoice termuat, sorot sel Pay baris pertama —
  // user tinggal Space/Enter untuk centang (bayar auto terisi), panah ke
  // Bayar untuk koreksi. setSelect = sorot saja, TIDAK men-toggle.
  if (form.value.detail.length > 0) {
    nextTick(() => bybSetSelect(0, "pay"));
  }
};

const selectRekening = (rek: any) => {
  form.value.rekKode = rek.kode;
  form.value.rekNama = rek.nama;
  showRekeningModal.value = false;
};

// ── Load Invoice ─────────────────────────────────────────────────────
const loadInvoice = async () => {
  if (!form.value.cusKode) return;
  try {
    const data = await bayarBiayaPromosiFormApi.getInvoice(form.value.cusKode);
    form.value.detail = data;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

// ── Grid Handlers ────────────────────────────────────────────────────
const onPayChange = (d: BayarBiayaPromosiDetail) => {
  if (d.pay === 1) {
    d.bayar = d.biayaPromosi;
  } else {
    d.bayar = 0;
  }
};

// ── Detail column widths (shared by thead & tbody so they stay aligned) ──
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'invoice', width: 170 },
  { key: 'tanggal', width: 110 },
  { key: 'jthTempo', width: 110 },
  { key: 'biayaPromosi', width: 120 },
  { key: 'bayar', width: 140 },
  { key: 'pay', width: 50 },
  { key: 'status', width: null },   // takes the remaining width
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// ── Input System — bebas ketik seperti string, format saat blur ───
const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const rawInputValues: Record<string, string> = {};

const getInputValue = (key: string, modelValue: number, decimals = 2) => {
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

const endEdit = (key: string, e: Event, raw: number, decimals = 2) => {
  delete rawInputValues[key];
  (e.target as HTMLInputElement).value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(raw || 0);
};

const onValueInput = (key: string, e: Event, target: (v: number) => void) => {
  const el = e.target as HTMLInputElement;
  rawInputValues[key] = el.value;
  target(parseInput(el.value));
};

const onBayarInput = (e: Event, d: BayarBiayaPromosiDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['bayar-' + idx] = el.value;
  d.bayar = parseInput(el.value);
};

// ── Klik kanan baris invoice (paritas LihatFakturPenjualan1) ─────────
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxRow = ref<BayarBiayaPromosiDetail | null>(null);
let ctxCloseHandler: (() => void) | null = null;

const hideCtxMenu = () => {
  ctxVisible.value = false;
  ctxRow.value = null;
  if (ctxCloseHandler) {
    window.removeEventListener("click", ctxCloseHandler);
    window.removeEventListener("keydown", onCtxKeydown);
    ctxCloseHandler = null;
  }
};

const onCtxKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") hideCtxMenu();
};

const onRowContextMenu = (event: MouseEvent, d: BayarBiayaPromosiDetail) => {
  hideCtxMenu();
  ctxRow.value = d;
  ctxX.value = Math.min(event.clientX, window.innerWidth - 220);
  ctxY.value = Math.min(event.clientY, window.innerHeight - 120);
  ctxVisible.value = true;
  ctxCloseHandler = hideCtxMenu;
  window.addEventListener("click", ctxCloseHandler);
  window.addEventListener("keydown", onCtxKeydown);
};

const ctxLihatFaktur = () => {
  const inv = ctxRow.value?.invoice;
  hideCtxMenu();
  if (!inv) return;
  router.push({
    name: "fpEdit",
    params: { nomor: encodeURIComponent(inv) },
  });
};

// ── Overpay guard (paritas clBayarPropertiesValidate) ────────────────
// bayar tidak boleh melebihi sisa biaya promosi baris itu.
const bayarPreviousValue = ref(0);
const startBayarEdit = (idx: number, e: Event, d: BayarBiayaPromosiDetail) => {
  bayarPreviousValue.value = d.bayar;
  startEdit('bayar-' + idx, e, d.bayar);
};
const endBayarEdit = (idx: number, e: Event, d: BayarBiayaPromosiDetail) => {
  endEdit('bayar-' + idx, e, d.bayar);
  if (Number(d.bayar) > Number(d.biayaPromosi)) {
    toast.warning("Pembayaran melebihi kurang Bayar");
    d.bayar = bayarPreviousValue.value;
    (e.target as HTMLInputElement).value = getInputValue('bayar-' + idx, d.bayar);
  }
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif BYB hanya: bayar (input, aktif saat pay=1) dan pay
// (toggle checkbox). Urutan cols mengikuti urutan visual kolom tabel.
const bybCellId = (c: string, r: number) => `byb-cell-${c}-${r}`;

const bybTypeEdit = (r: number, c: string, key: string) => {
  if (c !== "bayar") return;
  const d = form.value.detail[r];
  if (!d) return;
  // Baris belum dicentang (input disabled) → alihkan sorotan ke kolom Pay.
  if (Number(d.pay) !== 1) {
    bybSetSelect(r, "pay");
    return;
  }
  bayarPreviousValue.value = d.bayar;
  const el = document.getElementById(bybCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`bayar-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const bybGrid = useDetailGrid({
  cols: ["bayar", "pay"],
  rowCount: () => form.value.detail.length,
  cellId: bybCellId,
  cellPrefix: "byb-cell",
  isToggle: (c) => c === "pay",
  onToggle: (r) => {
    const d = form.value.detail[r];
    if (!d) return;
    d.pay = Number(d.pay) === 1 ? 0 : 1;
    onPayChange(d); // pay=1 → bayar = biayaPromosi; pay=0 → bayar = 0
  },
  typeEditCols: ["bayar"],
  onTypeEdit: bybTypeEdit,
});

const {
  focusCell: bybFocusCell,
  gridBlur: bybGridBlur,
  onGridCellFocus: bybOnGridFocus,
  setSelect: bybSetSelect,
  enterEdit: bybEnterEdit,
} = bybGrid;

const isActiveCell = (r: number, c: string) =>
  bybFocusCell.value?.r === r && bybFocusCell.value?.c === c;

// ── Validasi Form (paritas cekdata) ──────────────────────────────────
// Total footer grid detail (paritas footer summary Delphi)
const totalBayar = computed(() =>
  form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0)
);
const selisihNilai = computed(() => totalBayar.value - Number(form.value.nilai || 0));

// ── Guard tanggal edit (paritas dtTanggalChange) ─────────────────────
// Nomor CB mengandung yymm (CABANG-CB.yymm.NNNN) — edit tidak boleh pindah
// bulan/tahun. Dokumen baru: regenerate nomor saat tanggal berubah.
const tanggalOld = ref("");
const onTanggalChange = () => {
  const nv = form.value.tanggal;
  if (!nv) return;
  if (!isEdit.value || !form.value.nomor) {
    tanggalOld.value = nv;
    loadNomor();
    return;
  }
  const yy = nv.slice(2, 4);
  const mm = nv.slice(5, 7);
  const prefix = form.value.nomor.slice(0, 6) + yy + mm + ".";
  if (prefix !== form.value.nomor.slice(0, 11)) {
    toast.warning("Perubahan tanggal tidak bisa beda bulan dan tahun.");
    form.value.tanggal = tanggalOld.value || nv;
  } else {
    tanggalOld.value = nv;
  }
};

const validateSave = (): boolean => {
  // 1. Customer
  if (!form.value.cusKode) {
    toast.warning("customer belum di pilih");
    return false;
  }
  // 2. Rekening
  if (!form.value.rekKode) {
    toast.warning("Rekening belum di pilih");
    return false;
  }
  // 3. Baris pay=1 → bayar > 0
  for (const d of form.value.detail) {
    if (d.pay === 1 && Number(d.bayar) === 0) {
      toast.warning("Pembayaran masih nol");
      return false;
    }
  }
  // 4. Balance toleransi 1 (BUKAN 10 seperti BayarCustomer)
  const totalDetail = form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0);
  const selisih = totalDetail - Number(form.value.nilai || 0);
  if (selisih > 1 || selisih < -1) {
    toast.warning(`Pembayaran dengan Total ${totalDetail} yang di bayar Beda ${form.value.nilai}`);
    return false;
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!validateSave()) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await bayarBiayaPromosiFormApi.save(form.value);
    const nomor = res.data.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

// ── Load Data Edit ───────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await bayarBiayaPromosiFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
    tanggalOld.value = form.value.tanggal;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "bayarBiayaPromosiBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    cusKode: "",
    cusNama: "",
    alamat: "",
    rekKode: "",
    rekNama: "",
    nilai: 0,
    keterangan: "",
    detail: [],
  };
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadOptions();
  await loadData();
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pembayaran Biaya Promosi' : 'Tambah Pembayaran Biaya Promosi Baru'"
    :icon="IconCash"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="byb-layout">
      <!-- ═══ HEADER (2 kolom sejajar) ═══ -->
      <div class="byb-header-grid">
        <!-- Customer Info -->
        <fieldset class="byb-groupbox">
          <legend class="byb-legend">Informasi Customer</legend>
          <div class="byb-groupbody">
            <div class="f-row">
              <label class="f-lbl">Customer</label>
              <div class="search-group">
                <input :value="form.cusKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.cusNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Customer..." />
                <button class="btn-search" type="button" @click="showCustomerModal = true; searchCustomer('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Alamat</label>
              <input :value="form.alamat" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Rekening</label>
              <div class="search-group">
                <input :value="form.rekKode" class="f-inp w-20 readonly-bg" readonly placeholder="Kode" />
                <input :value="form.rekNama" class="f-inp w-80 readonly-bg" readonly placeholder="Pilih Rekening..." />
                <button class="btn-search" type="button" @click="showRekeningModal = true">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Keterangan</label>
              <input v-model="form.keterangan" class="f-inp" />
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="byb-groupbox">
          <legend class="byb-legend">Informasi Order</legend>
          <div class="byb-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" @change="onTanggalChange" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Nilai</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp tr"
                :value="getInputValue('nilai', form.nilai)"
                @focus="startEdit('nilai', $event, form.nilai)"
                @input="onValueInput('nilai', $event, (v) => (form.nilai = v))"
                @blur="endEdit('nilai', $event, form.nilai)"
              />
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="byb-groupbox byb-detail-group">
        <legend class="byb-legend">Detail Invoice</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('invoice')">Invoice</th>
                  <th :style="detailColWidthStyle('tanggal')" class="tc">Tgl Faktur</th>
                  <th :style="detailColWidthStyle('jthTempo')" class="tc">Jth Tempo</th>
                  <th :style="detailColWidthStyle('biayaPromosi')" class="tr">Biaya Promosi</th>
                  <th :style="detailColWidthStyle('bayar')" class="tr">Bayar</th>
                  <th :style="detailColWidthStyle('pay')" class="tc">Pay</th>
                  <th :style="detailColWidthStyle('status')" class="tc">Status Bayar</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx" :class="{ 'row-ctx': ctxRow === d }" @contextmenu.prevent="onRowContextMenu($event, d)">
                  <td class="tc row-no" :style="detailColWidthStyle('no')">{{ idx + 1 }}</td>
                  <td class="mono" :style="detailColWidthStyle('invoice')">{{ d.invoice }}</td>
                  <td class="tc" :style="detailColWidthStyle('tanggal')">{{ d.tanggal }}</td>
                  <td class="tc" :style="detailColWidthStyle('jthTempo')">{{ d.jthTempo }}</td>
                  <td class="tr" :style="detailColWidthStyle('biayaPromosi')">{{ fmt(d.biayaPromosi) }}</td>
                  <td :style="detailColWidthStyle('bayar')">
                    <input
                      type="text"
                      inputmode="numeric"
                      class="cell-inp cell-inp-full tr"
                      :id="bybCellId('bayar', idx)"
                      :class="{ 'cell-active': isActiveCell(idx, 'bayar') }"
                      :disabled="d.pay !== 1"
                      :value="getInputValue('bayar-' + idx, d.bayar)"
                      @focus="bybOnGridFocus('bayar', idx); startBayarEdit(idx, $event, d)"
                      @input="onBayarInput($event, d, idx)"
                      @blur="endBayarEdit(idx, $event, d); bybGridBlur()"
                    />
                  </td>
                  <td class="tc" :id="bybCellId('pay', idx)" :class="{ 'cell-active': isActiveCell(idx, 'pay') }" :style="detailColWidthStyle('pay')">
                    <input v-model="d.pay" type="checkbox" :true-value="1" :false-value="0" @change="onPayChange(d)" />
                  </td>
                  <td class="tc" :style="detailColWidthStyle('status')">{{ d.status }}</td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="8" class="empty-state">
                    Pilih customer untuk memuat invoice.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Footer total bayar (paritas footer summary cxGrdMain Delphi) -->
          <div class="detail-footer">
            <span>Total Bayar: <strong>{{ fmt(totalBayar) }}</strong></span>
            <span :class="Math.abs(selisihNilai) > 1 ? 'selisih-bad' : 'selisih-ok'">
              Selisih dgn Nilai: <strong>{{ fmt(selisihNilai) }}</strong>
            </span>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODALS ═══ -->
  <SearchModal
    v-model="showCustomerModal"
    title="Pilih Customer"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Customer' },
      { key: 'alamat', title: 'Alamat' },
    ]"
    :items="customerOptions"
    :loading="customerLoading"
    :server-search="true"
    search-placeholder="Cari customer..."
    @select="selectCustomer"
    @search="searchCustomer"
  />

  <SearchModal
    v-model="showRekeningModal"
    title="Pilih Rekening"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Rekening' },
    ]"
    :items="rekeningOptions"
    search-placeholder="Cari rekening..."
    @select="selectRekening"
  />

  <!-- ── Context menu klik kanan baris invoice (paritas LihatFakturPenjualan1) ── -->
  <Teleport to="body">
    <div
      v-if="ctxVisible"
      class="ctx-menu"
      :style="{ left: ctxX + 'px', top: ctxY + 'px' }"
    >
      <button
        class="ctx-item"
        type="button"
        :disabled="!ctxRow?.invoice"
        @click="ctxLihatFaktur"
      >
        Lihat Faktur Penjualan
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   BAYAR BIAYA PROMOSI — Classic Desktop Layout (matches SO/DO/FP/BayarCustomer)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Context menu klik kanan (pola TabBar) ──────────────────────── */
.ctx-menu {
  position: fixed;
  z-index: 3000;
  background: white;
  border: 1px solid var(--ds-border, #A0AAB8);
  box-shadow: none;
  min-width: 190px;
  padding: 2px;
}
.ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ds-text, #0c4a6e);
}
.ctx-item:hover:not(:disabled) {
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #0284c7);
}
.ctx-item:disabled {
  color: var(--ds-text-muted, #8494A7);
  cursor: default;
}

/* Baris yang sedang di-klik-kanan (paritas fokus baris Delphi) */
:deep(.row-ctx td) {
  background: var(--ds-primary-50, #E8EDF5) !important;
}

/* ── Layout ──────────────────────────────────────────────────── */
.byb-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.byb-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.byb-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.byb-legend {
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

.byb-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.byb-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

/* ── Search Group ─────────────────────────────────────────────── */
.search-group {
  display: flex;
  flex: 1;
  max-width: 400px;
  gap: 2px;
}

.w-20 { width: 25%; flex: none !important; }
.w-80 { width: 75%; }

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

/* ── Detail Table ─────────────────────────────────────────────── */
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

.detail-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  padding: 5px 10px;
  border-top: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface-raised, #F0F3F8);
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.selisih-ok { color: var(--ds-success, #059669); }
.selisih-bad { color: var(--ds-error, #DC2626); }

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-weight: 500;
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

.detail-table-header-tbl {
  table-layout: fixed;
}

.detail-table-body-tbl {
  table-layout: fixed;
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

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
  white-space: normal;
}

/* ── Cell Input ───────────────────────────────────────────────── */
/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.cell-inp {
  width: 90px;
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

.cell-inp:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

.cell-inp-full {
  width: 100%;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
</style>