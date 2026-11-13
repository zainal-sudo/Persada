<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import { IconBox } from "@tabler/icons-vue";
import {
  barangFormApi,
  type BarangForm,
  type HargaJualJenis,
} from "@/api/persediaan/barangFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.kode || !!route.params.nomor);
const editKode = computed(() =>
  String(route.params.kode ?? route.params.nomor ?? ""),
);
const isLoading = ref(false);
const isSaving = ref(false);

// ── Form State ───────────────────────────────────────────────────────
const emptyForm = (): BarangForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  satuan: "",
  ktgKode: "",
  grKode: 1,
  gdgDefault: "",
  supKode: "",
  isAktif: false,
  isStok: false,
  isExpired: false,
  isProductFocus: false,
  hargaBeli: 0,
  hargaJual: 0,
  minStok: 0,
  maxStok: 0,
  merk: "",
  discSales: 0,
  het: 0,
  detail: [],
});

const form = ref<BarangForm>(emptyForm());

// ── Lookup Options ───────────────────────────────────────────────────
const tipeBarangOptions = ref<{ kode: number; nama: string }[]>([]);
const kategoriOptions = ref<{ kode: string; nama: string }[]>([]);
const gudangOptions = ref<{ kode: string; nama: string }[]>([]);
const supplierOptions = ref<{ kode: string; nama: string }[]>([]);

// ── HET hanya untuk FINANCE ──────────────────────────────────────────
const canEditHET = computed(() => {
  return authStore.userKode?.toUpperCase() === "FINANCE";
});

// ── Load Lookup Options ──────────────────────────────────────────────
const loadOptions = async () => {
  const [tipe, kategori, gudang, supplier] = await Promise.allSettled([
    barangFormApi.getTipeBarang(),
    barangFormApi.getKategori(),
    barangFormApi.getGudang(),
    barangFormApi.getSupplier(),
  ]);
  tipeBarangOptions.value = tipe.status === "fulfilled" ? tipe.value : [];
  kategoriOptions.value =
    kategori.status === "fulfilled" ? kategori.value : [];
  gudangOptions.value = gudang.status === "fulfilled" ? gudang.value : [];
  supplierOptions.value =
    supplier.status === "fulfilled" ? supplier.value : [];

  const failed = [
    ["Tipe Barang", tipe],
    ["Kategori", kategori],
    ["Gudang", gudang],
    ["Supplier", supplier],
  ].filter(
    ([, r]) =>
      (r as PromiseSettledResult<any>).status === "rejected",
  ).map(([label]) => label as string);
  const expired =
    [tipe, kategori, gudang, supplier].some(
      (r) => r.status === "rejected" && isAuthExpiredError(r.reason),
    );
  if (failed.length && !expired) {
    toast.error(`Gagal memuat data lookup: ${failed.join(", ")}.`);
  }
};

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  if (!isEdit.value) {
    form.value.isEdit = false;
    await loadMaxKode();
    await loadHargaJualJenis("");
    return;
  }

  isLoading.value = true;
  try {
    const data = await barangFormApi.getDetailForm(
      decodeURIComponent(editKode.value),
    );
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: String(data.kode || editKode.value),
      grKode: Number(data.grKode) || 1,
      hargaBeli: Number(data.hargaBeli) || 0,
      hargaJual: Number(data.hargaJual) || 0,
      minStok: Number(data.minStok) || 0,
      maxStok: Number(data.maxStok) || 0,
      discSales: Number(data.discSales) || 0,
      het: Number(data.het) || 0,
      isAktif: Boolean(data.isAktif),
      isStok: Boolean(data.isStok),
      isExpired: Boolean(data.isExpired),
      isProductFocus: Boolean(data.isProductFocus),
    };
    await loadHargaJualJenis(editKode.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data barang.");
  } finally {
    isLoading.value = false;
  }
};

