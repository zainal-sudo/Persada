<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconPercentage, IconSearch, IconPlus, IconTrash } from "@tabler/icons-vue";
import {
  settingBiayaPromosiFormApi,
  type SettingBiayaPromosiForm,
  type BiayaPromosiDetail,
} from "@/api/daftar/settingBiayaPromosiFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<SettingBiayaPromosiForm>({
  isEdit: false,
  nomor: "",
  cusKode: "",
  cusNama: "",
  alamat: "",
  detail: [],
});

// ── Lookup State ─────────────────────────────────────────────────────
const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);
const barangOptions = ref<any[]>([]);
const barangLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showCustomerModal = ref(false);
const showBarangModal = ref(false);
const activeDetailIndex = ref(-1);
const isAddRowMode = ref(false);

watch(showBarangModal, (val) => {
  if (!val && isAddRowMode.value) {
    isAddRowMode.value = false;
  }
});

// ── Persen untuk "Ubah Semua" ────────────────────────────────────────
const persenAll = ref(0);

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
    const data = await settingBiayaPromosiFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data biaya promosi.");
    router.push({ name: "settingBiayaPromosiBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    form.value.nomor = await settingBiayaPromosiFormApi.getMaxNomor();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor biaya promosi.");
  }
};

// ── Search Customer ──────────────────────────────────────────────────
const searchCustomer = async (query: string) => {
  customerLoading.value = true;
  try {
    customerOptions.value = await settingBiayaPromosiFormApi.getCustomer(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari customer.");
  } finally {
    customerLoading.value = false;
  }
};

const selectCustomer = (item: any) => {
  form.value.cusKode = item.kode;
  form.value.cusNama = item.customer;
  form.value.alamat = item.alamat || "";
  showCustomerModal.value = false;
};

// ── Search Barang ────────────────────────────────────────────────────
const searchBarang = async (query: string) => {
  barangLoading.value = true;
  try {
    barangOptions.value = await settingBiayaPromosiFormApi.getBarang(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari barang.");
  } finally {
    barangLoading.value = false;
  }
};

const openBarangModal = (idx: number) => {
  activeDetailIndex.value = idx;
  isAddRowMode.value = false;
  showBarangModal.value = true;
  searchBarang("");
};

const selectBarang = (item: any) => {
  if (isAddRowMode.value) {
    form.value.detail.push({
      no: form.value.detail.length + 1,
      kode: item.kode,
      nama: item.nama,
      persen: 0,
      rupiah: 0,
    });
    isAddRowMode.value = false;
  } else {
    const idx = activeDetailIndex.value;
    if (idx < 0 || !form.value.detail[idx]) return;
    form.value.detail[idx].kode = item.kode;
    form.value.detail[idx].nama = item.nama;
  }
  showBarangModal.value = false;
};

// ── Detail Grid ──────────────────────────────────────────────────────
const addRow = () => {
  isAddRowMode.value = true;
  activeDetailIndex.value = -1;
  showBarangModal.value = true;
  searchBarang("");
};

const removeRow = (idx: number) => {
  form.value.detail.splice(idx, 1);
  form.value.detail.forEach((d, i) => (d.no = i + 1));
};

// ── Ubah Semua ───────────────────────────────────────────────────────
const ubahSemua = () => {
  for (const d of form.value.detail) {
    d.persen = Number(persenAll.value) || 0;
  }
};

// ── All Item ─────────────────────────────────────────────────────────
const allItem = async () => {
  if (!form.value.cusKode) {
    toast.warning("Customer belum dipilih.");
    return;
  }

  try {
    const items = await settingBiayaPromosiFormApi.getAllItem(form.value.cusKode);
    if (items.length === 0) {
      toast.info("Tidak ada item untuk customer ini.");
      return;
    }

    form.value.detail = items.map((item, i) => ({
      no: i + 1,
      kode: item.kode,
      nama: item.nama,
      persen: 0,
      rupiah: 0,
    }));

  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat all item.");
  }
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await settingBiayaPromosiFormApi.save(form.value);
    handlePostSave(action, form.value.nomor);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = { isEdit: false, nomor: "", cusKode: "", cusNama: "", alamat: "", detail: [] };
  loadMaxNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Setting Biaya Promosi' : 'Tambah Setting Biaya Promosi Baru'"
    :icon="IconPercentage"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <!-- ═══ HEADER ═══ -->
    <div class="bp-header">
      <div class="header-left">
        <div class="f-row">
          <label class="f-lbl">Customer <span class="req">*</span></label>
          <div class="search-group">
            <input
              :value="form.cusNama"
              class="f-inp w-300 readonly"
              readonly
              placeholder="Pilih customer..."
            />
            <button class="btn-search" type="button" @click="showCustomerModal = true; searchCustomer('')">
              <IconSearch :size="14" />
            </button>
          </div>
        </div>
        <div class="f-row">
          <label class="f-lbl">Alamat</label>
          <input :value="form.alamat" class="f-inp w-400" readonly />
        </div>
      </div>
      <div class="header-right">
        <div class="f-row">
          <label class="f-lbl">Nomor</label>
          <input :value="form.nomor" class="f-inp w-140 readonly" readonly />
        </div>
      </div>
    </div>

    <!-- ═══ TOOLBAR PERSEN ═══ -->
    <div class="bp-toolbar">
      <label class="f-lbl">Persen</label>
      <input
        v-model.number="persenAll"
        type="number"
        class="f-inp w-73"
        min="0"
        step="0.01"
        placeholder="0"
      />
      <button class="btn-tool" type="button" @click="ubahSemua">Ubah Semua</button>
      <button class="btn-tool" type="button" @click="allItem">All Item</button>
    </div>

    <!-- ═══ DETAIL GRID ═══ -->
    <div class="detail-section">
      <div class="detail-header">
        <span class="section-title">Detail Biaya Promosi</span>
        <button class="btn-add-row" type="button" @click="addRow">
          <IconPlus :size="12" /> Tambah Baris
        </button>
      </div>
      <div class="detail-table-wrap">
        <table class="detail-table">
          <thead>
            <tr>
              <th style="width: 36px" class="tc">No</th>
              <th style="width: 80px">Kode</th>
              <th style="min-width: 200px">Nama</th>
              <th style="width: 105px" class="tr">Persen</th>
              <th style="width: 113px" class="tr">Rupiah</th>
              <th style="width: 30px" class="tc">✕</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in form.detail" :key="idx">
              <td class="tc">{{ idx + 1 }}</td>
              <td>
                <div class="cell-search">
                  <input :value="d.kode" class="cell-inp tc readonly" readonly />
                  <button class="cell-btn" type="button" @click="openBarangModal(idx)">
                    <IconSearch :size="11" />
                  </button>
                </div>
              </td>
              <td><input v-model="d.nama" class="cell-inp readonly" readonly /></td>
              <td>
                <input
                  v-model.number="d.persen"
                  type="number"
                  class="cell-inp tr"
                  min="0"
                  step="0.01"
                />
              </td>
              <td>
                <input
                  v-model.number="d.rupiah"
                  type="number"
                  class="cell-inp tr"
                  min="0"
                  step="0.01"
                />
              </td>
              <td class="tc">
                <button class="btn-del" type="button" @click="removeRow(idx)">✕</button>
              </td>
            </tr>
            <tr v-if="form.detail.length === 0">
              <td colspan="6" class="tc empty-cell">
                Belum ada detail biaya promosi.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH CUSTOMER ═══ -->
  <SearchModal
    v-model="showCustomerModal"
    title="Pilih Customer"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'customer', title: 'Customer' },
      { key: 'alamat', title: 'Alamat' },
    ]"
    :items="customerOptions"
    :loading="customerLoading"
    :server-search="true"
    search-placeholder="Cari customer..."
    @select="selectCustomer"
    @search="searchCustomer"
  />

  <!-- ═══ MODAL SEARCH BARANG ═══ -->
  <SearchModal
    v-model="showBarangModal"
    title="Pilih Barang"
    :columns="[
      { key: 'kode', title: 'SKU', width: '100px' },
      { key: 'nama', title: 'Nama Barang' },
      { key: 'satuan', title: 'Satuan', width: '70px', align: 'center' },
    ]"
    :items="barangOptions"
    :loading="barangLoading"
    :server-search="true"
    search-placeholder="Cari barang..."
    @select="selectBarang"
    @search="searchBarang"
  />
