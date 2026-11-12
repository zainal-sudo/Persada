<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconReceipt, IconSearch, IconTrash, IconPlus } from "@tabler/icons-vue";
import { bpbFormApi, type BPBForm, type BPBDetail, type OpenPORow } from "@/api/pembelian/bpbFormApi";
import DsDatePicker from "@/components/DsDatePicker.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useEscClose } from "@/composables/useEscClose";

const route = useRoute();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);
const attemptedSave = ref(false);

const today = new Date().toISOString().slice(0, 10);

const form = ref<any>({
  isEdit: false,
  nomor: "",
  tanggal: today,
  poNomor: "",
  memo: "",
  gdgKode: "",
  detail: [],
  amount: 0,
  taxAmount: 0,
});

const poError = computed(() => attemptedSave.value && !form.value.poNomor);
const gdgError = computed(() => attemptedSave.value && !form.value.gdgKode);

const gudangOptions = ref<any[]>([]);
const poOptions = ref<any[]>([]);
const gudangLoading = ref(false);
const poLoading = ref(false);

const showGudangModal = ref(false);
const showPOModal = ref(false);

const getAngkaPPN = (tanggal: string) => {
  const cutoff = new Date("2022-04-01");
  const t = tanggal ? new Date(tanggal) : new Date();
  return t >= cutoff ? 1.11 : 1.1;
};

const subtotalBruto = computed(() => {
  return form.value.detail.reduce((sum: number, d: any) => {
    const qty = Number(d.qty) || 0;
    const harga = Number(d.harga) || 0;
    const discPr = Number(d.discPr) || 0;
    return sum + (qty * harga * ((100 - discPr) / 100));
  }, 0);
});

const hitung = () => {
  const subtotal = subtotalBruto.value;
  const isTax = selectedPO.value?.isTax || 0;
  if (isTax === 1) {
    form.value.taxAmount = subtotal * (getAngkaPPN(form.value.tanggal) - 1);
    form.value.amount = subtotal * getAngkaPPN(form.value.tanggal);
  } else {
    form.value.taxAmount = 0;
    form.value.amount = subtotal;
  }
};

const selectedPO = ref<OpenPORow | null>(null);

const loadNomor = async () => {
  try {
    const isTax = selectedPO.value?.isTax || 0;
    const res = await bpbFormApi.getNomor(form.value.tanggal, isTax);
    form.value.nomor = res.nomor;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor BPB.");
  }
};

const loadGudang = async () => {
  gudangLoading.value = true;
  try {
    gudangOptions.value = await bpbFormApi.getGudang();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat gudang.");
  } finally {
    gudangLoading.value = false;
  }
};

