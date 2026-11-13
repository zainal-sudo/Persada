<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconCash, IconSearch } from "@tabler/icons-vue";
import { bayarCustomerFormApi, type BayarCustomerForm, type BayarCustomerDetail } from "@/api/penjualan/bayarCustomerFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAuthStore } from "@/stores/authStore";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

// Paritas Delphi refreshdata: chkPPH hanya aktif untuk FINANCE/PIUTANG
const isFinanceRole = computed(() =>
  ["FINANCE", "PIUTANG"].includes(authStore.userKode.toUpperCase())
);

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<BayarCustomerForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  cusKode: "",
  cusNama: "",
  alamat: "",
  memo: "",
  isTax: 1,
  cash: 0,
  rekCash: "",
  rekCashNama: "",
  transfer: 0,
  rekTransfer: "",
  rekTransferNama: "",
  potongan: 0,
  rekPotongan: "",
  rekPotonganNama: "",
  giro: 0,
  rekGiro: "",
  rekGiroNama: "",
  noGiro: "",
  tglCair: today,
  ppn: 0,
  rekPPN: "",
  rekPPNNama: "",
  pph: 0,
  rekPPH: "",
  rekPPHNama: "",
  ntpn: "",
  detail: [],
});

// ── Checkbox State ───────────────────────────────────────────────────
const chkCash = ref(false);
const chkTransfer = ref(false);
const chkPotongan = ref(false);
const chkGiro = ref(false);
const chkPPN = ref(false);
const chkPPH = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showCustomerModal = ref(false);
const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);

// ── Rekening Options ─────────────────────────────────────────────────
const rekCashOptions = ref<any[]>([]);
const rekTransferOptions = ref<any[]>([]);
const rekPotonganOptions = ref<any[]>([]);
const rekGiroOptions = ref<any[]>([]);
const rekPPNOptions = ref<any[]>([]);
const rekPPHOptions = ref<any[]>([]);

const showRekCashModal = ref(false);
const showRekTransferModal = ref(false);
const showRekPotonganModal = ref(false);
const showRekGiroModal = ref(false);
const showRekPPNModal = ref(false);
const showRekPPHModal = ref(false);

