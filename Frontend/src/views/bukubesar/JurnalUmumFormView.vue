<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useDetailGrid } from "@/composables/useDetailGrid";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconBook2, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  jurnalUmumFormApi,
  type JurnalUmumForm,
  type JurnalUmumDetail,
} from "@/api/bukubesar/jurnalUmumFormApi";

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
const blankForm = (): JurnalUmumForm => ({
  isEdit: false,
  nomor: "",
  tanggal: today,
  keterangan: "",
  detail: [],
});
const form = ref<JurnalUmumForm>(blankForm());

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

// ── Modal State ──────────────────────────────────────────────────────
const showAccountModal = ref(false);
const activeDetailIndex = ref(-1);

// ── Navigasi grid detail (ala Excel) — keyboard-first ────────────────
const juCellId = (c: string, r: number) => `ju-cell-${c}-${r}`;
// Kolom picker memakai nama "akun" (bukan "account") agar dikenali regex
// picker useDetailGrid → Enter langsung membuka modal pencarian account.
const juGrid = useDetailGrid({
  cols: ["akun", "debet", "kredit", "memo", "costCenter"],
  rowCount: () => form.value.detail.length,
  cellId: juCellId,
  cellPrefix: "ju-cell",
  onPicker: (r, c) => {
    if (c === "akun") openAccountModal(r);
  },
  typeEditCols: ["debet", "kredit", "memo"],
});

const {
  focusCell: juFocusCell,
  editMode: juEditMode,
  gridBlur: juGridBlur,
  onGridCellFocus: juOnGridFocus,
  setSelect: juSetSelect,
  enterEdit: juEnterEdit,
  commitEdit: juCommitEdit,
} = juGrid;