const searchPO = async (query: string) => {
  poLoading.value = true;
  try {
    poOptions.value = await bpbFormApi.getOpenPO(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari PO.");
  } finally {
    poLoading.value = false;
  }
};

const selectGudang = (gdg: any) => {
  form.value.gdgKode = gdg.kode || gdg.Kode;
  showGudangModal.value = false;
};

const selectPO = async (po: OpenPORow) => {
  selectedPO.value = po;
  form.value.poNomor = po.nomor;
  showPOModal.value = false;
  try {
    const detail = await bpbFormApi.getDetailByPO(po.nomor);
    form.value.detail = detail.map((d: any, i: number) => ({
      no: i + 1,
      brgKode: d.brgKode || d.Kode,
      brgNama: d.brgNama || d.Nama,
      satuan: d.satuan || d.Satuan,
      qty: Number(d.kurang || d.Kurang) || 0,
      harga: Number(d.harga || d.Harga) || 0,
      discPr: Number(d.discPr || d.Disc) || 0,
      total: (Number(d.kurang || d.Kurang) || 0) * (Number(d.harga || d.Harga) || 0) * (100 - (Number(d.discPr || d.Disc) || 0)) / 100,
      sudah: Number(d.sudah || d.Sudah) || 0,
      kurang: Number(d.kurang || d.Kurang) || 0,
      closed: d.closed || d.Closed || "0",
      expired: d.expired || d.Expired || "",
      idBatch: d.idBatch || d.IdBatch || "",
    }));
    hitung();
    if (!isEdit.value) {
      loadNomor();
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat detail PO.");
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d: any, i: number) => (d.no = i + 1));
  hitung();
};

const updateRow = (d: BPBDetail) => {
  const max = Number(d.kurang) || 0;
  if (Number(d.qty) > max) {
    d.qty = max;
    toast.warning("Qty tidak boleh lebih dari sisa kurang.");
  }
  if (Number(d.qty) < 0) d.qty = 0;
  d.total = (d.qty * d.harga * (100 - d.discPr)) / 100;
  hitung();
};

const fmt = (v: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtInt = (v: number) => new Intl.NumberFormat("id-ID").format(Math.round(v || 0));

const parseInput = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const { handlePostSave } = useAfterSave({
  onReset: () => {
    form.value = {
      isEdit: false,
      nomor: "",
      tanggal: today,
      poNomor: "",
      memo: "",
      gdgKode: "",
      detail: [],
    };
    selectedPO.value = null;
    attemptedSave.value = false;
  },
});

const onSubmit = async (action: "new" | "close" = "close") => {
  attemptedSave.value = true;
  if (!form.value.poNomor || !form.value.gdgKode || form.value.detail.length === 0) {
    toast.warning("PO, Gudang dan minimal 1 baris detail wajib diisi.");
    return;
  }
  for (const d of form.value.detail) {
    if ((d.closed === "1" || d.closed === "Sudah") && !isEdit.value) {
      toast.warning("Terdapat barang yang sudah closed di PO.");
      return;
    }
  }
  form.value.isEdit = isEdit.value;
  isSaving.value = true;
  try {
    await bpbFormApi.save(form.value);
    toast.success("BPB berhasil disimpan.");
    handlePostSave(action, form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan BPB.");
  } finally {
    isSaving.value = false;
  }
};

onMounted(async () => {
  await loadGudang();
  if (isEdit.value) {
    const nomor = String(route.params.nomor);
    isLoading.value = true;
    try {
      const data = await bpbFormApi.getDetailForm(nomor);
      form.value = { ...form.value, ...data, isEdit: true };
      form.value.poNomor = data.poNomor || (data as any).PO || "";
      form.value.gdgKode = data.gdgKode || (data as any).Gudang || "";
      form.value.detail = (data.detail || []).map((d: any, i: number) => ({
        no: i + 1,
        brgKode: d.brgKode || d.Kode,
        brgNama: d.brgNama || d.Nama,
        satuan: d.satuan || d.Satuan,
        qty: Number(d.qty || d.Jumlah) || 0,
        harga: Number(d.harga || d.Harga) || 0,
        discPr: Number(d.discPr || d.Disc) || 0,
        total: Number(d.total || d.Nilai) || 0,
        sudah: Number(d.sudah || d.Sudah) || 0,
        kurang: Number(d.kurang || d.Kurang) || 0,
        closed: d.closed || d.Closed || "0",
        expired: d.expired || d.Expired || "",
        idBatch: d.idBatch || d.IdBatch || "",
      }));
      selectedPO.value = { nomor: form.value.poNomor } as any;
      hitung();
    } catch (e: any) {
      if (isAuthExpiredError(e)) return;
      toast.error(e.response?.data?.message || "Gagal memuat data BPB.");
    } finally {
      isLoading.value = false;
    }
  }
});
</script>

<template>
  <BaseForm
    title="Barang Perolehan (BPB)"
    :icon="IconReceipt"
    :is-loading="isLoading"
    :is-saving="isSaving"
    @save-action="onSubmit"
  >
    <div class="po-layout">
      <div class="po-header-grid">
        <fieldset class="po-groupbox">
          <legend class="po-legend">Informasi BPB</legend>
          <div class="po-groupbody">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Gudang</label>
              <div class="search-group" :class="{ 'field-error-row': gdgError }">
                <input :value="form.gdgKode" class="f-inp readonly-bg" readonly placeholder="Pilih gudang..." />
                <button class="btn-search" type="button" title="Pilih gudang" @click="showGudangModal = true; loadGudang()">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div v-if="gdgError" class="field-error-text">Gudang wajib dipilih.</div>
            <div class="f-row f-row-top">
              <label class="f-lbl">Memo</label>
              <textarea v-model="form.memo" class="f-txa" rows="3" placeholder="Keterangan BPB..."></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset class="po-groupbox">
          <legend class="po-legend">Purchase Order</legend>
          <div class="po-groupbody">
            <div class="f-row">
              <label class="f-lbl">PO</label>
              <div class="search-group" :class="{ 'field-error-row': poError }">
                <input :value="form.poNomor" class="f-inp readonly-bg" readonly placeholder="Pilih PO terbuka..." />
                <button
                  v-if="!isEdit"
                  class="btn-search"
                  type="button"
                  title="Pilih PO"
                  @click="showPOModal = true; searchPO('')"
                >
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div v-if="poError" class="field-error-text">PO wajib dipilih.</div>
            <div class="f-row">
              <label class="f-lbl">Supplier</label>
              <input :value="selectedPO?.supplier || ''" class="f-inp readonly-bg" readonly placeholder="Mengikuti PO" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tgl PO</label>
              <input :value="selectedPO?.tanggal || ''" class="f-inp readonly-bg" readonly placeholder="Mengikuti PO" />
            </div>
            <div v-if="selectedPO?.isTax === 1" class="hint-text">PO ini menggunakan PPN 11%</div>
          </div>
        </fieldset>
      </div>

      <fieldset class="po-groupbox po-detail-group">
        <legend class="po-legend">Detail Barang (dari PO)</legend>
      <div class="table-wrap">
        <table class="ds-tbl">
          <thead>
            <tr>
              <th style="width: 40px">No</th>
              <th style="width: 90px">SKU</th>
              <th style="min-width: 180px">Nama Barang</th>
              <th style="width: 90px" class="tc">Satuan</th>
              <th style="width: 90px" class="tr">Qty PO</th>
              <th style="width: 90px" class="tr">Sudah Terima</th>
              <th style="width: 110px" class="tr">Qty</th>
              <th style="width: 110px" class="tc">Id Batch</th>
              <th style="width: 110px" class="tc">Expired</th>
              <th style="width: 60px" class="tc">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in form.detail" :key="idx">
              <td class="tc">{{ d.no }}</td>
              <td class="mono">{{ d.brgKode }}</td>
              <td>{{ d.brgNama }}</td>
              <td class="tc">{{ d.satuan }}</td>
              <td class="tr">{{ fmtInt(d.kurang + d.sudah) }}</td>
              <td class="tr">{{ fmtInt(d.sudah) }}</td>
              <td>
                <input v-model="d.qty" type="number" class="ds-cell-input tr" @input="(e: any) => { d.qty = parseInput(e.target.value); updateRow(d); }" />
              </td>
              <td class="tc">
                <input v-model="d.idBatch" class="ds-cell-input tc" />
              </td>
              <td class="tc">
                <input v-model="d.expired" type="date" class="ds-cell-input tc" />
              </td>
              <td class="tc">
                <v-btn icon size="x-small" color="error" @click="removeRow(idx)">
                  <IconTrash :size="12" />
                </v-btn>
              </td>
            </tr>
            <tr v-if="form.detail.length === 0">
              <td colspan="10" class="empty-td">Belum ada detail barang.</td>
            </tr>
          </tbody>
        </table>
      </div>

      </fieldset>
    </div>
  </BaseForm>

  <SearchModal
    v-model="showGudangModal"
    title="Pilih Gudang"
    :items="gudangOptions"
    :loading="gudangLoading"
    :columns="[
      { key: 'kode', title: 'Kode' },
      { key: 'nama', title: 'Nama' },
    ]"
    search-key="nama"
    @search="loadGudang"
    @select="selectGudang"
  />

  <SearchModal
    v-model="showPOModal"
    title="Pilih PO Terbuka"
    :items="poOptions"
    :loading="poLoading"
    :columns="[
      { key: 'nomor', title: 'Nomor' },
      { key: 'tanggal', title: 'Tanggal' },
      { key: 'supplier', title: 'Supplier' },
      { key: 'total', title: 'Total' },
    ]"
    search-key="nomor"
    @search="searchPO"
    @select="selectPO"
  />
</template>

<style scoped>
/* ── Layout utama ── */
.po-layout { display: flex; flex-direction: column; gap: 6px; padding: 6px; height: 100%; overflow: hidden; }
.po-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; }
.po-groupbox { border: 1px solid var(--ds-border, #A0AAB8); padding: 0; margin: 0; display: flex; flex-direction: column; min-width: 0; background: white; }
.po-legend { font-size: 11px; font-weight: 700; color: var(--ds-primary, #D97706); text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 6px; margin-left: 6px; background: var(--ds-surface, #F0F3F8); border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none; align-self: flex-start; line-height: 1.4; }
.po-groupbody { padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.po-detail-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }

/* ── Baris field ── */
.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-row-top { align-items: flex-start; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.search-group { display: flex; flex: 1; gap: 2px; }
.f-inp { flex: 1; min-width: 0; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; background: white; color: #1f2937; }
.f-inp:focus, .f-txa:focus { outline: none; border-color: var(--ds-primary, #D97706); }
.readonly-bg { background: var(--ds-surface-inset, #E0E4EA); }
.btn-search { height: 24px; width: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--ds-primary, #D97706); color: white; border: 1px solid var(--ds-primary-dark, #B45309); cursor: pointer; }
.btn-search:hover { background: var(--ds-primary-dark, #B45309); }
.f-txa { flex: 1; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 4px 5px; font-size: 11px; resize: vertical; font-family: inherit; }
.field-error-row .f-inp { border-color: #d32f2f !important; }
.field-error-text { color: #d32f2f; font-size: 10px; font-weight: 600; margin-top: -2px; }
.hint-text { font-size: 10px; font-weight: 600; color: var(--ds-primary, #D97706); }

/* ── Tabel detail ── */
.table-wrap { flex: 1; min-height: 0; margin: 6px 8px 8px; border: 1px solid var(--ds-border, #A0A8B8); overflow: auto; }
.ds-tbl { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 500; }
.ds-tbl thead th { position: sticky; top: 0; z-index: 1; background: var(--ds-primary, #D97706); color: white; font-weight: 700; padding: 5px 6px; font-size: 10px; text-transform: uppercase; text-align: left; white-space: nowrap; border-right: 1px solid var(--ds-primary-dark, #B45309); }
.ds-tbl td { padding: 3px 5px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); border-right: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.ds-tbl tbody tr:nth-child(odd) { background: #F0F3F8; }
.ds-tbl tbody tr:nth-child(even) { background: #E4EBF4; }
.ds-tbl tbody tr:hover td { background: #D8E2EF; }
.ds-cell-input { width: 100%; height: 22px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 4px; font-size: 11px; background: white; }
.ds-cell-input:focus { outline: none; border-color: var(--ds-primary, #D97706); }

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
.calc-val-total { margin-left: auto; font-weight: 700; font-size: 13px; color: var(--ds-primary, #D97706); font-variant-numeric: tabular-nums; }

/* ── Bersama ── */
.tc { text-align: center; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.accent { color: var(--ds-primary, #D97706); }
.mono { font-family: monospace; font-size: 10px; }
.empty-td { text-align: center; color: #9ca3af; font-style: italic; padding: 12px; }

@media (max-width: 1100px) {
  .po-header-grid { grid-template-columns: 1fr; }
  .po-footer-grid .po-groupbox { width: 100%; }
}
</style>
