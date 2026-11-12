<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import {
  settingEstimasiSalesmanApi,
  type BarisEstimasiSalesman,
  type DataLoadEstimasi,
} from "@/api/utility/settingEstimasiSalesmanApi";
import { IconRefresh, IconDeviceFloppy, IconSearch, IconX } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";

const route = useRoute();
const toast = useToast();
const permission = usePermissionStore();

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const now = new Date();
const bulan = ref(now.getMonth() + 1);
const tahun = ref(now.getFullYear());
const years = Array.from({ length: now.getFullYear() + 1 - 2015 }, (_, i) => 2015 + i);

const salesmanList = ref<{ kode: string; nama: string }[]>([]);
const salesman = ref("");
const salesmanNama = ref("");
const targetSalesman = ref(0);
const flagEdit = ref(false);
const lock = ref(false);
const rows = ref<BarisEstimasiSalesman[]>([]);

const isLoading = ref(false);
const isSaving = ref(false);
const showConfirm = ref(false);
useEscClose(showConfirm, () => (showConfirm.value = false));
const showSalesmanPicker = ref(false);
const showCustomerPicker = ref(false);
const pickerSearch = ref("");
const pickerTargetIndex = ref(-1);

const canSave = computed(() =>
  permission.canByRoute(route.path, flagEdit.value ? "edit" : "insert")
);
const canBukaMenu = computed(
  () =>
    permission.canByRoute(route.path, "view") ||
    permission.canByRoute(route.path, "insert") ||
    permission.canByRoute(route.path, "edit")
);

const fmtNum = (n: number) => new Intl.NumberFormat("id-ID").format(n || 0);
const fmtPct = (n: number) => (n ? `${n.toFixed(2)}%` : "-");

// Ratio per baris dihitung live (Delphi: diisi saat load; footer tetap live
// karena memakai summary — web menyamakan keduanya live).
const ratioSales = (r: BarisEstimasiSalesman) =>
  r.targetsales > 0 ? (r.realisasisales / r.targetsales) * 100 : 0;
const ratioInkaso = (r: BarisEstimasiSalesman) =>
  r.targetinkaso > 0 ? (r.realisasiinkaso / r.targetinkaso) * 100 : 0;

const totTargetSales = computed(() => rows.value.reduce((a, r) => a + (Number(r.targetsales) || 0), 0));
const totRealisasiSales = computed(() => rows.value.reduce((a, r) => a + (Number(r.realisasisales) || 0), 0));
const totTargetInkaso = computed(() => rows.value.reduce((a, r) => a + (Number(r.targetinkaso) || 0), 0));
const totRealisasiInkaso = computed(() => rows.value.reduce((a, r) => a + (Number(r.realisasiinkaso) || 0), 0));
const capaianSales = computed(() =>
  totTargetSales.value > 0 ? (totRealisasiSales.value / totTargetSales.value) * 100 : 0
);
const capaianInkaso = computed(() =>
  totTargetInkaso.value > 0 ? (totRealisasiInkaso.value / totTargetInkaso.value) * 100 : 0
);

const loadSalesman = async () => {
  try {
    salesmanList.value = await settingEstimasiSalesmanApi.getSalesman();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat daftar salesman.");
  }
};

// Delphi: btnRefreshClick -> loaddata (grid diisi + kalkulasi avgsales,
// realisasi, piutang/inkaso dari server).
const loadData = async () => {
  if (!salesman.value) {
    toast.warning("Salesman belum di pilih.");
    return;
  }
  isLoading.value = true;
  try {
    const data: DataLoadEstimasi | null = await settingEstimasiSalesmanApi.load({
      bulan: bulan.value,
      tahun: tahun.value,
      salesman: salesman.value,
    });
    if (!data) return;
    targetSalesman.value = data.targetSalesman;
    flagEdit.value = data.flagEdit;
    lock.value = data.lock;
    rows.value = data.rows;
    if (data.lock) toast.warning("sudah di Lock, tidak bisa edit");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data estimasi.");
  } finally {
    isLoading.value = false;
  }
};