</template>

<style scoped>
.bp-header {
  display: flex;
  gap: 50px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.header-left,
.header-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-left {
  flex: 1;
  max-width: 550px;
}

.header-right {
  flex: 0 0 auto;
  min-width: 200px;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.f-lbl {
  width: 80px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

.req { color: red; }

.f-inp {
  height: 28px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
}

.w-73 { width: 73px; }
.w-140 { width: 140px; }
.w-300 { width: 300px; max-width: 100%; }
.w-400 { width: 400px; max-width: 100%; }

.search-group {
  display: flex;
  gap: 4px;
}

.btn-search {
  height: 28px;
  width: 32px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: none;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-search:hover { background: #2d4a80; }

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

.bp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.btn-tool {
  height: 25px;
  padding: 0 12px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: none;
  border-radius: 0;
  font-size: 11px;
  cursor: pointer;
}

.btn-tool:hover { background: #2d4a80; }

.detail-section {
  flex: 1;
  min-height: 250px;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 6px;
  background: white;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
}

.btn-add-row {
  height: 24px;
  padding: 0 10px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: none;
  border-radius: 0;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ds-border-light, #dde1e6);
  border-radius: 0;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.detail-table thead tr { background: var(--ds-primary, #0284c7); }

.detail-table th {
  color: white;
  font-weight: 700;
  padding: 5px 6px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

.detail-table td {
  padding: 2px 4px;
  border: 1px solid var(--ds-border-light, #dde1e6);
  vertical-align: middle;
  white-space: nowrap;
}

.detail-table tbody tr:hover td { background: rgba(59, 89, 152, 0.04); }

.cell-search { display: flex; gap: 2px; }

.cell-inp {
  width: 100%;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 4px;
  font-size: 11px;
  outline: none;
  box-sizing: border-box;
}

.cell-inp:focus { border-color: var(--ds-primary, #0284c7); }

.cell-btn {
  height: 24px;
  width: 24px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: none;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-del {
  background: none;
  border: none;
  color: #c62828;
  cursor: pointer;
  font-weight: bold;
  padding: 2px 4px;
}

.btn-del:hover { background: #ffebee; }

.tc { text-align: center; }
.tr { text-align: right; }
.empty-cell {
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>