// ── Load Nomor ───────────────────────────────────────────────────────
const loadNomor = async () => {
  try {
    const res = await bayarCustomerFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

// ── Load Options ─────────────────────────────────────────────────────
const loadOptions = async () => {
  try {
    const [cash, transfer, potongan, giro, ppn, pph] = await Promise.all([
      bayarCustomerFormApi.getRekening("cash"),
      bayarCustomerFormApi.getRekening("transfer"),
      bayarCustomerFormApi.getRekening("potongan"),
      bayarCustomerFormApi.getRekening("giro"),
      bayarCustomerFormApi.getRekening("ppn"),
      bayarCustomerFormApi.getRekening("pph"),
    ]);
    rekCashOptions.value = cash;
    rekTransferOptions.value = transfer;
    rekPotonganOptions.value = potongan;
    rekGiroOptions.value = giro;
    rekPPNOptions.value = ppn;
    rekPPHOptions.value = pph;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data rekening.");
  }
};

// ── Search Customer ──────────────────────────────────────────────────
const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await bayarCustomerFormApi.getCustomer(query || "");
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

  // Load invoice
  await loadInvoice();

  // Pola DOFormView: setelah invoice termuat, sorot sel Pay baris pertama —
  // user tinggal Space/Enter untuk centang (bayar auto terisi), panah ke
  // Bayar untuk koreksi. setSelect = sorot saja, TIDAK men-toggle.
  if (form.value.detail.length > 0) {
    nextTick(() => bycSetSelect(0, "pay"));
  }
};

// ── Load Invoice ─────────────────────────────────────────────────────
const loadInvoice = async () => {
  if (!form.value.cusKode) return;
  try {
    const data = await bayarCustomerFormApi.getInvoice(form.value.cusKode, form.value.isTax);
    form.value.detail = data;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

// ── Checkbox Handlers ────────────────────────────────────────────────
// Nama rekening ikut dibersihkan: kalau tidak, nama rekening lama akan
// tetap tampil padahal kodenya sudah dikosongkan.
const onChkCash = () => {
  if (!chkCash.value) {
    form.value.cash = 0;
    form.value.rekCash = "";
    form.value.rekCashNama = "";
  }
};
const onChkTransfer = () => {
  if (!chkTransfer.value) {
    form.value.transfer = 0;
    form.value.rekTransfer = "";
    form.value.rekTransferNama = "";
  }
};
const onChkPotongan = () => {
  if (!chkPotongan.value) {
    form.value.potongan = 0;
    form.value.rekPotongan = "";
    form.value.rekPotonganNama = "";
  }
};
const onChkGiro = () => {
  if (!chkGiro.value) {
    form.value.giro = 0;
    form.value.rekGiro = "";
    form.value.rekGiroNama = "";
  }
};
const onChkPPN = () => {
  if (!chkPPN.value) {
    form.value.ppn = 0;
    form.value.rekPPN = "";
    form.value.rekPPNNama = "";
  }
};
const onChkPPH = () => {
  if (!chkPPH.value) {
    form.value.pph = 0;
    form.value.rekPPH = "";
    form.value.rekPPHNama = "";
  }
};

// ── Detail column widths (shared by thead & tbody so they stay aligned) ──
const DETAIL_COL_WIDTHS = [
  { key: 'no', width: 36 },
  { key: 'salesman', width: 100 },
  { key: 'invoice', width: 150 },
  { key: 'tanggal', width: 90 },
  { key: 'jthTempo', width: 90 },
  { key: 'retur', width: 70 },
  { key: 'ppn', width: 90 },
  { key: 'nilai', width: 130 },
  { key: 'terbayar', width: 90 },
  { key: 'bayar', width: 120 },
  { key: 'pay', width: 40 },
  { key: 'net', width: 110 },
  { key: 'memo', width: null },   // takes the remaining width
] as const;

const detailColWidthStyle = (key: typeof DETAIL_COL_WIDTHS[number]['key']) => {
  const col = DETAIL_COL_WIDTHS.find(c => c.key === key);
  if (!col || col.width == null) return {};
  return { width: col.width + 'px' };
};

// ── Formatting & Parse ───────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const formatCurrency = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// ── Input System — bebas ketik seperti string, format saat blur ───
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

// ── Input Handlers (header pembayaran) ───────────────────────────────
const onValueInput = (key: string, e: Event, target: (v: number) => void) => {
  const el = e.target as HTMLInputElement;
  rawInputValues[key] = el.value;
  target(parseInput(el.value));
};

// ── Grid Handlers ────────────────────────────────────────────────────
const onPayChange = (d: BayarCustomerDetail) => {
  if (d.pay === 1) {
    d.bayar = d.nilai - d.terbayar;
  } else {
    d.bayar = 0;
  }
};

// ── Klik kanan baris invoice (paritas LihatFakturPenjualan1) ─────────
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxRow = ref<BayarCustomerDetail | null>(null);
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

const onRowContextMenu = (event: MouseEvent, d: BayarCustomerDetail) => {
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

const onBayarInput = (e: Event, d: BayarCustomerDetail, idx: number) => {
  const el = e.target as HTMLInputElement;
  rawInputValues['bayar-' + idx] = el.value;
  d.bayar = parseInput(el.value);
};

// ── Validasi bayar per baris (paritas clBayarPropertiesValidate) ─────
const bayarPreviousValue = ref(0);

const startBayarEdit = (idx: number, e: Event, d: BayarCustomerDetail) => {
  bayarPreviousValue.value = d.bayar;
  startEdit('bayar-' + idx, e, d.bayar);
};

const endBayarEdit = (idx: number, e: Event, d: BayarCustomerDetail) => {
  endEdit('bayar-' + idx, e, d.bayar);
  // Paritas Delphi: bayar + terbayar tidak boleh melebihi nilai invoice
  if (Number(d.bayar) + Number(d.terbayar) > Number(d.nilai)) {
    toast.warning("Pembayaran melebihi kurang Bayar");
    d.bayar = bayarPreviousValue.value;
    (e.target as HTMLInputElement).value = getInputValue('bayar-' + idx, d.bayar);
  }
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif BYC hanya: bayar (input, aktif saat pay=1) dan pay
// (toggle checkbox). Urutan cols mengikuti urutan visual kolom tabel.
const bycCellId = (c: string, r: number) => `byc-cell-${c}-${r}`;

const bycTypeEdit = (r: number, c: string, key: string) => {
  if (c !== "bayar") return;
  const d = form.value.detail[r];
  if (!d) return;
  // Baris belum dicentang (input disabled) → alihkan sorotan ke kolom Pay.
  if (Number(d.pay) !== 1) {
    bycSetSelect(r, "pay");
    return;
  }
  bayarPreviousValue.value = d.bayar;
  const el = document.getElementById(bycCellId(c, r)) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  rawInputValues[`bayar-${r}`] = key;
  el.value = key;
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const bycGrid = useDetailGrid({
  cols: ["bayar", "pay"],
  rowCount: () => form.value.detail.length,
  cellId: bycCellId,
  cellPrefix: "byc-cell",
  isToggle: (c) => c === "pay",
  onToggle: (r) => {
    const d = form.value.detail[r];
    if (!d) return;
    d.pay = Number(d.pay) === 1 ? 0 : 1;
    onPayChange(d); // pay=1 → bayar = nilai - terbayar; pay=0 → bayar = 0
  },
  typeEditCols: ["bayar"],
  onTypeEdit: bycTypeEdit,
});

const {
  focusCell: bycFocusCell,
  gridBlur: bycGridBlur,
  onGridCellFocus: bycOnGridFocus,
  setSelect: bycSetSelect,
  enterEdit: bycEnterEdit,
} = bycGrid;

const isActiveCell = (r: number, c: string) =>
  bycFocusCell.value?.r === r && bycFocusCell.value?.c === c;

// ── Guard tanggal edit (paritas dtTanggalChange) ─────────────────────
// Nomor CR mengandung yymm (CABANG-CR.yymm.NNNN) — edit tidak boleh pindah
// bulan/tahun. Server memvalidasi ulang via cekTutupPeriode saat save.
const tanggalOld = ref("");
const onTanggalChange = () => {
  const nv = form.value.tanggal;
  if (!nv) return;
  if (!isEdit.value || !form.value.nomor) {
    tanggalOld.value = nv;
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

// ── Total footer grid detail (paritas footer summary Delphi) ────────
const totalBayar = computed(() =>
  form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0)
);
const selisihMetode = computed(
  () =>
    totalBayar.value -
    (Number(form.value.cash) + Number(form.value.transfer) +
      Number(form.value.potongan) + Number(form.value.giro) +
      Number(form.value.ppn) + Number(form.value.pph))
);

// ── Validasi Form (paritas cekdata) ──────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  // 1. Customer
  if (!form.value.cusKode) {
    toast.warning("customer belum di pilih");
    return false;
  }

  // 2. Potongan max 50.000 untuk non-FINANCE/PIUTANG
  if (Number(form.value.potongan) > 50000 && !isFinanceRole.value) {
    toast.warning("nilai potongan melebihi batas");
    return false;
  }

  // 3. Guard beda periode: bulan beda + hari > batas 'CR'
  // (paritas Delphi: tidak cek FLAGEDIT — berlaku insert & edit)
  try {
    const now = new Date();
    const tgl = new Date(form.value.tanggal);
    if (tgl.getMonth() !== now.getMonth()) {
      const res = await bayarCustomerFormApi.getBatas("CR");
      const batas = Number(res.batas || 0);
      if (batas > 0 && now.getDate() > batas) {
        toast.warning("Sudah Tidak bisa diedit pembayaran beda periode");
        return false;
      }
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
  }

  // 4. Rekening wajib per metode tercentang
  const rekChecks: [boolean, string, string][] = [
    [chkCash.value, form.value.rekCash, "Rekening Cash belum di pilih"],
    [chkTransfer.value, form.value.rekTransfer, "Rekening Transfer belum di pilih"],
    [chkGiro.value, form.value.rekGiro, "Rekening Giro belum di pilih"],
    [chkPotongan.value, form.value.rekPotongan, "Rekening Potongan belum di pilih"],
    [chkPPN.value, form.value.rekPPN, "Rekening ppn belum di pilih"],
    [chkPPH.value, form.value.rekPPH, "Rekening ppH belum di pilih"],
  ];
  for (const [checked, rek, msg] of rekChecks) {
    if (checked && !rek) {
      toast.warning(msg);
      return false;
    }
  }

  // 5. Baris pay=1 → bayar > 0
  const paidRows = form.value.detail.filter((d) => d.pay === 1);
  for (const d of paidRows) {
    if (Number(d.bayar) === 0) {
      toast.warning("Pembayaran masih nol");
      return false;
    }
  }

  // 6. Salesman semua baris pay=1 harus sama
  if (paidRows.length > 1) {
    const first = paidRows[0].salesman;
    if (paidRows.some((d) => d.salesman !== first)) {
      toast.warning("TIDAK BISA SIMPAN , ADA SALESMAN BERBEDA");
      return false;
    }
  }

  // 7. Balance: |Σ bayar - (cash+transfer+potongan+giro+ppn+pph)| <= 10
  const totalDetail = form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0);
  const totalMetode =
    Number(form.value.cash) + Number(form.value.transfer) +
    Number(form.value.potongan) + Number(form.value.giro) +
    Number(form.value.ppn) + Number(form.value.pph);
  const selisih = totalDetail - totalMetode;
  if (selisih > 10 || selisih < -10) {
    toast.warning(
      `Pembayaran dengan Total ${totalDetail} yang di bayar Beda ${totalMetode}`
    );
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
    const res = await bayarCustomerFormApi.save(form.value);
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
    const data = await bayarCustomerFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
    tanggalOld.value = form.value.tanggal;

    // Set checkbox state
    chkCash.value = Number(data.cash) > 0;
    chkTransfer.value = Number(data.transfer) > 0;
    chkPotongan.value = Number(data.potongan) > 0;
    chkGiro.value = Number(data.giro) > 0;
    chkPPN.value = Number(data.ppn) > 0;
    chkPPH.value = Number(data.pph) > 0;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "bayarCustomerBrowse" });
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
    memo: "",
    isTax: 1,
    cash: 0,
    rekCash: "",
    rekCashNama: "",
    transfer: 0,
    rekTransfer: "",
    rekTransferNama: "",
    potongan: 0,
    rekPotongan: "",
    rekPotonganNama: "",
    giro: 0,
    rekGiro: "",
    rekGiroNama: "",
    noGiro: "",
    tglCair: today,
    ppn: 0,
    rekPPN: "",
    rekPPNNama: "",
    pph: 0,
    rekPPH: "",
    rekPPHNama: "",
    ntpn: "",
    detail: [],
  };
  chkCash.value = false;
  chkTransfer.value = false;
  chkPotongan.value = false;
  chkGiro.value = false;
  chkPPN.value = false;
  chkPPH.value = false;
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadOptions();
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pembayaran Customer' : 'Tambah Pembayaran Customer Baru'"
    :icon="IconCash"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="byc-layout">
      <!-- ═══ HEADER (3 kolom sejajar) ═══ -->
      <div class="byc-header-grid">
        <!-- Customer Info -->
        <fieldset class="byc-groupbox">
          <legend class="byc-legend">Informasi Customer</legend>
          <div class="byc-groupbody">
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
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="4"></textarea>
            </div>
          </div>
        </fieldset>

        <!-- Order Info -->
        <fieldset class="byc-groupbox">
          <legend class="byc-legend">Informasi Order</legend>
          <div class="byc-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" @change="onTanggalChange" />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" @change="loadInvoice" />
                Pajak
              </label>
            </div>
          </div>
        </fieldset>

        <!-- Pembayaran -->
        <fieldset class="byc-groupbox">
          <legend class="byc-legend">Pembayaran</legend>
          <div class="byc-groupbody byc-pay-body">
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkCash" type="checkbox" @change="onChkCash" />
                Cash
              </label>
              <div class="search-group">
                <input :value="form.rekCashNama || form.rekCash" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekCashNama || form.rekCash" :disabled="!chkCash" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkCash" @click="showRekCashModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkCash" :value="getInputValue('cash', form.cash)" @focus="startEdit('cash', $event, form.cash)" @input="onValueInput('cash', $event, (v) => (form.cash = v))" @blur="endEdit('cash', $event, form.cash)" />
            </div>
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkTransfer" type="checkbox" @change="onChkTransfer" />
                Transfer
              </label>
              <div class="search-group">
                <input :value="form.rekTransferNama || form.rekTransfer" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekTransferNama || form.rekTransfer" :disabled="!chkTransfer" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkTransfer" @click="showRekTransferModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkTransfer" :value="getInputValue('transfer', form.transfer)" @focus="startEdit('transfer', $event, form.transfer)" @input="onValueInput('transfer', $event, (v) => (form.transfer = v))" @blur="endEdit('transfer', $event, form.transfer)" />
            </div>
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkPotongan" type="checkbox" @change="onChkPotongan" />
                Potongan
              </label>
              <div class="search-group">
                <input :value="form.rekPotonganNama || form.rekPotongan" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekPotonganNama || form.rekPotongan" :disabled="!chkPotongan" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkPotongan" @click="showRekPotonganModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkPotongan" :value="getInputValue('potongan', form.potongan)" @focus="startEdit('potongan', $event, form.potongan)" @input="onValueInput('potongan', $event, (v) => (form.potongan = v))" @blur="endEdit('potongan', $event, form.potongan)" />
            </div>
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkGiro" type="checkbox" @change="onChkGiro" />
                Giro
              </label>
              <div class="search-group">
                <input :value="form.rekGiroNama || form.rekGiro" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekGiroNama || form.rekGiro" :disabled="!chkGiro" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkGiro" @click="showRekGiroModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkGiro" :value="getInputValue('giro', form.giro)" @focus="startEdit('giro', $event, form.giro)" @input="onValueInput('giro', $event, (v) => (form.giro = v))" @blur="endEdit('giro', $event, form.giro)" />
            </div>
            <div class="pay-row pay-row-sub">
              <span class="sub-spacer"></span>
              <input v-model="form.noGiro" class="f-inp-sub" placeholder="No Giro" :disabled="!chkGiro" />
              <DsDatePicker v-model="form.tglCair" variant="toolbar" :disabled="!chkGiro" />
            </div>
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkPPN" type="checkbox" @change="onChkPPN" />
                PPN
              </label>
              <div class="search-group">
                <input :value="form.rekPPNNama || form.rekPPN" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekPPNNama || form.rekPPN" :disabled="!chkPPN" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkPPN" @click="showRekPPNModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkPPN" :value="getInputValue('ppn', form.ppn)" @focus="startEdit('ppn', $event, form.ppn)" @input="onValueInput('ppn', $event, (v) => (form.ppn = v))" @blur="endEdit('ppn', $event, form.ppn)" />
            </div>
            <div class="pay-row">
              <label class="check-lbl">
                <input v-model="chkPPH" type="checkbox" @change="onChkPPH" :disabled="!isFinanceRole" />
                PPH 22
              </label>
              <div class="search-group">
                <input :value="form.rekPPHNama || form.rekPPH" class="f-inp readonly-bg" readonly placeholder="Rekening" :title="form.rekPPHNama || form.rekPPH" :disabled="!chkPPH" />
                <button class="btn-search btn-search-sm" type="button" :disabled="!chkPPH" @click="showRekPPHModal = true">
                  <IconSearch :size="12" />
                </button>
              </div>
              <input type="text" inputmode="numeric" class="f-inp-pay tr" :disabled="!chkPPH" :value="getInputValue('pph', form.pph)" @focus="startEdit('pph', $event, form.pph)" @input="onValueInput('pph', $event, (v) => (form.pph = v))" @blur="endEdit('pph', $event, form.pph)" />
            </div>
            <div class="pay-row pay-row-sub">
              <span class="sub-spacer"></span>
              <input v-model="form.ntpn" class="f-inp-sub" placeholder="NTPN" />
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="byc-groupbox byc-detail-group">
        <legend class="byc-legend">Detail Invoice</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th :style="detailColWidthStyle('no')" class="tc">No</th>
                  <th :style="detailColWidthStyle('salesman')">Salesman</th>
                  <th :style="detailColWidthStyle('invoice')">Invoice</th>
                  <th :style="detailColWidthStyle('tanggal')" class="tc">Tgl Faktur</th>
                  <th :style="detailColWidthStyle('jthTempo')" class="tc">Jth Tempo</th>
                  <th :style="detailColWidthStyle('retur')" class="tr">Retur</th>
                  <th :style="detailColWidthStyle('ppn')" class="tr">PPN</th>
                  <th :style="detailColWidthStyle('nilai')" class="tr">Nilai</th>
                  <th :style="detailColWidthStyle('terbayar')" class="tr">Terbayar</th>
                  <th :style="detailColWidthStyle('bayar')" class="tr">Bayar</th>
                  <th :style="detailColWidthStyle('pay')" class="tc">Pay</th>
                  <th :style="detailColWidthStyle('net')" class="tr">Net</th>
                  <th :style="detailColWidthStyle('memo')">Memo</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx" :class="{ 'row-ctx': ctxRow === d }" @contextmenu.prevent="onRowContextMenu($event, d)">
                  <td class="tc row-no" :style="detailColWidthStyle('no')">{{ idx + 1 }}</td>
                  <td :style="detailColWidthStyle('salesman')">{{ d.salesman }}</td>
                  <td class="mono" :style="detailColWidthStyle('invoice')">{{ d.invoice }}</td>
                  <td class="tc" :style="detailColWidthStyle('tanggal')">{{ d.tanggal }}</td>
                  <td class="tc" :style="detailColWidthStyle('jthTempo')">
                    {{ d.jthTempo }}<span v-if="d.angsur" class="angsur-mark" title="Termin faktur angsur">*</span>
                  </td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('retur')">{{ fmt(d.retur) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('ppn')">{{ fmt(d.ppn) }}</td>
                  <td class="tr" :style="detailColWidthStyle('nilai')">{{ fmt(d.nilai) }}</td>
                  <td class="tr cell-muted" :style="detailColWidthStyle('terbayar')">{{ fmt(d.terbayar) }}</td>
                  <td class="tr" :style="detailColWidthStyle('bayar')">
                    <input type="text" inputmode="numeric" class="cell-inp cell-inp-full tr" :id="bycCellId('bayar', idx)" :class="{ 'cell-active': isActiveCell(idx, 'bayar') }" :disabled="d.pay !== 1" :value="getInputValue('bayar-' + idx, d.bayar)" @focus="bycOnGridFocus('bayar', idx); startBayarEdit(idx, $event, d)" @input="onBayarInput($event, d, idx)" @blur="endBayarEdit(idx, $event, d); bycGridBlur()" />
                  </td>
                  <td class="tc" :id="bycCellId('pay', idx)" :class="{ 'cell-active': isActiveCell(idx, 'pay') }" :style="detailColWidthStyle('pay')">
                    <input v-model="d.pay" type="checkbox" :true-value="1" :false-value="0" @change="onPayChange(d)" />
                  </td>
                  <td class="tr bold accent" :style="detailColWidthStyle('net')">{{ fmt(d.net) }}</td>
                  <td :style="detailColWidthStyle('memo')">{{ d.memo }}</td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="13" class="empty-state">
                    Pilih customer untuk memuat invoice.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Footer total bayar (paritas footer summary cxGrdMain Delphi) -->
          <div class="detail-footer">
            <span>Total Bayar: <strong>{{ fmt(totalBayar) }}</strong></span>
            <span :class="Math.abs(selisihMetode) > 10 ? 'selisih-bad' : 'selisih-ok'">
              Selisih dgn Metode: <strong>{{ fmt(selisihMetode) }}</strong>
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

  <!-- Rekening: kode disimpan ke model (masuk byc_rek_* & jurnal), nama hanya ditampilkan -->
  <SearchModal v-model="showRekCashModal" title="Pilih Rekening Cash" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekCashOptions" @select="(r) => { form.rekCash = r.kode; form.rekCashNama = r.nama; showRekCashModal = false; }" />
  <SearchModal v-model="showRekTransferModal" title="Pilih Rekening Transfer" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekTransferOptions" @select="(r) => { form.rekTransfer = r.kode; form.rekTransferNama = r.nama; showRekTransferModal = false; }" />
  <SearchModal v-model="showRekPotonganModal" title="Pilih Rekening Potongan" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekPotonganOptions" @select="(r) => { form.rekPotongan = r.kode; form.rekPotonganNama = r.nama; showRekPotonganModal = false; }" />
  <SearchModal v-model="showRekGiroModal" title="Pilih Rekening Giro" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekGiroOptions" @select="(r) => { form.rekGiro = r.kode; form.rekGiroNama = r.nama; showRekGiroModal = false; }" />
  <SearchModal v-model="showRekPPNModal" title="Pilih Rekening PPN" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekPPNOptions" @select="(r) => { form.rekPPN = r.kode; form.rekPPNNama = r.nama; showRekPPNModal = false; }" />
  <SearchModal v-model="showRekPPHModal" title="Pilih Rekening PPH" :columns="[{ key: 'kode', title: 'Kode', width: '100px' }, { key: 'nama', title: 'Nama' }]" :items="rekPPHOptions" @select="(r) => { form.rekPPH = r.kode; form.rekPPHNama = r.nama; showRekPPHModal = false; }" />

  <!-- ── Context menu klik kanan baris invoice (pola TabBar) ── -->
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
   BAYAR CUSTOMER — Classic Desktop Layout (matches SO/DO/FP)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Context menu klik kanan (pola TabBar) ──────────────────────── */
.ctx-menu {  position: fixed;
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
.byc-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

.byc-header-grid {
  display: grid;
  grid-template-columns: 1fr 320px 1.2fr;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.byc-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.byc-legend {
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

.byc-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (flex: 1 = fill remaining space) ───────────── */
.byc-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.byc-detail-group .byc-groupbody {
  flex: 1;
  min-height: 0;
  padding: 0;
}

/* ── Field Row ────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-row-top {
  align-items: flex-start;
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

.f-inp:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

.f-txa {
  flex: 1;
  max-width: 400px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 4px 5px;
  font-size: 11px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  background: white;
}

.f-txa:focus {
  border-color: var(--ds-primary, #0284c7);
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

.btn-search:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  border-color: var(--ds-border, #A0AAB8);
  cursor: not-allowed;
}

.btn-search-sm {
  width: 22px;
  height: 24px;
}

/* ── Checkbox ─────────────────────────────────────────────────── */
.check-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.check-lbl {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  width: 70px;
  flex-shrink: 0;
}

.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 12px;
  height: 12px;
  margin: 0;
  cursor: pointer;
}

/* ── Payment Rows ─────────────────────────────────────────────── */
.byc-pay-body {
  gap: 5px;
}

.pay-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pay-row-sub {
  padding-left: 76px;
}

.sub-spacer {
  display: none;
}

.f-inp-pay {
  width: 90px;
  flex: none;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  text-align: right;
  box-sizing: border-box;
  background: white;
}

.f-inp-pay:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-inp-pay:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

.f-inp-sub {
  flex: 1;
  max-width: 240px;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
  background: white;
}

.f-inp-sub:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-inp-sub:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

.f-inp-date {
  width: 120px;
  flex: none;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 5px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
  background: white;
}

.f-inp-date:focus {
  border-color: var(--ds-primary, #0284c7);
}

.f-inp-date:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
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

.detail-table-header-tbl {
  table-layout: fixed;
}

.detail-table-body-tbl {
  table-layout: fixed;
}

.row-no {
  color: var(--ds-text-muted, #8494A7);
  font-size: 10px;
}

.cell-muted {
  color: var(--ds-text-muted, #8494A7);
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

.cell-inp-full {
  width: 100%;
}

.cell-inp:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
.angsur-mark { color: var(--ds-warn, #c0392b); font-weight: 700; margin-left: 2px; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .byc-header-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .byc-layout {
    padding: 4px;
    gap: 4px;
  }
  .byc-groupbody {
    padding: 6px;
    gap: 4px;
  }
  .f-lbl {
    width: 70px;
    font-size: 10px;
  }
}
</style>