const loadMaxKode = async () => {
  try {
    const kode = await barangFormApi.getMaxKode();
    form.value.kode = String(kode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate kode barang.");
  }
};

const loadHargaJualJenis = async (brgKode: string) => {
  try {
    form.value.detail = await barangFormApi.getHargaJualJenis(brgKode);
    // Pola DO: setelah daftar termuat, sorot sel Harga Jual baris pertama
    // (sorot saja — user tinggal Enter untuk edit, panah untuk pindah baris).
    if (form.value.detail.length > 0) {
      nextTick(() => bgSetSelect(0, "hargajual"));
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat harga jual jenis.");
  }
};

// ── Navigasi grid detail (pola DOFormView — keyboard-first) ─────────
// Grid ini master-data: baris di-generate sistem per jenis customer
// (tanpa tombol tambah), kolom interaktif hanya Harga Jual.
const bgCellId = (c: string, r: number) => `bg-cell-${c}-${r}`;

const bgGrid = useDetailGrid({
  cols: ["hargajual"],
  rowCount: () => form.value.detail.length,
  cellId: bgCellId,
  cellPrefix: "bg-cell",
  typeEditCols: ["hargajual"],
});

const {
  focusCell: bgFocusCell,
  gridBlur: bgGridBlur,
  onGridCellFocus: bgOnGridFocus,
  setSelect: bgSetSelect,
} = bgGrid;

const isActiveCell = (r: number, c: string) =>
  bgFocusCell.value?.r === r && bgFocusCell.value?.c === c;

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await barangFormApi.save(form.value);
    handlePostSave(action, String(form.value.kode ?? ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data barang.");
  } finally {
    isSaving.value = false;
  }
};

// ── Input angka terformat (pola SO/FP: teks + pemisah ribuan, no spinner) ──
const rawInputValues: Record<string, string> = {};
const parseInput = (raw: string): number => {
  const n = Number(String(raw).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};
const getInputValue = (key: string, modelValue: number, decimals = 2): string => {
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
const onHeaderInput = (field: string, key: string, e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  rawInputValues[key] = val;
  (form.value as any)[field] = parseInput(val);
};
const onDetailInput = (d: HargaJualJenis, key: string, e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  rawInputValues[key] = val;
  d.hargajual = parseInput(val);
};

// ── Reset form (Simpan & Baru) ───────────────────────────────────────
const resetForm = async () => {
  // Buang sisa buffer input terformat agar grid & field tampil 0/kosong.
  for (const key of Object.keys(rawInputValues)) delete rawInputValues[key];
  form.value = emptyForm();
  bgFocusCell.value = null;
  await loadMaxKode();
  await loadHargaJualJenis("");
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadOptions();
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Barang' : 'Tambah Barang Baru'"
    :icon="IconBox"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="bg-layout">
      <!-- ═══ HEADER: 2 groupbox berdampingan (ala SO) ═══ -->
      <div class="bg-header-grid">
        <!-- Informasi Barang -->
        <fieldset class="bg-groupbox">
          <legend class="bg-legend">Informasi Barang</legend>
          <div class="bg-groupbody">
            <div class="f-row">
              <label class="f-lbl">Tipe Barang</label>
              <select v-model="form.grKode" class="f-inp">
                <option v-for="gr in tipeBarangOptions" :key="gr.kode" :value="gr.kode">
                  {{ gr.nama }}
                </option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Kode</label>
              <input :value="form.kode" class="f-inp readonly-bg" readonly placeholder="Auto..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Nama <span class="req">*</span></label>
              <input v-model="form.nama" class="f-inp" maxlength="60" placeholder="Nama barang..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Satuan <span class="req">*</span></label>
              <input v-model="form.satuan" class="f-inp" maxlength="10" placeholder="PCS..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Kategori <span class="req">*</span></label>
              <select v-model="form.ktgKode" class="f-inp">
                <option value="" disabled>-- Pilih Kategori --</option>
                <option v-for="k in kategoriOptions" :key="k.kode" :value="k.kode">
                  {{ k.kode }} - {{ k.nama }}
                </option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Merk</label>
              <input v-model="form.merk" class="f-inp" maxlength="20" placeholder="Merk..." />
            </div>
            <div class="f-row">
              <label class="f-lbl">Gudang Default</label>
              <select v-model="form.gdgDefault" class="f-inp">
                <option value="" disabled>-- Pilih Gudang --</option>
                <option v-for="g in gudangOptions" :key="g.kode" :value="g.kode">
                  {{ g.kode }} - {{ g.nama }}
                </option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- Status, Harga & Stok -->
        <fieldset class="bg-groupbox">
          <legend class="bg-legend">Status, Harga &amp; Stok</legend>
          <div class="bg-groupbody">
            <div class="f-row check-row">
              <label class="check-lbl"><input v-model="form.isAktif" type="checkbox" /> Aktif</label>
              <label class="check-lbl"><input v-model="form.isStok" type="checkbox" /> IsStok</label>
              <label class="check-lbl"><input v-model="form.isExpired" type="checkbox" /> IsExpired</label>
              <label class="check-lbl"><input v-model="form.isProductFocus" type="checkbox" /> Product Focus</label>
            </div>
            <div class="f-row">
              <label class="f-lbl">Harga Beli</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp text-right"
                :value="getInputValue('hargaBeli', form.hargaBeli, 2)"
                @focus="startEdit('hargaBeli', $event, form.hargaBeli)"
                @input="onHeaderInput('hargaBeli', 'hargaBeli', $event)"
                @blur="endEdit('hargaBeli', $event, form.hargaBeli, 2)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Harga Jual</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp text-right"
                :value="getInputValue('hargaJual', form.hargaJual, 2)"
                @focus="startEdit('hargaJual', $event, form.hargaJual)"
                @input="onHeaderInput('hargaJual', 'hargaJual', $event)"
                @blur="endEdit('hargaJual', $event, form.hargaJual, 2)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Pemasok Utama</label>
              <select v-model="form.supKode" class="f-inp">
                <option value="" disabled>-- Pilih Supplier --</option>
                <option v-for="s in supplierOptions" :key="s.kode" :value="s.kode">
                  {{ s.kode }} - {{ s.nama }}
                </option>
              </select>
            </div>
            <div class="f-row">
              <label class="f-lbl">Min Stok</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp text-right"
                :value="getInputValue('minStok', form.minStok, 0)"
                @focus="startEdit('minStok', $event, form.minStok)"
                @input="onHeaderInput('minStok', 'minStok', $event)"
                @blur="endEdit('minStok', $event, form.minStok, 0)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Max Stok</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp text-right"
                :value="getInputValue('maxStok', form.maxStok, 0)"
                @focus="startEdit('maxStok', $event, form.maxStok)"
                @input="onHeaderInput('maxStok', 'maxStok', $event)"
                @blur="endEdit('maxStok', $event, form.maxStok, 0)"
              />
            </div>
            <div class="f-row">
              <label class="f-lbl">Disc Salesman</label>
              <input
                type="text"
                inputmode="decimal"
                class="f-inp text-right"
                :value="getInputValue('discSales', form.discSales, 2)"
                @focus="startEdit('discSales', $event, form.discSales)"
                @input="onHeaderInput('discSales', 'discSales', $event)"
                @blur="endEdit('discSales', $event, form.discSales, 2)"
              />
              <span class="f-hint">%</span>
            </div>
            <div class="f-row">
              <label class="f-lbl">Batas Harga</label>
              <input
                type="text"
                inputmode="numeric"
                class="f-inp text-right"
                :class="{ 'readonly-bg': !canEditHET }"
                :value="getInputValue('het', form.het, 2)"
                :disabled="!canEditHET"
                :title="canEditHET ? '' : 'Hanya FINANCE dapat mengubah HET'"
                @focus="startEdit('het', $event, form.het)"
                @input="onHeaderInput('het', 'het', $event)"
                @blur="endEdit('het', $event, form.het, 2)"
              />
            </div>
          </div>
        </fieldset>
      </div>

      <!-- ═══ GRID HARGA JUAL PER JENIS CUSTOMER ═══ -->
      <fieldset class="bg-groupbox bg-detail-group">
        <legend class="bg-legend">Harga Jual per Jenis Customer</legend>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 36px" class="tc">No</th>
                <th style="width: 100px" class="tc">Kode Jenis</th>
                <th style="min-width: 200px">Jenis Customer</th>
                <th style="width: 160px" class="tr">Harga Jual</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc row-no">{{ idx + 1 }}</td>
                <td class="tc mono">{{ d.kode }}</td>
                <td class="cell-muted">{{ d.nama }}</td>
                <td>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="cell-inp tr"
                    :id="bgCellId('hargajual', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'hargajual') }"
                    :value="getInputValue('hjj-' + idx, d.hargajual, 2)"
                    @focus="bgOnGridFocus('hargajual', idx); startEdit('hjj-' + idx, $event, d.hargajual)"
                    @input="onDetailInput(d, 'hjj-' + idx, $event)"
                    @blur="endEdit('hjj-' + idx, $event, d.hargajual, 2); bgGridBlur()"
                  />
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="4" class="empty-state">Tidak ada data.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  </BaseForm>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   BARANG FORM — Classic Desktop Groupbox (sama seperti SO/Jurnal)
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.bg-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow-y: auto;
}

.bg-header-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.bg-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.bg-legend {
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

.bg-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group (grid harga jenis) ─────────────────────────── */
.bg-detail-group {
  flex: 1;
  min-height: 160px;
}

/* ── Field Row ───────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-lbl {
  width: 90px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.req { color: #c62828; font-weight: 700; }
.f-hint { font-size: 11px; color: var(--ds-text-muted, #8494A7); }
.text-right { text-align: right; }

/* ── Input (sunken desktop style) ────────────────────────────── */
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

/* ── Checkbox ────────────────────────────────────────────────── */
.check-row { gap: 12px; flex-wrap: wrap; }
.check-lbl {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  cursor: pointer;
  user-select: none;
}
.check-lbl input {
  accent-color: var(--ds-primary, #0284c7);
  width: 13px;
  height: 13px;
  margin: 0;
}

/* ── Detail Table ────────────────────────────────────────────── */
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
.detail-table thead tr { background: var(--ds-primary, #0284c7); }
.detail-table th {
  color: white;
  font-weight: 700;
  padding: 4px 8px;
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
.detail-table th:last-child { border-right: none; }
.detail-table td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-right: 1px solid var(--ds-border-light, #C4CAD3);
  vertical-align: middle;
  white-space: nowrap;
}
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

.row-no { color: var(--ds-text-muted, #8494A7); font-size: 10px; }
.cell-muted { color: var(--ds-text, #0c4a6e); font-weight: 600; padding: 0 6px; }
.cell-inp {
  width: 100%;
  height: 20px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 4px;
  font-size: 11px;
  outline: none;
  background: white;
  box-sizing: border-box;
}
.cell-inp:focus { border-color: var(--ds-primary, #0284c7); }
.empty-state {
  text-align: center;
  color: var(--ds-text-muted, #8494A7);
  font-size: 11px;
  padding: 24px 12px;
}

/* ── Utility ─────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

@media (max-width: 1024px) {
  .bg-header-grid { grid-template-columns: 1fr; }
}
</style>