const isActiveCell = (r: number, c: string) =>
  juFocusCell.value?.r === r && juFocusCell.value?.c === c;

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
    const data = await jurnalUmumFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
    isLocked.value = !!data.locked;
    if (isLocked.value) {
      toast.warning("Transaksi ini sudah tutup Periode, tidak dapat diubah.");
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data jurnal umum.");
    router.push({ name: "jurnalUmumBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    const cabang = authStore.cabangKode || "01";
    form.value.nomor = await jurnalUmumFormApi.getMaxNomor(form.value.tanggal, cabang);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor jurnal.");
  }
};

const loadCostCenter = async () => {
  try {
    costCenterOptions.value = await jurnalUmumFormApi.searchCostCenter();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat cost center.");
  }
};

// ── Watch tanggal → generate nomor baru ──────────────────────────────
watch(
  () => form.value.tanggal,
  async () => {
    if (!form.value.isEdit) {
      await loadMaxNomor();
    }
  }
);

// ── Search Account ───────────────────────────────────────────────────
const searchAccount = async (query: string) => {
  accountLoading.value = true;
  try {
    accountOptions.value = await jurnalUmumFormApi.searchAccount(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari account.");
  } finally {
    accountLoading.value = false;
  }
};

const openAccountModal = (idx: number) => {
  activeDetailIndex.value = idx;
  showAccountModal.value = true;
  searchAccount("");
};

const selectAccount = (item: any) => {
  const idx = activeDetailIndex.value;
  if (idx < 0 || !form.value.detail[idx]) return;

  form.value.detail[idx].account = item.kode;
  form.value.detail[idx].accountName = item.nama;
  showAccountModal.value = false;
  // Pola DO ("langsung ke qty"): setelah account dipilih, lanjut ke input Debet baris yang sama.
  nextTick(() => juEnterEdit(idx, "debet"));
};

// ── Detail Grid ──────────────────────────────────────────────────────
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
    tambahDetailItems.value = await jurnalUmumFormApi.searchAccount("");
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
      tambahDetailItems.value = await jurnalUmumFormApi.searchAccount(query);
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
    // Dup-guard: account yang sudah ada di detail di-skip diam-diam (pola DO).
    if (form.value.detail.some((x) => x.account === acc.kode)) continue;
    form.value.detail.push({
      no: form.value.detail.length + 1,
      account: acc.kode,
      accountName: acc.nama,
      debet: 0,
      kredit: 0,
      memo: "",
      costCenter: "",
    });
    added++;
  }
  if (!added) toast.warning("Account terpilih sudah ada di detail.");
  showTambahDetailModal.value = false;
  // Pola DO ("langsung ke qty"): fokus ke Debet baris pertama yang baru (mode edit).
  if (added > 0) {
    nextTick(() => juEnterEdit(firstRow, "debet"));
  }
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Auto clear kredit jika debet diisi ───────────────────────────────
const onDebetChange = (d: JurnalUmumDetail) => {
  if (Number(d.debet) > 0) {
    d.kredit = 0;
  }
};

// ── Auto clear debet jika kredit diisi ───────────────────────────────
const onKreditChange = (d: JurnalUmumDetail) => {
  if (Number(d.kredit) > 0) {
    d.debet = 0;
  }
};

// ── Validasi ─────────────────────────────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  if (isLocked.value) {
    toast.warning("Transaksi ini sudah tutup Periode,Tidak dapat di edit");
    return false;
  }
  let totalDebet = 0;
  let totalKredit = 0;

  for (let i = 0; i < form.value.detail.length; i++) {
    const d = form.value.detail[i];
    if (!d.account) {
      toast.warning(`Account baris ${i + 1} belum dipilih.`);
      return false;
    }
    if (Number(d.debet) > 0 && Number(d.kredit) > 0) {
      toast.warning(`Nilai debet dan kredit tidak boleh terisi dua-duanya (baris ${i + 1}).`);
      return false;
    }
    totalDebet += Number(d.debet);
    totalKredit += Number(d.kredit);
  }

  if (totalDebet !== totalKredit) {
    toast.warning("Nilai debet dan kredit tidak sama.");
    return false;
  }

  if (totalDebet === 0) {
    toast.warning("Belum ada nilai yang diisi.");
    return false;
  }

  // Paritas Delphi cekTutupPeriode sebelum simpan (server menegakkan ulang)
  try {
    if (await jurnalUmumFormApi.cekPeriode(form.value.tanggal)) {
      toast.warning("Periode ini sudah di tutup.");
      return false;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return false;
    toast.error(e.response?.data?.message || "Gagal cek periode.");
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
    await jurnalUmumFormApi.save(form.value);
    handlePostSave(action, form.value.nomor);
    toast.success("Data jurnal umum berhasil disimpan.");
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
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Jurnal Umum' : 'Tambah Jurnal Umum Baru'"
    :icon="IconBook2"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    :disabled="isLocked"
    @save-action="confirmSave"
  >
    <div class="ju-layout">
      <!-- ═══ HEADER ═══ -->
      <fieldset class="ju-groupbox">
        <legend class="ju-legend">Informasi Jurnal</legend>
        <div class="ju-groupbody">
          <div class="f-row">
            <label class="f-lbl">Nomor</label>
            <input :value="form.nomor" class="f-inp readonly" readonly />
          </div>
          <div class="f-row">
            <label class="f-lbl">Tanggal</label>
            <DsDatePicker v-model="form.tanggal" variant="form" style="width: 140px; max-width: 140px;" />
          </div>
          <div class="f-row">
            <label class="f-lbl">Memo</label>
            <input
              v-model="form.keterangan"
              class="f-inp"
              placeholder="Keterangan..."
            />
          </div>
        </div>
      </fieldset>

      <!-- ═══ DETAIL GRID ═══ -->
      <fieldset class="ju-groupbox ju-detail-group">
        <legend class="ju-legend">Detail Jurnal</legend>
        <div class="ju-detail-toolbar">
          <button class="btn-add-row" type="button" @click="openTambahDetail">
            <IconPlus :size="12" /> Tambah Detail
          </button>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 36px" class="tc">No</th>
                <th style="width: 95px">Account</th>
                <th style="min-width: 200px">Account Name</th>
                <th style="width: 120px" class="tr">Debet</th>
                <th style="width: 120px" class="tr">Kredit</th>
                <th style="width: 200px">Keterangan</th>
                <th style="width: 120px">Cost Center</th>
                <th style="width: 30px" class="tc">✕</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in form.detail" :key="idx">
                <td class="tc row-no">{{ idx + 1 }}</td>
                <td>
                  <div class="cell-search" :id="juCellId('akun', idx)" :class="{ 'cell-active': isActiveCell(idx, 'akun') }">
                    <input :value="d.account" class="cell-inp tc readonly" readonly @focus="juOnGridFocus('akun', idx)" @blur="juGridBlur()" />
                    <button class="cell-btn" type="button" @click="openAccountModal(idx)">
                      <IconSearch :size="11" />
                    </button>
                  </div>
                </td>
                <td><input v-model="d.accountName" class="cell-inp readonly" readonly /></td>
                <td>
                  <input
                    v-model.number="d.debet"
                    type="number"
                    class="cell-inp tr"
                    :id="juCellId('debet', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'debet') }"
                    min="0"
                    @focus="juOnGridFocus('debet', idx)"
                    @blur="juGridBlur()"
                    @input="onDebetChange(d)"
                  />
                </td>
                <td>
                  <input
                    v-model.number="d.kredit"
                    type="number"
                    class="cell-inp tr"
                    :id="juCellId('kredit', idx)"
                    :class="{ 'cell-active': isActiveCell(idx, 'kredit') }"
                    min="0"
                    @focus="juOnGridFocus('kredit', idx)"
                    @blur="juGridBlur()"
                    @input="onKreditChange(d)"
                  />
                </td>
                <td><input v-model="d.memo" class="cell-inp" :id="juCellId('memo', idx)" :class="{ 'cell-active': isActiveCell(idx, 'memo') }" @focus="juOnGridFocus('memo', idx)" @blur="juGridBlur()" /></td>
                <td>
                  <select v-model="d.costCenter" class="cell-inp" :id="juCellId('costCenter', idx)" :class="{ 'cell-active': isActiveCell(idx, 'costCenter') }" @focus="juOnGridFocus('costCenter', idx)" @blur="juGridBlur()">
                    <option value="" disabled>-- Pilih --</option>
                    <option v-for="cc in costCenterOptions" :key="cc.kode" :value="cc.kode">
                      {{ cc.kode }}
                    </option>
                  </select>
                </td>
                <td class="tc">
                  <button class="btn-del" type="button" @click="removeRow(idx)">✕</button>
                </td>
              </tr>
              <tr v-if="form.detail.length === 0">
                <td colspan="8" class="empty-state">Belum ada detail. Klik <strong>"Tambah Detail"</strong> untuk mulai mengisi.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="footer-row">
                <td colspan="3" class="tc bold">TOTAL</td>
                <td class="tr bold">{{ fmt(form.detail.reduce((s, d) => s + Number(d.debet), 0)) }}</td>
                <td class="tr bold">{{ fmt(form.detail.reduce((s, d) => s + Number(d.kredit), 0)) }}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH ACCOUNT ═══ -->
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
    @select="selectAccount"
    @search="searchAccount"
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
/* ═══════════════════════════════════════════════════════════════
   JURNAL UMUM — Classic Desktop Layout
   Steel Blue × Plus Jakarta Sans × Desktop ERP Aesthetic
   ═══════════════════════════════════════════════════════════════ */

button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

/* ── Layout ──────────────────────────────────────────────────── */
.ju-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow: hidden;
}

/* ── Group Box (fieldset) ────────────────────────────────────── */
.ju-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.ju-legend {
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

.ju-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Detail Group ────────────────────────────────────────────── */
.ju-detail-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ju-detail-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px 0;
}

/* ── Field Row ────────────────────────────────────────────────── */
.f-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.f-lbl {
  width: 70px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

/* ── Input (sunken desktop style) ─────────────────────────────── */
.f-inp {
  flex: 1;
  max-width: 430px;
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

.readonly {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
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

/* Sorotan sel terfokus (navigasi grid a la Excel) */
.cell-active {
  outline: 2px solid var(--ds-primary, #0284c7) !important;
  outline-offset: -1px;
}

.footer-row {
  background: var(--ds-primary-50, #E8EDF5);
  font-weight: 700;
}

.footer-row td {
  padding: 6px;
  border-top: 2px solid var(--ds-primary, #0284c7);
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

/* ── Cell Input / Search / Button ─────────────────────────────── */
.cell-search {
  display: flex;
  gap: 2px;
}

.cell-inp {
  width: 100%;
  height: 22px;
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

.cell-inp.readonly {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

select.cell-inp {
  background: white;
  color: var(--ds-text, #0c4a6e);
}

.cell-btn {
  height: 22px;
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

.btn-add-row {
  height: 24px;
  padding: 0 10px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1);
  border-radius: 0;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-add-row:hover {
  background: var(--ds-primary-dark, #0369a1);
}

.btn-del {
  background: none;
  border: none;
  color: var(--ds-danger, #c62828);
  cursor: pointer;
  font-weight: bold;
  padding: 2px 4px;
}

.btn-del:hover {
  background: #ffebee;
}

/* ── Utility ──────────────────────────────────────────────────── */
.tc { text-align: center; }
.tr { text-align: right; }
.bold { font-weight: 700; }
.mono { font-family: var(--ds-font-mono, "Consolas", monospace); font-size: 10px; }

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
</style>