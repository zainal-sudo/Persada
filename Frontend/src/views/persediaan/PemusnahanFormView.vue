<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { IconTrashX, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  pemusnahanFormApi,
  type PemusnahanForm,
  type PemusnahanDetail,
} from "@/api/persediaan/pemusnahanFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<PemusnahanForm>({
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
    const data = await pemusnahanFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data pemusnahan.");
    router.push({ name: "pemusnahanBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    form.value.nomor = await pemusnahanFormApi.getMaxNomor(
      form.value.tanggal,
      authStore.cabangKode
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor pemusnahan.");
  }
};

const loadGudang = async () => {
  try {
    gudangOptions.value = await pemusnahanFormApi.getGudang();
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
    skuOptions.value = await pemusnahanFormApi.searchSKU(form.value.gudang, query || "");
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

  // Cek duplikat
  const duplicate = form.value.detail.find(
    (d, i) => i !== idx && d.sku === item.sku && d.expired === item.expired
  );
  if (duplicate) {
    toast.warning(`SKU dan expired ada yang sama dengan baris lain.`);
    return;
  }

  try {
    const detail = await pemusnahanFormApi.getDetailSKU(
      form.value.gudang,
      item.sku,
      item.expired
    );

    const d = form.value.detail[idx];
    d.sku = item.sku;
    d.expired = item.expired;
    d.namaBarang = detail.namaBarang;
    d.satuan = detail.satuan;
    d.idBatch = detail.idbatch;
    d.harga = Number(detail.hargabeli);
    hitungNilai(d);

    showSKUModal.value = false;
    // Pola DO ("langsung ke qty"): setelah SKU dipilih, lanjut ke input Qty baris yang sama.
    nextTick(() => pmEnterEdit(idx, "qty"));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat detail SKU.");
  }
};

// ── Auto calculation ─────────────────────────────────────────────────
const hitungNilai = (d: PemusnahanDetail) => {
  d.nilai = Number(d.qty) * Number(d.harga);
};

const onQtyChange = (d: PemusnahanDetail) => {
  hitungNilai(d);
};

const onHargaChange = (d: PemusnahanDetail) => {
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
    tambahDetailItems.value = await pemusnahanFormApi.searchSKU(form.value.gudang, "");
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
      tambahDetailItems.value = await pemusnahanFormApi.searchSKU(form.value.gudang, query);
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
      const detail = await pemusnahanFormApi.getDetailSKU(
        form.value.gudang, item.sku, item.expired
      );
      const row = {
        no: form.value.detail.length + 1,
        sku: item.sku,
        namaBarang: detail.namaBarang,
        idBatch: detail.idbatch || "",
        satuan: detail.satuan,
        expired: item.expired || "",
        qty: 0,
        harga: Number(detail.hargabeli) || 0,
        nilai: 0,
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
  // Pola DO ("langsung ke qty"): fokus ke Qty baris pertama yang baru (mode edit).
  if (added > 0) {
    nextTick(() => pmEnterEdit(firstRow, "qty"));
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Reset ( utk aksi "Simpan & Baru" ) ────────────────────────────────
const resetForm = () => {
  form.value = { isEdit: false, nomor: "", tanggal: today, gudang: "", keterangan: "", detail: [] };
  loadMaxNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Save (kontrak A: BaseForm emit save-action 'new' | 'close') ───────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;

  if (!form.value.gudang) {
    toast.warning("Gudang belum dipilih.");
    return;
  }
  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.sku || d.sku === "0") {
      toast.warning(`SKU Baris ${i + 1} belum dipilih.`);
      return;
    }
  }

  isSaving.value = true;
  try {
    await pemusnahanFormApi.save(form.value);
    toast.success("Data pemusnahan berhasil disimpan.");
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
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);// ── Formatted Number Input (same as DOFormView) ──────────────────────
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

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Kolom interaktif (urutan visual): sku (picker) → idBatch → expired (date,
// navigasi saja) → qty ("qty"-nya pemusnahan) → harga.
const pmCellId = (c: string, r: number) => `pm-cell-${c}-${r}`;

const pmGrid = useDetailGrid({
  cols: ["sku", "idBatch", "expired", "qty", "harga"],
  rowCount: () => form.value.detail.length,
  cellId: pmCellId,
  cellPrefix: "pm-cell",
  onPicker: (r, c) => {
    if (c === "sku") openSKUModal(r);
  },
  typeEditCols: ["idBatch", "qty", "harga"],
  onTypeEdit: (r, c, key) => {
    const el = document.getElementById(pmCellId(c, r)) as HTMLInputElement | null;
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
  focusCell: pmFocusCell,
  gridBlur: pmGridBlur,
  onGridCellFocus: pmOnGridFocus,
  setSelect: pmSetSelect,
  enterEdit: pmEnterEdit,
} = pmGrid;

const isActiveCell = (r: number, c: string) =>
  pmFocusCell.value?.r === r && pmFocusCell.value?.c === c;
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pemusnahan' : 'Tambah Pemusnahan Baru'"
    :icon="IconTrashX"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="pm-layout">
      <!-- ═══ HEADER ═══ -->
      <fieldset class="pm-groupbox">
        <legend class="pm-legend">Informasi Pemusnahan</legend>
        <div class="pm-groupbody">
          <div class="pm-form-grid">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" />
            </div>
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
        </div>
      </fieldset>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="pm-groupbox pm-detail-group">
        <legend class="pm-legend">Detail Pemusnahan</legend>
        <div class="pm-detail-actions">
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
                <th style="width: 100px">IdBatch</th>
                <th style="width: 60px" class="tc">Satuan</th>
                <th style="width: 100px" class="tc">Expired</th>
                <th style="width: 70px" class="tr">Qty</th>
                <th style="width: 90px" class="tr">Harga</th>
                <th style="width: 100px" class="tr">Nilai</th>
                <th style="width: 30px" class="tc"><IconTrash :size="12" /></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc">{{ idx + 1 }}</td>
                <td>
                  <div class="cell-search" :id="pmCellId('sku', idx)" :class="{ 'cell-active': isActiveCell(idx, 'sku') }">
                    <input :value="d.sku" class="cell-inp tc readonly-bg" readonly />
                    <button class="cell-btn" type="button" @click="openSKUModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td><input v-model="d.namaBarang" class="cell-inp readonly-bg" readonly /></td>
                <td><input v-model="d.idBatch" class="cell-inp" :id="pmCellId('idBatch', idx)" :class="{ 'cell-active': isActiveCell(idx, 'idBatch') }" @focus="pmOnGridFocus('idBatch', idx)" @blur="pmGridBlur()" /></td>
                <td><input v-model="d.satuan" class="cell-inp tc readonly-bg" readonly /></td>
                <td><DsDatePicker v-model="d.expired" variant="cell" :id="pmCellId('expired', idx)" @focus="pmOnGridFocus('expired', idx)" @blur="pmGridBlur()" /></td>
                <td>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="cell-inp tr"
                    :id="pmCellId('qty', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'qty') }"
                    :value="getInputValue(`qty-${idx}`, d.qty)"
                    @focus="pmOnGridFocus('qty', idx); startEdit(`qty-${idx}`, $event, d.qty)"
                    @input="d.qty = Number(($event.target as HTMLInputElement).value.replace(/,/g, '')); onQtyChange(d)"
                    @blur="endEdit(`qty-${idx}`, $event, d.qty); onQtyChange(d); pmGridBlur()"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="cell-inp tr"
                    :id="pmCellId('harga', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'harga') }"
                    :value="getInputValue(`harga-${idx}`, d.harga)"
                    @focus="pmOnGridFocus('harga', idx); startEdit(`harga-${idx}`, $event, d.harga)"
                    @input="d.harga = Number(($event.target as HTMLInputElement).value.replace(/,/g, '')); onHargaChange(d)"
                    @blur="endEdit(`harga-${idx}`, $event, d.harga); onHargaChange(d); pmGridBlur()"
                  />
                </td>
                <td class="tr">{{ fmt(d.nilai) }}</td>
                <td class="tc">
                  <button class="btn-del" type="button" @click="removeRow(idx)">
                    <IconTrash :size="12" />
                  </button>
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="10" class="tc empty-cell">Belum ada detail. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.</td>
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
                <td colspan="5" class="empty-cell">Tidak ada barang yang cocok.</td>
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
.pm-layout { display: flex; flex-direction: column; gap: 6px; padding: 6px; height: 100%; overflow-y: auto; }

/* ── Group Box (fieldset) — kanonik ala SO/DO/Jurnal/Barang ── */
.pm-groupbox { border: 1px solid var(--ds-border, #A0AAB8); padding: 0; margin: 0; display: flex; flex-direction: column; }
.pm-legend {
  font-size: 11px; font-weight: 700; color: var(--ds-primary, #0284c7);
  text-transform: uppercase; letter-spacing: 0.03em;
  padding: 2px 6px; margin-left: 6px; line-height: 1.4;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8); border-bottom: none;
  align-self: flex-start;
}
.pm-groupbody { padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.pm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px; }

.pm-detail-group { flex: 1; min-height: 0; }
.pm-detail-actions { display: flex; justify-content: flex-end; padding: 4px 8px; border-bottom: 1px solid var(--ds-border, #A0AAB8); background: var(--ds-surface, #F0F3F8); }

.f-row { display: flex; align-items: center; gap: 4px; width: 100%; }
.f-lbl { width: 80px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ds-text-secondary, #5A6A7E); }
.req { color: #c62828; font-weight: 700; }

.f-inp { flex: 1; min-width: 0; max-width: 400px; height: 24px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 5px; font-size: 11px; outline: none; box-sizing: border-box; background: #fff; color: var(--ds-text, #0c4a6e); }
.f-inp:focus { border-color: var(--ds-primary, #0284c7); }
.readonly-bg { background: var(--ds-surface-inset, #E0E4EA); color: #3D4F6A; }

.detail-table-wrap { flex: 1; min-height: 0; overflow: auto; border-top: 1px solid var(--ds-border, #A0AAB8); }
.detail-table { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 500; }
.detail-table thead tr { background: var(--ds-primary, #0284c7); }
.detail-table th { color: white; font-weight: 700; padding: 4px 6px; white-space: nowrap; text-align: left; position: sticky; top: 0; z-index: 1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; border-right: 1px solid var(--ds-primary-dark, #0369a1); border-bottom: 1px solid var(--ds-primary-dark, #0369a1); }
.detail-table th:last-child { border-right: none; }
.detail-table td { padding: 2px 4px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); border-right: 1px solid var(--ds-border-light, #C4CAD3); vertical-align: middle; white-space: nowrap; }
.detail-table td:last-child { border-right: none; }
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
.cell-inp { width: 100%; height: 20px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 3px; font-size: 11px; outline: none; background: #fff; box-sizing: border-box; }
.cell-inp:focus { border-color: var(--ds-primary, #0284c7); }
.cell-btn { height: 20px; width: 22px; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); border-radius: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.cell-btn:hover { background: var(--ds-primary-dark, #0369a1); }
.btn-add-row { height: 24px; padding: 0 10px; background: var(--ds-primary, #0284c7); color: white; border: 1px solid var(--ds-primary-dark, #0369a1); border-radius: 0; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.btn-add-row:hover { background: var(--ds-primary-dark, #0369a1); }
.btn-del { background: none; border: none; color: #c62828; cursor: pointer; padding: 2px 4px; display: flex; align-items: center; justify-content: center; }
.btn-del:hover { background: #ffebee; }
.tc { text-align: center; }
.tr { text-align: right; }
.empty-cell { color: var(--ds-text-muted, #8494A7); font-style: italic; padding: 24px 12px; }

@media (max-width: 1024px) { .pm-form-grid { grid-template-columns: 1fr; } }

/* ── Modal Tambah Detail (checklist) ──────────────────────── */
.modal-loading { padding: 20px; text-align: center; color: var(--ds-text-muted, #8494A7); font-size: 12px; }
.modal-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.modal-tbl th { background: var(--ds-primary, #0284c7); color: white; font-weight: 700; padding: 5px 8px; text-align: left; white-space: nowrap; }
.modal-tbl td { padding: 4px 8px; border-bottom: 1px solid var(--ds-border-light, #C4CAD3); white-space: nowrap; }
.modal-row { cursor: pointer; }
.modal-row:hover td { background: var(--ds-primary-50, #E8EDF5); }
.tb-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tb-search-input { flex: 1; height: 28px; border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0; padding: 0 8px; font-size: 12px; outline: none; background: #fff; }
.tb-search-input:focus { border-color: var(--ds-primary, #0284c7); }
.tb-table-wrap { max-height: 360px; overflow-y: auto; border: 1px solid var(--ds-border-light, #C4CAD3); }
.tb-actions { border-top: 1px solid var(--ds-border, #A0AAB8); }
.tb-count { font-size: 11px; font-weight: 600; color: var(--ds-primary, #0284c7); }
.tb-add-btn { border-radius: 0; text-transform: none; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }
</style>