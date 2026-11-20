<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import OtorisasiDialog from "@/components/OtorisasiDialog.vue";
import { IconFileInvoice, IconSearch } from "@tabler/icons-vue";
import { invoiceFormApi, type InvoiceForm, type InvoiceDetail, type OpenBPBRow } from "@/api/pembelian/invoiceFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAuthStore } from "@/stores/authStore";
import DsDatePicker from "@/components/DsDatePicker.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<InvoiceForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  jthtempo: today,
  bpbNomor: "",
  nobukti: "",
  tglBukti: today,
  memo: "",
  supKode: "",
  supNama: "",
  discFaktur: 0,
  discFakturPr: 0,
  amount: 0,
  taxAmount: 0,
  isTax: 0,
  freight: 0,
  materai: 0,
  isBayar: 0,
  bayar: 0,
  isPajak: 0,
  nopajak: "",
  top: 0,
  detail: [],
});

const showBPBModal = ref(false);
const bpbOptions = ref<OpenBPBRow[]>([]);
const bpbLoading = ref(false);

const showOtorisasi = ref(false);
const validatingRow = ref<InvoiceDetail | null>(null);

const loadNomor = async () => {
  try {
    const res = await invoiceFormApi.getNomor(form.value.tanggal, form.value.isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const searchBPB = async (query: string) => {
  bpbLoading.value = true;
  try {
    bpbOptions.value = await invoiceFormApi.getOpenBPB(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari BPB.");
  } finally {
    bpbLoading.value = false;
  }
};

const selectBPB = async (bpb: OpenBPBRow) => {
  try {
    const data = await invoiceFormApi.getDetailByBPB(bpb.nomor);
    form.value.bpbNomor = bpb.nomor;
    form.value.supKode = bpb.supKode;
    form.value.supNama = bpb.supplier;
    form.value.isTax = bpb.isTax;
    form.value.top = bpb.top;
    form.value.discFakturPr = bpb.poDiscFakturPr || 0;
    form.value.discFaktur = bpb.poDiscFaktur || 0;
    form.value.detail = (data || []).map((d: any) => ({
      ...d,
      idBatch: d.idBatch || "",
    }));

    const top = Number(bpb.top || 0);
    const tgl = new Date(form.value.tanggal);
    tgl.setDate(tgl.getDate() + top);
    form.value.jthtempo = tgl.toISOString().split("T")[0];

    await loadNomor();
    hitung();
    showBPBModal.value = false;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat BPB.");
  }
};

const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtQty = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rawInputValues: Record<string, string> = {};
const getInputValue = (key: string, modelValue: number, decimals = 2) => {
  if (key in rawInputValues) return rawInputValues[key];
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(modelValue || 0);
};

const startEdit = (key: string, e: Event, raw: number) => {
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

const updateRowTotal = (d: InvoiceDetail) => {
  d.total = (d.qty * d.harga * (100 - d.discPr)) / 100;
  hitung();
};

const hitung = () => {
  const subtotal = form.value.detail.reduce((s, d) => s + Number(d.total || 0), 0);
  const discPrValue = Number(form.value.discFakturPr) || 0;
  const discValue = Number(form.value.discFaktur) || 0;
  const totalDisc = (discPrValue / 100) * subtotal + discValue;
  const setelahDisc = subtotal - totalDisc;
  const pph21Factor = 1.11;
  const pph10Factor = 1.1;
  const cutoff = new Date(2022, 3, 1);
  const factor = new Date(form.value.tanggal) >= cutoff ? pph21Factor : pph10Factor;
  if (form.value.isTax === 1) {
    form.value.taxAmount = setelahDisc * (factor - 1);
    form.value.amount = setelahDisc * factor + Number(form.value.freight) + Number(form.value.materai);
  } else {
    form.value.taxAmount = 0;
    form.value.amount = setelahDisc + Number(form.value.freight) + Number(form.value.materai);
  }
};

const onQtyInput = (e: Event, d: InvoiceDetail) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["qty-" + d.brgKode] = el.value;
  d.qty = parseInput(el.value);
  updateRowTotal(d);
};

const onHargaInput = (e: Event, d: InvoiceDetail) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["harga-" + d.brgKode] = el.value;
  d.harga = parseInput(el.value);
  updateRowTotal(d);
};

const onDiscInput = (e: Event, d: InvoiceDetail) => {
  const el = e.target as HTMLInputElement;
  rawInputValues["disc-" + d.brgKode] = el.value;
  d.discPr = parseInput(el.value);
  updateRowTotal(d);
};

const onFreightInput = (e: Event) => {
  rawInputValues["freight"] = (e.target as HTMLInputElement).value;
  form.value.freight = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onMateraiInput = (e: Event) => {
  rawInputValues["materai"] = (e.target as HTMLInputElement).value;
  form.value.materai = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onDiscFakturPrInput = (e: Event) => {
  rawInputValues["discFakturPr"] = (e.target as HTMLInputElement).value;
  form.value.discFakturPr = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const onDiscFakturInput = (e: Event) => {
  rawInputValues["discFaktur"] = (e.target as HTMLInputElement).value;
  form.value.discFaktur = parseInput((e.target as HTMLInputElement).value);
  hitung();
};

const cekLastCost = async (d: InvoiceDetail) => {
  try {
    const res = await invoiceFormApi.cekLastCost(d.brgKode, d.total);
    if (res.ok === false) {
      const ok = confirm("Net HPP berubah, otorisasi?");
      if (!ok) return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
  }
  return true;
};

const validateSave = async (): Promise<boolean> => {
  if (!form.value.bpbNomor) {
    toast.warning("BPB belum dipilih.");
    return false;
  }
  if (!form.value.nobukti) {
    toast.warning("No Bukti harus diisi.");
    return false;
  }
  if (form.value.detail.length === 0) {
    toast.warning("Belum ada detail barang.");
    return false;
  }
  try {
    const check = await invoiceFormApi.checkNoBukti(form.value.nobukti, form.value.nomor);
    if (check.exists) {
      toast.warning("No Bukti sudah digunakan.");
      return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
  }
  if (form.value.isBayar === 1 && !isEdit.value) {
    // handle if needed
  }
  return true;
};

const confirmSave = async (action: "new" | "close") => {
  for (const d of form.value.detail) {
    const ok = await cekLastCost(d);
    if (!ok) return;
  }
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await invoiceFormApi.save(form.value);
    const nomor = res.data?.nomor || form.value.nomor;
    handlePostSave(action, nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};

const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadNomor();
    return;
  }
  isLoading.value = true;
  try {
    const data = await invoiceFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...data,
      isEdit: true,
      detail: (data.detail || []).map((d: any) => ({
        ...d,
        idBatch: d.idBatch || "",
      })),
    };
    if (form.value.isBayar === 1) {
      // disabled state handled in UI
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "invoiceBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    jthtempo: today,
    bpbNomor: "",
    nobukti: "",
    tglBukti: today,
    memo: "",
    supKode: "",
    supNama: "",
    discFaktur: 0,
    discFakturPr: 0,
    amount: 0,
    taxAmount: 0,
    isTax: 0,
    freight: 0,
    materai: 0,
    isBayar: 0,
    bayar: 0,
    isPajak: 0,
    nopajak: "",
    top: 0,
    detail: [],
  };
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Invoice Supplier' : 'Tambah Invoice Supplier Baru'"
    :icon="IconFileInvoice"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="inv-layout">
      <div class="inv-header-grid">
        <fieldset class="inv-groupbox">
          <legend class="inv-legend">Informasi BPB</legend>
          <div class="inv-groupbody">
            <div class="f-row">
              <label class="f-lbl">BPB</label>
              <div class="search-group">
                <input :value="form.bpbNomor" class="f-inp readonly-bg" readonly placeholder="Pilih BPB..." />
                <button class="btn-search" type="button" :disabled="isEdit" @click="showBPBModal = true; searchBPB('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Supplier</label>
              <input :value="form.supNama" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="4"></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset class="inv-groupbox">
          <legend class="inv-legend">Informasi Invoice</legend>
          <div class="inv-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">No Bukti</label>
              <input v-model="form.nobukti" class="f-inp" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Jth Tempo</label>
              <DsDatePicker v-model="form.jthtempo" variant="form" />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" />
                Pajak
              </label>
            </div>
            <div v-if="isEdit && form.isBayar === 1" class="warning-text">Sudah ada pembayaran - Simpan dinonaktifkan oleh sistem</div>
          </div>
        </fieldset>
      </div>

      <fieldset class="inv-groupbox inv-detail-group">
        <legend class="inv-legend">Detail Barang</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th style="width: 40px" class="tc">No</th>
                  <th style="width: 100px">SKU</th>
                  <th style="min-width: 200px">Nama Barang</th>
                  <th style="width: 80px" class="tc">Satuan</th>
                  <th style="width: 90px" class="tr">Qty</th>
                  <th style="width: 120px" class="tr">Harga</th>
                  <th style="width: 70px" class="tr">Disc%</th>
                  <th style="width: 120px" class="tr">Total</th>
                  <th style="width: 110px" class="tc">Id Batch</th>
                  <th style="width: 110px" class="tc">Expired</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx">
                  <td class="tc row-no" style="width: 40px">{{ idx + 1 }}</td>
                  <td class="mono" style="width: 100px">{{ d.brgKode }}</td>
                  <td style="min-width: 200px">{{ d.brgNama }}</td>
                  <td class="tc" style="width: 80px">{{ d.satuan }}</td>
                  <td class="tr" style="width: 90px">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :value="getInputValue('qty-' + d.brgKode, d.qty, 2)" @focus="startEdit('qty-' + d.brgKode, $event, d.qty)" @input="onQtyInput($event, d)" @blur="endEdit('qty-' + d.brgKode, $event, d.qty, 2)" />
                  </td>
                  <td class="tr" style="width: 120px">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :value="getInputValue('harga-' + d.brgKode, d.harga)" @focus="startEdit('harga-' + d.brgKode, $event, d.harga)" @input="onHargaInput($event, d)" @blur="endEdit('harga-' + d.brgKode, $event, d.harga)" />
                  </td>
                  <td class="tr" style="width: 70px">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :value="getInputValue('disc-' + d.brgKode, d.discPr)" @focus="startEdit('disc-' + d.brgKode, $event, d.discPr)" @input="onDiscInput($event, d)" @blur="endEdit('disc-' + d.brgKode, $event, d.discPr)" />
                  </td>
                  <td class="tr cell-total" style="width: 120px">{{ fmt(d.total) }}</td>
                  <td class="tc cell-muted" style="width: 110px">{{ d.idBatch || '-' }}</td>
                  <td class="tc cell-muted" style="width: 110px">{{ d.expired }}</td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="10" class="empty-state">Belum ada barang. Pilih BPB untuk memuat detail.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      <div class="inv-footer-grid">
        <fieldset class="inv-groupbox">
          <legend class="inv-legend">Perhitungan</legend>
          <div class="inv-groupbody">
            <div class="calc-row">
              <label class="calc-lbl">Disc Faktur</label>
              <input type="text" inputmode="numeric" class="calc-inp" :value="getInputValue('discFakturPr', form.discFakturPr)" @focus="startEdit('discFakturPr', $event, form.discFakturPr)" @input="onDiscFakturPrInput" @blur="endEdit('discFakturPr', $event, form.discFakturPr)" />
              <span class="calc-unit">%</span>
              <span class="calc-op">+</span>
              <input type="text" inputmode="numeric" class="calc-inp calc-inp-lg" :value="getInputValue('discFaktur', form.discFaktur)" @focus="startEdit('discFaktur', $event, form.discFaktur)" @input="onDiscFakturInput" @blur="endEdit('discFaktur', $event, form.discFaktur)" />
            </div>
            <div class="calc-row">
              <label class="calc-lbl">Freight</label>
              <input type="text" inputmode="numeric" class="calc-inp calc-inp-lg" :value="getInputValue('freight', form.freight)" @focus="startEdit('freight', $event, form.freight)" @input="onFreightInput" @blur="endEdit('freight', $event, form.freight)" />
            </div>
            <div class="calc-row">
              <label class="calc-lbl">Materai</label>
              <input type="text" inputmode="numeric" class="calc-inp calc-inp-lg" :value="getInputValue('materai', form.materai)" @focus="startEdit('materai', $event, form.materai)" @input="onMateraiInput" @blur="endEdit('materai', $event, form.materai)" />
            </div>
            <div class="calc-row calc-total-row">
              <label class="calc-lbl calc-lbl-total">TOTAL</label>
              <span class="calc-val-total">{{ fmt(form.amount) }}</span>
            </div>
            <div class="calc-row">
              <label class="calc-lbl">PPN</label>
              <span class="calc-val-muted">{{ fmt(form.taxAmount) }}</span>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </BaseForm>

  <SearchModal
    v-model="showBPBModal"
    title="Pilih BPB Belum Invoice"
    :columns="[
      { key: 'nomor', title: 'Nomor BPB', width: '170px' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
      { key: 'supplier', title: 'Supplier' },
    ]"
    :items="bpbOptions"
    :loading="bpbLoading"
    :server-search="true"
    search-placeholder="Cari nomor BPB atau supplier..."
    @select="selectBPB"
    @search="searchBPB"
  />
</template>

<style scoped>
.inv-layout { display: flex; flex-direction: column; gap: 6px; padding: 6px; height: 100%; overflow: hidden; }
.inv-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; }
.inv-groupbox { border: 1px solid var(--ds-border, #A0AAB8); padding: 0; margin: 0; display: flex; flex-direction: column; }
.inv-legend { font-size: 11px; font-weight: 700; color: var(--ds-primary, #0284c7); text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 6px; margin-left: 6px; background: var(--ds-surface, #F0F3F8); border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none; align-self: flex-start; line-height: 1.4; }
.inv-groupbody { padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.inv-detail-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.detail-table-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; border-top: 1px solid var(--ds-border, #A0AAB8); overflow: hidden; }
.detail-table-header { flex-shrink: 0; overflow: hidden; }
.detail-table-body { flex: 1; min-height: 0; overflow: auto; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 500; table-layout: fixed; }
.detail-table thead tr { background: var(--ds-primary, #0284c7); }
.detail-table th { color: white; font-weight: 700; padding: 4px 6px; font-size: 10px; text-transform: uppercase; border-right: 1px solid var(--ds-primary-dark, #0369a1); }
.detail-table td { padding: 2px 4px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); border-right: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-table tbody tr:nth-child(odd) { background: #F0F3F8; }
.detail-table tbody tr:nth-child(even) { background: #E4EBF4; }
.detail-table tbody tr:hover td { background: #D8E2EF; }
.cell-inp { width: 100%; height: 20px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 3px; font-size: 11px; outline: none; background: white; }
.cell-total { font-weight: 700; color: var(--ds-primary, #0284c7); }
.cell-muted { color: var(--ds-text-muted, #8494A7); }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); padding: 24px; }
.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-row-top { align-items: flex-start; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.search-group { display: flex; flex: 1; gap: 2px; }
.f-inp { flex: 1; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; background: white; }
.readonly-bg { background: var(--ds-surface-inset, #E0E4EA); }
.btn-search { height: 24px; width: 26px; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); }
.f-txa { flex: 1; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 4px 5px; font-size: 11px; resize: vertical; }
.check-row { display: flex; gap: 12px; }
.check-lbl { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; }
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: monospace; font-size: 10px; }
.warning-text { color: #dc2626; font-size: 11px; font-weight: 600; }
.calc-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.calc-lbl { width: 90px; font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); }
.calc-inp { width: 100px; height: 22px; border: 1px solid var(--ds-border, #A0AAB8); text-align: right; font-size: 11px; }
.calc-inp-lg { width: 120px; }
.calc-unit { font-size: 11px; }
.calc-op { font-size: 11px; }
.calc-val-total { font-weight: 700; color: var(--ds-primary, #0284c7); font-size: 12px; }
.calc-val-muted { font-size: 11px; color: var(--ds-text-secondary, #5A6A7E); }
</style>
