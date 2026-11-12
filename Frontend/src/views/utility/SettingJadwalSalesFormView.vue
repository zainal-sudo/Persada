<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import {
  settingJadwalSalesApi,
  type JadwalSalesLoadRow,
} from "@/api/utility/settingJadwalSalesApi";
import { IconCalendarPlus, IconSearch, IconX } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";
import { watchUnsavedInput } from "@/composables/useUnsavedForms";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const permission = usePermissionStore();

// route /edit/:salesman — Delphi FLAGEDIT ditentukan dari tombol (Edit/Insert);
// web pakai isEdit untuk hak akses dinamis (checkPermission("save") BE).
const isEdit = computed(() => route.name === "settingJadwalSalesEdit");

const salesman = ref("");
const salesmanNama = ref("");
const namaJadwal = ref("");
const rows = ref<JadwalSalesLoadRow[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showConfirm = ref(false);
useEscClose(showConfirm, () => (showConfirm.value = false));
const showSalesmanPicker = ref(false);
const showCustomerPicker = ref(false);
const pickerSearch = ref("");

// Isian form ini dicatat supaya muat ulang otomatis tidak menghapusnya.
// Form ini tidak memakai BaseForm, jadi area field-nya didaftarkan sendiri.
const layoutEl = ref<HTMLElement | null>(null);
watchUnsavedInput(layoutEl);

const canSave = computed(() =>
  permission.canByRoute(route.path, isEdit.value ? "edit" : "insert")
);

// Delphi: edtKodeClickBtn (frmbantuan salesman) — pilih salesman kosongkan grid.
const pilihSalesman = (s: { kode: string; nama: string }) => {
  salesman.value = s.kode;
  salesmanNama.value = s.nama;
  showSalesmanPicker.value = false;
  rows.value = [];
};

// Delphi: clCustomerPropertiesButtonClick — cek duplikat baris lain.
const pilihCustomer = (c: { kode: string; nama: string }) => {
  const dup = rows.value.find(
    (r) => r.kode.toUpperCase() === c.kode.toUpperCase()
  );
  if (dup) {
    toast.error("Customer ada yang sama dengan baris lain");
    return;
  }
  rows.value.push({ slsKode: salesman.value, kode: c.kode, nama: c.nama });
  showCustomerPicker.value = false;
};

const hapusBaris = (i: number) => rows.value.splice(i, 1);

const loadData = async () => {
  if (!salesman.value) return;
  isLoading.value = true;
  try {
    rows.value = await settingJadwalSalesApi.load(salesman.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat jadwal salesman.");
  } finally {
    isLoading.value = false;
  }
};

// Delphi: cek hak + konfirmasi 'Yakin ingin simpan ?' -> simpandata -> refreshdata.
const runSimpan = async () => {
  if (!salesman.value) {
    toast.warning("Salesman belum di pilih");
    return;
  }
  if (!namaJadwal.value.trim()) {
    toast.warning("Nama Jadwal belum di isi");
    return;
  }
  isSaving.value = true;
  try {
    const hasil = await settingJadwalSalesApi.save({
      salesman: salesman.value,
      namaJadwal: namaJadwal.value.trim(),
      isEdit: isEdit.value,
      rows: rows.value.map((r) => ({ kode: r.kode })),
    });
    toast.success(
      `Jadwal ${hasil.salesman} tersimpan: ` +
        `${hasil.jmlBaris} customer (${hasil.jmlInsert} baru, ` +
        `${hasil.jmlUpdate} update, ${hasil.jmlDelete} dihapus).`
    );
    router.push("/utility/setting-jadwal-sales");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal Simpan");
  } finally {
    isSaving.value = false;
    showConfirm.value = false;
  }
};

const salesmen = ref<{ kode: string; nama: string }[]>([]);
const loadSalesman = async () => {
  try {
    salesmen.value = await settingJadwalSalesApi.getSalesman();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat daftar salesman.");
  }
};

const customers = ref<{ kode: string; nama: string }[]>([]);
const loadCustomers = async () => {
  if (customers.value.length) return;
  try {
    customers.value = await settingJadwalSalesApi.getCustomers();
  } catch {
    /* diabaikan — tombol picker akan kosong */
  }
};

const filteredSalesman = computed(() => {
  const q = pickerSearch.value.toLowerCase();
  if (!q) return salesmen.value.slice(0, 100);
  return salesmen.value
    .filter((s) => s.kode.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q))
    .slice(0, 100);
});

const filteredCustomer = computed(() => {
  const q = pickerSearch.value.toLowerCase();
  if (!q) return customers.value.slice(0, 100);
  return customers.value
    .filter((c) => c.kode.toLowerCase().includes(q) || c.nama.toLowerCase().includes(q))
    .slice(0, 100);
});

const openSalesmanPicker = () => {
  pickerSearch.value = "";
  showSalesmanPicker.value = true;
};

const openCustomerPicker = () => {
  pickerSearch.value = "";
  showCustomerPicker.value = true;
  loadCustomers();
};

onMounted(async () => {
  // Web-only: muat jadwal salesman dari route /edit/:salesman (Delphi tidak
  // memuat data lama di form edit — keputusan gap doc §5.3).
  if (isEdit.value) {
    salesman.value = decodeURIComponent(String(route.params.salesman || ""));
    await loadSalesman();
    const found = salesmen.value.find((s) => s.kode === salesman.value);
    salesmanNama.value = found?.nama ?? "";
    loadData();
  } else {
    loadSalesman();
  }
});
</script>

<template>
  <PageLayout title="Setting Jadwal Sales" :icon="IconCalendarPlus">
    <div class="sjf-layout" ref="layoutEl">
      <fieldset class="group-box">
        <legend>Salesman &amp; Nama Jadwal</legend>
        <div class="field-row">
          <label class="field-label">Salesman</label>
          <div class="kode-wrap">
            <input v-model="salesman" class="field-input w-120" readonly placeholder="Kode" />
            <button
              type="button"
              class="btn-load"
              :disabled="isEdit"
              @click="openSalesmanPicker"
            >
              <IconSearch :size="13" :stroke-width="1.8" />
              Pilih
            </button>
            <input :value="salesmanNama" class="field-input w-220" readonly placeholder="Nama" />
          </div>
        </div>
        <div class="field-row">
          <label class="field-label">Nama Jadwal</label>
          <input
            v-model="namaJadwal"
            class="field-input w-220"
            placeholder="mis. Senin/Kamis — Jl. XXX"
            maxlength="50"
          />
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>Customer untuk jadwal ini</legend>
        <div class="tbl-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th class="col-no">No</th>
                <th class="col-kode">Kode</th>
                <th class="col-nama">Nama Customer</th>
                <th class="col-aksi"></th>
              </tr>
  </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="r.kode">
                <td class="col-no">{{ i + 1}}</td>
                <td class="col-kode">{{ r.kode }}</td>
                <td class="col-nama">{{ r.nama }}</td>
                <td class="col-aksi">
                  <button type="button" class="btn-del" title="Hapus baris" @click="hapusBaris(i)">
                    <IconX :size="12" :stroke-width="2" />
                  </button>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="4" class="empty-row">Belum ada customer — klik Tambah Customer.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="tbl-actions">
          <button type="button" class="btn-load" @click="openCustomerPicker">+ Tambah Customer</button>
        </div>
      </fieldset>

      <div class="btn-row">
        <v-btn size="small" class="tb-btn tb-btn-primary" :disabled="!canSave || !rows.length" @click="showConfirm = true">
          Simpan
        </v-btn>
        <v-btn size="small" variant="outlined" @click="router.push('/utility/setting-jadwal-sales')">
          Tutup
          </v-btn>
        <p v-if="!canSave" class="edit-hint">Anda tidak memiliki hak {{ isEdit ? "edit" : "insert" }} untuk menu ini.</p>
      </div>
    </div>
  </PageLayout>

  <!-- Picker salesman (Delphi: frmbantuan) -->
  <v-dialog v-model="showSalesmanPicker" width="520">
    <div class="picker-box">
      <h3 class="picker-title">Pilih Salesman</h3>
      <input v-model="pickerSearch" class="field-input picker-search" placeholder="Cari kode / nama…" />
      <div class="picker-list">
        <button v-for="s in filteredSalesman" :key="s.kode" type="button" class="picker-item" @click="pilihSalesman(s)">
          <span class="picker-kode">{{ s.kode }}</span>
          <span>{{ s.nama }}</span>
        </button>
        <p v-if="!filteredSalesman.length" class="empty-state">Tidak ada data.</p>
      </div>
    </div>
  </v-dialog>

  <!-- Picker customer (Delphi: clCustomerPropertiesButtonClick) -->
  <v-dialog v-model="showCustomerPicker" width="520">
    <div class="picker-box">
      <h3 class="picker-title">Pilih Customer</h3>
      <input v-model="pickerSearch" class="field-input picker-search" placeholder="Cari kode / nama…" />
      <div class="picker-list">
        <button v-for="c in filteredCustomer" :key="c.kode" type="button" class="picker-item" @click="pilihCustomer(c)">
          <span class="picker-kode">{{ c.kode }}</span>
          <span>{{ c.nama }}</span>
        </button>
        <p v-if="!filteredCustomer.length" class="empty-state">Tidak ada data.</p>
      </div>
    </div>
  </v-dialog>

  <!-- Konfirmasi simpan (Delphi: MessageDlg 'Yakin ingin simpan ?') -->
  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Simpan Jadwal Sales</h3>
      <p class="confirm-text">
        Yakin ingin simpan? Jadwal <strong>{{ namaJadwal }}</strong> untuk salesman
        <strong>{{ salesmanNama || salesman }}</strong> dengan
        <strong>{{ rows.length }}</strong> customer akan disimpan
        (tambahan baru + penghapusan baris yang dicopot dari daftar).
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showConfirm = false">Batal</v-btn>
        <v-btn size="small" class="tb-btn tb-btn-primary" :loading="isSaving" @click="runSimpan">
          Simpan
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.sjf-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: auto;
}
.group-box {
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  margin: 0;
  padding: 12px;
}
.group-box legend {
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
}
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.field-row:last-of-type {
  margin-bottom: 0;
}
.field-label {
  width: 100px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}