// Delphi: edtKodeClickBtn (frmbantuan salesman) -> isi kode, nama, target.
const pilihSalesman = (s: { kode: string; nama: string }) => {
  salesman.value = s.kode;
  salesmanNama.value = s.nama;
  showSalesmanPicker.value = false;
  // Target display butuh periode: ambil via load ringan hanya target-nya
  // tidak tersedia terpisah di Delphi (gettarget memakai periode terpilih).
  loadData();
};

// Delphi: clCustomerPropertiesButtonClick -> cek duplikat baris lain.
const pilihCustomer = (c: { kode: string; nama: string }) => {
  const idx = pickerTargetIndex.value;
  const dup = rows.value.findIndex(
    (r, i) => i !== idx && r.kode.toUpperCase() === c.kode.toUpperCase()
  );
  if (dup >= 0) {
    toast.error(`Customer ada yang sama dengan baris ${dup + 1}`);
    return;
  }
  if (idx >= 0 && idx < rows.value.length) {
    rows.value[idx].kode = c.kode;
    rows.value[idx].nama = c.nama;
  } else {
    rows.value.push({
      kode: c.kode,
      nama: c.nama,
      targetsales: 0, estimasisales: 0, avgsales: 0, realisasisales: 0,
      targetinkaso: 0, estimasiinkaso: 0, realisasiinkaso: 0,
    });
  }
  showCustomerPicker.value = false;
};

const tambahBaris = () => {
  showCustomerPicker.value = true;
  pickerTargetIndex.value = -1;
};

const hapusBaris = (i: number) => {
  rows.value.splice(i, 1);
};

// Delphi: cekdata (salesman wajib; lock dicek server juga) -> konfirmasi
// 'Yakin ingin simpan ?' -> simpandata -> refreshdata.
const runSimpan = async () => {
  if (!salesman.value) {
    toast.warning("Salesman belum di pilih");
    showConfirm.value = false;
    return;
  }
  if (lock.value) {
    toast.warning("sudah di Lock, tidak bisa edit");
    showConfirm.value = false;
    return;
  }
  isSaving.value = true;
  try {
    const hasil = await settingEstimasiSalesmanApi.save({
      bulan: bulan.value,
      tahun: tahun.value,
      salesman: salesman.value,
      isEdit: flagEdit.value,
      rows: rows.value.filter((r) => r.kode),
    });
    toast.success(
      `Estimasi ${NAMA_BULAN[bulan.value - 1]} ${tahun.value} untuk ` +
        `${salesmanNama.value || salesman.value} tersimpan (${hasil.jmlBaris} customer).`
    );
    // refreshdata: kosongkan form
    salesman.value = "";
    salesmanNama.value = "";
    targetSalesman.value = 0;
    flagEdit.value = false;
    lock.value = false;
    rows.value = [];
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal Simpan");
  } finally {
    isSaving.value = false;
    showConfirm.value = false;
  }
};

const filteredSalesman = computed(() => {
  const q = pickerSearch.value.toLowerCase();
  if (!q) return salesmanList.value.slice(0, 100);
  return salesmanList.value
    .filter((s) => s.kode.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q))
    .slice(0, 100);
});

const customerList = ref<{ kode: string; nama: string }[]>([]);
const loadCustomers = async () => {
  if (customerList.value.length) return;
  try {
    const { default: api } = await import("@/api/axios");
    const { data } = await api.get("/utility/setting-estimasi-salesman/customers");
    customerList.value = data?.data ?? [];
  } catch {
    customerList.value = [];
  }
};
const filteredCustomer = computed(() => {
  const q = pickerSearch.value.toLowerCase();
  if (!q) return customerList.value.slice(0, 100);
  return customerList.value
    .filter((c) => c.kode.toLowerCase().includes(q) || c.nama.toLowerCase().includes(q))
    .slice(0, 100);
});

