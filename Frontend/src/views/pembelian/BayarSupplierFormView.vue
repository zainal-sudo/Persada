<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconCash, IconSearch } from "@tabler/icons-vue";
import { bayarSupplierFormApi, type BayarSupplierForm, type InvoiceBayarRow, type ReturBeliRow } from "@/api/pembelian/bayarSupplierFormApi";
import { useAfterSave } from "@/composables/useAfterSave";
import DsDatePicker from "@/components/DsDatePicker.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<BayarSupplierForm>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  supKode: "",
  supNama: "",
  rekKode: "",
  rekNama: "",
  memo: "",
  giro: "",
  tglCair: today,
  nilai: 0,
  isTax: 0,
  detail: [],
  retur: [],
});

const showSupplierModal = ref(false);
const supplierOptions = ref<any[]>([]);
const supplierLoading = ref(false);

const showRekModal = ref(false);
const rekOptions = ref<any[]>([]);

// Retur pembelian untuk setle di header (checkbox)
const returOptions = ref<ReturBeliRow[]>([]);
const selectedRetur = computed(() =>
  returOptions.value.filter((r) => r.checked === 1)
);
const totalRetur = computed(() =>
  selectedRetur.value.reduce((s, r) => s + Number(r.amount || 0), 0)
);

const loadNomor = async () => {
  try {
    const res = await bayarSupplierFormApi.getNomor(form.value.tanggal);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const searchSupplier = async (query: string) => {
  supplierLoading.value = true;
  try {
    supplierOptions.value = await bayarSupplierFormApi.getSupplier(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari supplier.");
  } finally {
    supplierLoading.value = false;
  }
};

const selectSupplier = async (sup: any) => {
  form.value.supKode = sup.kode;
  form.value.supNama = sup.nama;
  showSupplierModal.value = false;
  await Promise.all([loadInvoiceAuto(), loadRetur()]);
};

const loadRekening = async (query: string) => {
  try {
    rekOptions.value = await bayarSupplierFormApi.getRekening(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat rekening.");
  }
};

const selectRek = (r: any) => {
  form.value.rekKode = r.kode;
  form.value.rekNama = r.nama;
  showRekModal.value = false;
};

const applyInvoiceData = (data: any[]) => {
  form.value.detail = data.map((d: any) => {
    const bayar = d.bayarLama ?? d.bayar ?? 0;
    return {
      ...d,
      bayar,
      pay: bayar > 0 ? 1 : 0,
      bayarTampil: bayar > 0 ? fmtNum(bayar) : "",
    };
  });
  hitungTotal();
};

const loadInvoice = async () => {
  if (!form.value.supKode) return;
  try {
    const data = await bayarSupplierFormApi.getInvoiceBySupplier(
      form.value.supKode,
      form.value.isTax,
      form.value.isEdit,
      form.value.nomor
    );
    applyInvoiceData(data);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

// Deteksi otomatis: coba Non-PPN dulu; kalau kosong, coba PPN dan
// set checkbox Pajak mengikuti invoice yang termuat.
const loadInvoiceAuto = async () => {
  if (!form.value.supKode) return;
  try {
    let data = await bayarSupplierFormApi.getInvoiceBySupplier(
      form.value.supKode, 0, form.value.isEdit, form.value.nomor
    );
    if (data.length > 0) {
      form.value.isTax = 0;
    } else {
      data = await bayarSupplierFormApi.getInvoiceBySupplier(
        form.value.supKode, 1, form.value.isEdit, form.value.nomor
      );
      if (data.length > 0) form.value.isTax = 1;
    }
    applyInvoiceData(data);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat invoice.");
  }
};

const loadRetur = async () => {
  if (!form.value.supKode) return;
  try {
    const data = await bayarSupplierFormApi.getReturBySupplier(
      form.value.supKode,
      form.value.nomor
    );
    returOptions.value = data;
    hitungTotal();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat retur.");
  }
};

const sisaHutang = (d: InvoiceBayarRow) =>
  Math.max((Number(d.nilai) || 0) - (Number(d.terbayar) || 0), 0);

const fmtNum = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

const setBayarTampil = (d: InvoiceBayarRow) => {
  d.bayarTampil = d.bayar > 0 ? fmtNum(d.bayar) : "";
};

const onPayChange = (d: InvoiceBayarRow) => {
  d.bayar = d.pay === 1 ? sisaHutang(d) : 0;
  setBayarTampil(d);
  hitungTotal();
};

const onBayarInput = (e: Event, d: InvoiceBayarRow) => {
  const el = e.target as HTMLInputElement;
  const cleaned = el.value.replace(/[^0-9]/g, "");
  d.bayar = Number(cleaned) || 0;
  if (d.bayar > sisaHutang(d)) d.bayar = sisaHutang(d);
  const caretDariKanan = el.value.length - (el.selectionStart ?? el.value.length);
  el.value = d.bayar > 0 ? fmtNum(d.bayar) : "";
  const pos = Math.max(el.value.length - caretDariKanan, 0);
  el.setSelectionRange(pos, pos);
  setBayarTampil(d);
  hitungTotal();
};

const hitungTotal = () => {
  const totalBayar = form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0);
  form.value.nilai = Math.max(totalBayar - totalRetur.value, 0);
};

const validateSave = async (): Promise<boolean> => {
  if (!form.value.supKode) {
    toast.warning("Supplier belum dipilih.");
    return false;
  }
  const paidRows = form.value.detail.filter((d) => d.pay === 1);
  if (paidRows.length === 0) {
    toast.warning("Pilih minimal satu invoice untuk dibayar.");
    return false;
  }
  for (const d of paidRows) {
    if (d.bayar <= 0) {
      toast.warning("Nilai bayar tidak boleh nol.");
      return false;
    }
    if (d.bayar > sisaHutang(d)) {
      toast.warning("Pembayaran melebihi sisa tagihan.");
      return false;
    }
  }
  const totalBayar = form.value.detail.reduce((s, d) => s + Number(d.bayar || 0), 0);
  if (totalRetur.value > totalBayar) {
    toast.warning("Total retur melebihi total pembayaran invoice.");
    return false;
  }
  if (form.value.nilai <= 0) {
    toast.warning("Total bayar harus > 0.");
    return false;
  }
  return true;
};

const confirmSave = async (action: "new" | "close") => {
  if (!(await validateSave())) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    form.value.retur = selectedRetur.value.map((r) => ({
      nomor: r.nomor,
      tanggal: r.tanggal,
      invoice: r.invoice,
      amount: r.amount,
      memo: r.memo,
    }));
    const res = await bayarSupplierFormApi.save(form.value);
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
    const data = await bayarSupplierFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = { ...data, isEdit: true };
    form.value.detail = form.value.detail.map((d: any) => {
      const bayar = d.bayarLama ?? d.bayar ?? 0;
      return {
        ...d,
        bayar,
        pay: bayar > 0 ? 1 : 0,
        bayarTampil: bayar > 0 ? fmtNum(bayar) : "",
      };
    });
    returOptions.value = data.retur || [];
    hitungTotal();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data.");
    router.push({ name: "bayarSupplierBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    isEdit: false,
    nomor: "",
    tanggal: today,
    supKode: "",
    supNama: "",
    rekKode: "",
    rekNama: "",
    memo: "",
    giro: "",
    tglCair: today,
    nilai: 0,
    isTax: 0,
    detail: [],
    retur: [],
  };
  returOptions.value = [];
  loadNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
const fmtDate = (val: string) => val;

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pembayaran Supplier' : 'Tambah Pembayaran Supplier Baru'"
    :icon="IconCash"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="bys-layout">
      <div class="bys-header-grid">
        <fieldset class="bys-groupbox">
          <legend class="bys-legend">Informasi Supplier</legend>
          <div class="bys-groupbody">
            <div class="f-row">
              <label class="f-lbl">Supplier</label>
              <div class="search-group">
                <input :value="form.supKode" class="f-inp w-20 readonly-bg" readonly />
                <input :value="form.supNama" class="f-inp w-80 readonly-bg" readonly />
                <button class="btn-search" type="button" :disabled="isEdit" @click="showSupplierModal = true; searchSupplier('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Rekening</label>
              <div class="search-group">
                <input :value="form.rekNama" class="f-inp readonly-bg" readonly />
                <button class="btn-search" type="button" @click="showRekModal = true; loadRekening('')">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="4"></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset class="bys-groupbox">
          <legend class="bys-legend">Informasi Pembayaran</legend>
          <div class="bys-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Giro</label>
              <input v-model="form.giro" class="f-inp" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tgl Cair</label>
              <DsDatePicker v-model="form.tglCair" variant="form" />
            </div>
            <div class="f-row check-row">
              <label class="check-lbl">
                <input v-model="form.isTax" type="checkbox" :true-value="1" :false-value="0" @change="loadInvoice" />
                PPN
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <fieldset v-if="returOptions.length > 0" class="bys-groupbox bys-retur-group">
        <legend class="bys-legend">Retur Pembelian (Setle)</legend>
        <div class="retur-list">
          <table class="detail-table">
            <thead>
              <tr>
                <th class="tc" style="width: 40px">Setle</th>
                <th style="width: 170px">Nomor Retur</th>
                <th class="tc" style="width: 100px">Tanggal</th>
                <th style="width: 170px">Invoice</th>
                <th class="tr" style="width: 120px">Nilai</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in returOptions" :key="r.nomor">
                <td class="tc" style="width: 40px">
                  <input v-model="r.checked" type="checkbox" :true-value="1" :false-value="0" @change="hitungTotal" />
                </td>
                <td class="mono" style="width: 170px">{{ r.nomor }}</td>
                <td class="tc" style="width: 100px">{{ r.tanggal }}</td>
                <td style="width: 170px">{{ r.invoice }}</td>
                <td class="tr" style="width: 120px">{{ fmt(r.amount) }}</td>
                <td>{{ r.memo }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset class="bys-groupbox bys-detail-group">
        <legend class="bys-legend">Detail Invoice</legend>
        <div class="detail-table-wrap">
          <div class="detail-table-header">
            <table class="detail-table detail-table-header-tbl">
              <thead>
                <tr>
                  <th style="width: 40px" class="tc">Pay</th>
                  <th style="width: 170px">Invoice</th>
                  <th style="width: 130px">No Bukti</th>
                  <th style="width: 100px" class="tc">Tgl</th>
                  <th style="width: 100px" class="tc">Jth Tempo</th>
                  <th style="width: 120px" class="tr">Nilai</th>
                  <th style="width: 120px" class="tr">Terbayar</th>
                  <th style="width: 120px" class="tr">Bayar</th>
                </tr>
              </thead>
            </table>
          </div>
          <div class="detail-table-body">
            <table class="detail-table detail-table-body-tbl">
              <tbody>
                <tr v-for="(d, idx) in form.detail" :key="idx">
                  <td class="tc" style="width: 40px">
                    <input v-model="d.pay" type="checkbox" :true-value="1" :false-value="0" @change="onPayChange(d)" />
                  </td>
                  <td class="mono" style="width: 170px">{{ d.invoice }}</td>
                  <td style="width: 130px">{{ d.nobukti }}</td>
                  <td class="tc" style="width: 100px">{{ d.tanggal }}</td>
                  <td class="tc" style="width: 100px">{{ d.jthTempo }}</td>
                  <td class="tr" style="width: 120px">{{ fmt(d.nilai) }}</td>
                  <td class="tr" style="width: 120px">{{ fmt(d.terbayar) }}</td>
                  <td class="tr" style="width: 120px">
                    <input type="text" inputmode="numeric" class="cell-inp tr" :disabled="d.pay !== 1" :value="d.bayarTampil" @input="onBayarInput($event, d)" />
                  </td>
                </tr>
                <tr v-if="form.detail.length === 0">
                  <td colspan="8" class="empty-state">Pilih supplier untuk memuat invoice.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="detail-footer">
            <span v-if="totalRetur > 0">Setle Retur: <strong class="accent">{{ fmt(totalRetur) }}</strong></span>
            <span>Total Bayar: <strong>{{ fmt(form.nilai) }}</strong></span>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <SearchModal
    v-model="showSupplierModal"
    title="Pilih Supplier"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Supplier' },
    ]"
    :items="supplierOptions"
    :loading="supplierLoading"
    :server-search="true"
    search-placeholder="Cari supplier..."
    @select="selectSupplier"
    @search="searchSupplier"
  />

  <SearchModal
    v-model="showRekModal"
    title="Pilih Rekening"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Rekening' },
    ]"
    :items="rekOptions"
    @select="selectRek"
  />
</template>

<style scoped>
.bys-layout { display: flex; flex-direction: column; gap: 6px; padding: 6px; height: 100%; overflow: hidden; }
.bys-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; }
.bys-groupbox { border: 1px solid var(--ds-border, #A0AAB8); padding: 0; margin: 0; display: flex; flex-direction: column; }
.bys-legend { font-size: 11px; font-weight: 700; color: var(--ds-primary, #0284c7); text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 6px; margin-left: 6px; background: var(--ds-surface, #F0F3F8); border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none; align-self: flex-start; line-height: 1.4; }
.bys-groupbody { padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.bys-detail-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.bys-retur-group { flex-shrink: 0; }
.retur-list { max-height: 150px; overflow: auto; border-top: 1px solid var(--ds-border, #A0AAB8); }
.detail-table-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; border-top: 1px solid var(--ds-border, #A0AAB8); overflow: hidden; }
.detail-table-header { flex-shrink: 0; overflow: hidden; }
.detail-table-body { flex: 1; min-height: 0; overflow: auto; }
.detail-footer { flex-shrink: 0; display: flex; justify-content: flex-end; gap: 24px; padding: 5px 10px; border-top: 1px solid var(--ds-border, #A0AAB8); background: var(--ds-surface-raised, #F0F3F8); font-size: 11px; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
.detail-table thead tr { background: var(--ds-primary, #0284c7); }
.detail-table th { color: white; font-weight: 700; padding: 4px 6px; font-size: 10px; text-transform: uppercase; border-right: 1px solid var(--ds-primary-dark, #0369a1); }
.detail-table td { padding: 2px 4px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); border-right: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.detail-table tbody tr:nth-child(odd) { background: #F0F3F8; }
.detail-table tbody tr:nth-child(even) { background: #E4EBF4; }
.detail-table tbody tr:hover td { background: #D8E2EF; }
.cell-inp { width: 100%; height: 20px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 3px; font-size: 11px; background: white; }
.empty-state { text-align: center; color: var(--ds-text-muted, #8494A7); padding: 24px; }
.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-row-top { align-items: flex-start; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.search-group { display: flex; flex: 1; gap: 2px; }
.w-20 { width: 25%; flex: none !important; }
.w-80 { width: 75%; }
.f-inp { flex: 1; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; background: white; }
.readonly-bg { background: var(--ds-surface-inset, #E0E4EA); }
.btn-search { height: 24px; width: 26px; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); }
.f-txa { flex: 1; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 4px 5px; font-size: 11px; resize: vertical; }
.check-row { display: flex; gap: 12px; }
.check-lbl { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; }
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: monospace; font-size: 10px; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #0284c7); }
</style>