.field-input {
  height: 30px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  background: white;
}
.field-input:focus {
  border-color: var(--ds-primary, #D97706);
}
.w-120 { width: 120px; }
.w-220 { width: 220px; }
.kode-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-load {
  height: 30px;
  padding: 0 10px;
  background: var(--ds-surface, #F0F3F8);
  color: var(--ds-text, #78350F);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.btn-load:hover {
  background: var(--ds-surface-inset, #E8ECF1);
}
.btn-load:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tbl-wrap {
  overflow: auto;
  max-height: 420px;
  margin-bottom: 8px;
}
.grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.grid-table th {
  position: sticky;
  top: 0;
  background: var(--ds-surface-inset, #E8ECF1);
  color: var(--ds-text, #78350F);
  font-size: 11px;
  text-align: left;
  padding: 5px 6px;
  border: 1px solid var(--ds-border, #A0AAB8);
  white-space: nowrap;
}
.grid-table td {
  padding: 2px 6px;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}
.col-no { width: 36px; text-align: center; }
.col-kode { width: 120px; font-variant-numeric: tabular-nums; }
.col-nama { min-width: 220px; }
.col-aksi { width: 40px; text-align: center; }
.btn-del {
  height: 22px;
  width: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  color: #b91c1c;
  cursor: pointer;
}
.btn-del:hover {
  border-color: #b91c1c;
}
.empty-row {
  text-align: center;
  font-style: italic;
  color: var(--ds-text-muted, #8494A7);
  padding: 10px;
}
.tbl-actions {
  display: flex;
  gap: 8px;
}
.btn-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.edit-hint {
  font-size: 11px;
  color: #b45309;
  margin: 0;
}
.picker-box {
  background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 2.5px solid var(--ds-primary, #D97706);
  border-radius: 0;
  padding: 14px;
}
.picker-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
}
.picker-search {
  width: 100%;
  margin-bottom: 8px;
}
.picker-list {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}
.picker-item {
  display: flex;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  font-size: 12px;
  background: white;
  border: 0;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  cursor: pointer;
}
.picker-item:hover {
  background: var(--ds-surface, #F0F3F8);
}
.picker-kode {
  font-weight: 700;
  min-width: 90px;
}
.empty-state {
  font-size: 12px;
  color: var(--ds-text-muted, #8494A7);
  font-style: italic;
  margin: 8px;
}
.confirm-box {
  background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 2.5px solid var(--ds-primary, #D97706);
  border-radius: 0;
  padding: 16px;
}
.confirm-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
}
.confirm-text {
  margin: 0 0 16px;
  font-size: 12px;
  color: #374151;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