const bukaCustomerPicker = (i: number) => {
  pickerTargetIndex.value = i;
  pickerSearch.value = "";
  showCustomerPicker.value = true;
  loadCustomers();
};

onMounted(loadSalesman);

let sudahAktif = false;
onActivated(() => {
  if (sudahAktif) loadSalesman();
  sudahAktif = true;
});
</script>

<template>
  <PageLayout title="Setting Estimasi Salesman" :icon="IconDeviceFloppy" :loading="isLoading">
    <div class="ses-layout">
      <fieldset class="group-box">
        <legend>Salesman &amp; Periode</legend>
        <div class="field-row">
          <label class="field-label">Salesman</label>
          <div class="kode-wrap">
            <input v-model="salesman" class="field-input w-120" readonly placeholder="Kode" />
            <button
              type="button"
              class="btn-load"
              :disabled="!canBukaMenu"
              @click="pickerSearch = ''; showSalesmanPicker = true"
            >
              <IconSearch :size="13" :stroke-width="1.8" />
            </button>
            <input :value="salesmanNama" class="field-input w-220" readonly placeholder="Nama" />
          </div>
        </div>
        <div class="field-row">
          <label class="field-label">Periode</label>
          <select v-model.number="bulan" class="field-input w-120">
            <option v-for="(nama, i) in NAMA_BULAN" :key="i + 1" :value="i + 1">{{ nama }}</option>
          </select>
          <select v-model.number="tahun" class="field-input w-100">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
          <button type="button" class="btn-load" @click="loadData">
            <IconRefresh :size="13" :stroke-width="1.8" />
            Muat Data
          </button>
        </div>
        <div class="field-row">
          <label class="field-label">Target Sales</label>
          <input :value="fmtNum(targetSalesman)" class="field-input w-160" readonly />
          <span v-if="lock" class="lock-badge">LOCKED</span>
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>Detail Estimasi per Customer</legend>
        <div class="tbl-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th class="col-no">No</th>
                <th class="col-kode">Kode</th>
                <th class="col-nama">Nama Customer</th>
                <th class="col-num">Target Sales</th>
                <th class="col-num">Avg Sales</th>
                <th class="col-num">Estimasi Sales</th>
                <th class="col-num">Realisasi Sales</th>
                <th class="col-num">Ratio %</th>
                <th class="col-num">Target Inkaso</th>
                <th class="col-num">Estimasi Inkaso</th>
                <th class="col-num">Realisasi Inkaso</th>
                <th class="col-num">Ratio %</th>
                <th class="col-aksi"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i">
                <td class="col-no">{{ i + 1 }}</td>
                <td class="col-kode">
                  <button type="button" class="btn-load btn-kode" @click="bukaCustomerPicker(i)">
                    {{ r.kode || "…" }}
                  </button>
                </td>
                <td class="col-nama">{{ r.nama }}</td>
                <td class="col-num">
                  <input v-model.number="r.targetsales" type="number" class="cell-inp" />
                </td>
                <td class="col-num num">{{ fmtNum(r.avgsales) }}</td>
                <td class="col-num">
                  <input v-model.number="r.estimasisales" type="number" class="cell-inp" />
                </td>
                <td class="col-num num">{{ fmtNum(r.realisasisales) }}</td>
                <td class="col-num num">{{ fmtPct(ratioSales(r)) }}</td>
                <td class="col-num num">{{ fmtNum(r.targetinkaso) }}</td>
                <td class="col-num">
                  <input v-model.number="r.estimasiinkaso" type="number" class="cell-inp" />
                </td>
                <td class="col-num num">{{ fmtNum(r.realisasiinkaso) }}</td>
                <td class="col-num num">{{ fmtPct(ratioInkaso(r)) }}</td>
                <td class="col-aksi">
                  <button type="button" class="btn-del" title="Hapus baris" @click="hapusBaris(i)">
                    <IconX :size="12" :stroke-width="2" />
                  </button>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="13" class="empty-row">Belum ada data — pilih salesman lalu klik Muat Data, atau tambah baris.</td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length">
              <tr>
                <td colspan="3" class="foot-lbl">TOTAL</td>
                <td class="num foot-val">{{ fmtNum(totTargetSales) }}</td>
                <td></td>
                <td></td>
                <td class="num foot-val">{{ fmtNum(totRealisasiSales) }}</td>
                <td class="num foot-val">{{ fmtPct(capaianSales) }}</td>
                <td class="num foot-val">{{ fmtNum(totTargetInkaso) }}</td>
                <td></td>
                <td class="num foot-val">{{ fmtNum(totRealisasiInkaso) }}</td>
                <td class="num foot-val">{{ fmtPct(capaianInkaso) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button type="button" class="btn-load" @click="tambahBaris">+ Tambah Customer</button>
      </fieldset>

      <div class="btn-row">
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isSaving"
          :disabled="!rows.length || !canSave || lock"
          @click="showConfirm = true"
        >
          <template #prepend><IconDeviceFloppy :size="14" :stroke-width="1.8" /></template>
          Simpan
        </v-btn>
        <p v-if="!canSave && rows.length" class="edit-hint">
          Anda tidak memiliki hak {{ flagEdit ? "edit" : "insert" }} untuk menu ini.
        </p>
      </div>
    </div>
  </PageLayout>

  <!-- Picker salesman (Delphi: frmbantuan) -->
  <v-dialog v-model="showSalesmanPicker" width="520">
    <div class="picker-box">
      <h3 class="picker-title">Pilih Salesman</h3>
      <input v-model="pickerSearch" class="field-input picker-search" placeholder="Cari kode / nama…" />
      <div class="picker-list">
        <button
          v-for="s in filteredSalesman"
          :key="s.kode"
          type="button"
          class="picker-item"
          @click="pilihSalesman(s)"
        >
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
        <button
          v-for="c in filteredCustomer"
          :key="c.kode"
          type="button"
          class="picker-item"
          @click="pilihCustomer(c)"
        >
          <span class="picker-kode">{{ c.kode }}</span>
          <span>{{ c.nama }}</span>
        </button>
        <p v-if="!filteredCustomer.length" class="empty-state">Tidak ada data.</p>
      </div>
    </div>
  </v-dialog>

  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Simpan Estimasi</h3>
      <p class="confirm-text">
        Yakin ingin simpan? Data estimasi
        <strong>{{ NAMA_BULAN[bulan - 1] }} {{ tahun }}</strong> untuk salesman
        <strong>{{ salesmanNama || salesman }}</strong> akan ditimpa ulang
        (delete + insert).
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
.ses-layout {
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
.w-100 { width: 100px; }
.w-120 { width: 120px; }
.w-160 { width: 160px; }
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
.lock-badge {
  font-size: 10px;
  font-weight: 700;
  color: #b91c1c;
  border: 1px solid #b91c1c;
  padding: 1px 6px;
}
.tbl-wrap {
  overflow: auto;
  max-height: 480px;
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
.col-kode { width: 100px; }
.col-nama { min-width: 180px; }
.col-num { text-align: right; }
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cell-inp {
  width: 110px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 0;
  font-size: 12px;
  text-align: right;
  padding: 0 4px;
  background: transparent;
  outline: none;
}
.cell-inp:hover,
.cell-inp:focus {
  border-color: var(--ds-border, #A0AAB8);
  background: white;
}
.btn-kode {
  height: 24px;
  min-width: 80px;
  justify-content: center;
}
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
.grid-table tfoot td {
  background: var(--ds-surface-inset, #E8ECF1);
  font-weight: 700;
  border-top: 2px solid var(--ds-primary, #D97706);
}
.foot-lbl { color: var(--ds-text, #78350F); }
.foot-val {
  color: var(--ds-text, #78350F);
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
  font-variant-numeric: tabular-nums;
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
