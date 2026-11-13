<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import {
  penugasanDriverApi,
  type PenugasanDriverRow,
  type PenugasanDriver,
} from "@/api/utility/penugasanDriverApi";
import { IconTruck, IconSearch, IconRefresh, IconCheck, IconX } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";

import DsDatePicker from "@/components/DsDatePicker.vue";
const toast = useToast();
const permission = usePermissionStore();

const STORAGE_KEY = "finance_periode_penugasan_driver";

const getLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const now = new Date();
const startDate = ref(getLocal(now));
const endDate = ref(getLocal(now));

const driverLama = ref("");
const customer = ref("");
const rows = ref<(PenugasanDriverRow & { check: boolean })[]>([]);

const isLoading = ref(false);
const isSaving = ref(false);
const showConfirm = ref(false);
useEscClose(showConfirm, () => (showConfirm.value = false));

const driverBaru = ref("");
const driverBaruNama = ref("");
const showDriverPicker = ref(false);
const pickerSearch = ref("");

const driverList = ref<PenugasanDriver[]>([]);
const customerList = ref<{ kode: string; nama: string }[]>([]);

const canEdit = computed(() => permission.canByRoute("/utility/penugasan-driver", "edit"));

const jmlCentang = computed(() => rows.value.filter((r) => r.check).length);

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${d}-${m}-${y}`;
};

const loadLookups = async () => {
  try {
    driverList.value = await penugasanDriverApi.getDriver();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat daftar driver.");
  }
  try {
    customerList.value = await penugasanDriverApi.getCustomers();
  } catch {
    customerList.value = [];
  }
};

// Delphi: Button1Click (Tampilkan).
const loadDoList = async () => {
  isLoading.value = true;
  try {
    const data = await penugasanDriverApi.getDoList(
      startDate.value,
      endDate.value,
      driverLama.value || undefined,
      customer.value || undefined
    );
    rows.value = data.map((r) => ({ ...r, check: false }));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat daftar DO.");
  } finally {
    isLoading.value = false;
  }
};

// Delphi: Button2Click (centang semua — versi web tanpa grid-filter).
const centangSemua = () => rows.value.forEach((r) => (r.check = true));
// Delphi: Button3Click (kosongkan semua centang).
const kosongkan = () => rows.value.forEach((r) => (r.check = false));

const pilihDriver = (d: PenugasanDriver) => {
  driverBaru.value = d.kode;
  driverBaruNama.value = d.nama;
  showDriverPicker.value = false;
};

// Delphi: cxButton1Click (Simpan) — 'Simpan berhasil' verbatim.
const runAssign = async () => {
  isSaving.value = true;
  try {
    const hasil = await penugasanDriverApi.assign({
      driver: driverBaru.value,
      rows: rows.value.filter((r) => r.check).map((r) => ({ nomor: r.nomor })),
    });
    toast.success(`Simpan berhasil: ${hasil.jmlUpdate} DO di-assign ke ${hasil.driver}.`);
    showConfirm.value = false;
    driverBaru.value = "";
    driverBaruNama.value = "";
    await loadDoList();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal menyimpan penugasan.");
  } finally {
    isSaving.value = false;
  }
};

const filteredDriver = computed(() => {
  const q = pickerSearch.value.toLowerCase();
  if (!q) return driverList.value.slice(0, 100);
  return driverList.value
    .filter((d) => d.kode.toLowerCase().includes(q) || d.nama.toLowerCase().includes(q))
    .slice(0, 100);
});

onMounted(loadLookups);
</script>

<template>
  <PageLayout title="Penugasan Driver" :icon="IconTruck" :loading="isLoading">
    <div class="pd-layout">
      <fieldset class="group-box">
        <legend>Filter DO Belum Diproses</legend>
        <div class="field-row">
          <label class="field-label">Periode</label>
          <DsDatePicker v-model="startDate" variant="form" class="field-input w-140" />
          <span class="filter-sep">s/d</span>
          <DsDatePicker v-model="endDate" variant="form" class="field-input w-140" />
          <label class="field-label" style="margin-left: 12px">Driver lama</label>
          <select v-model="driverLama" class="field-input w-160">
            <option value="">(Semua)</option>
            <option v-for="d in driverList" :key="d.kode" :value="d.kode">{{ d.nama }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Customer</label>
          <select v-model="customer" class="field-input w-220">
            <option value="">(Semua)</option>
            <option v-for="c in customerList" :key="c.kode" :value="c.kode">{{ c.nama }}</option>
          </select>
          <button type="button" class="btn-load" @click="loadDoList">
            <IconRefresh :size="13" :stroke-width="1.8" />
            Tampilkan
          </button>
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>Driver Baru</legend>
        <div class="field-row">
          <label class="field-label">Driver</label>
          <div class="kode-wrap">
            <input :value="driverBaru" class="field-input w-120" readonly placeholder="Kode" />
            <button
              type="button"
              class="btn-load"
              :disabled="!canEdit"
              @click="pickerSearch = ''; showDriverPicker = true"
            >
              <IconSearch :size="13" :stroke-width="1.8" />
              Pilih
            </button>
            <input :value="driverBaruNama" class="field-input w-220" readonly placeholder="Nama" />
          </div>
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>Daftar DO (tanpa POD &amp; tanpa retur)</legend>
        <div class="tbl-actions">
          <button type="button" class="btn-load" @click="centangSemua">
            <IconCheck :size="12" :stroke-width="2" /> Centang semua
          </button>
          <button type="button" class="btn-load" @click="kosongkan">
            <IconX :size="12" :stroke-width="2" /> Kosongkan
          </button>
          <span class="count-info">{{ jmlCentang }} dari {{ rows.length }} DO tercentang</span>
        </div>
        <div class="tbl-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th class="col-check"></th>
                <th class="col-no">No</th>
                <th class="col-kode">Nomor DO</th>
                <th class="col-kode">Nomor Faktur</th>
                <th class="col-tgl">Tanggal</th>
                <th class="col-nama">Customer</th>
                <th class="col-nama">Alamat</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="r.nomor + '-' + (r.faktur || '')">
                <td class="col-check">
                  <input v-model="r.check" type="checkbox" class="chk" />
                </td>
                <td class="col-no">{{ i + 1 }}</td>
                <td class="col-kode mono">{{ r.nomor }}</td>
                <td class="col-kode mono">{{ r.faktur || "-" }}</td>
                <td class="col-tgl">{{ fmtDate(r.tanggal) }}</td>
                <td class="col-nama">{{ r.customer }}</td>
                <td class="col-nama dim">{{ r.alamat }}</td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="7" class="empty-row">
                  Tidak ada data — atur filter lalu klik Tampilkan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>

      <div class="btn-row">
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :disabled="!jmlCentang || !driverBaru || !canEdit"
          @click="showConfirm = true"
        >
          Assign Driver
        </v-btn>
        <p v-if="!canEdit" class="edit-hint">Anda tidak memiliki hak edit untuk menu ini.</p>
      </div>
    </div>
  </PageLayout>

  <!-- Picker driver (Delphi: edtKode2ClickBtn -> frmbantuan) -->
  <v-dialog v-model="showDriverPicker" width="520">
    <div class="picker-box">
      <h3 class="picker-title">Pilih Driver Baru</h3>
      <input v-model="pickerSearch" class="field-input picker-search" placeholder="Cari kode / nama…" />
      <div class="picker-list">
        <button v-for="d in filteredDriver" :key="d.kode" type="button" class="picker-item" @click="pilihDriver(d)">
          <span class="picker-kode">{{ d.kode }}</span>
          <span>{{ d.nama }}</span>
        </button>
        <p v-if="!filteredDriver.length" class="empty-state">Tidak ada data.</p>
      </div>
    </div>
  </v-dialog>

  <!-- Konfirmasi (Delphi: langsung UPDATE + ShowMessage 'Simpan berhasil') -->
  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Assign Driver</h3>
      <p class="confirm-text">
        Yakin assign <strong>{{ jmlCentang }} DO</strong> ke driver
        <strong>{{ driverBaruNama || driverBaru }}</strong>? Driver lama pada DO
        terpilih akan ditimpa.
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showConfirm = false">Batal</v-btn>
        <v-btn size="small" class="tb-btn tb-btn-primary" :loading="isSaving" @click="runAssign">
          Ya, Assign
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.pd-layout {
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
  color: var(--ds-primary, #0284c7);
}
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.field-label {
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
  border-color: var(--ds-primary, #0284c7);
}
.w-120 { width: 120px; }
.w-140 { width: 140px; }
.w-160 { width: 160px; }
.w-220 { width: 220px; }
.filter-sep {
  font-size: 12px;
  color: #9ca3af;
}
.kode-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-load {
  height: 30px;
  padding: 0 10px;
  background: var(--ds-surface, #F0F3F8);
  color: var(--ds-text, #0c4a6e);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.btn-load:hover { background: var(--ds-surface-inset, #E8ECF1); }
.btn-load:disabled { opacity: 0.5; cursor: not-allowed; }
.tbl-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.count-info {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
  margin-left: auto;
}
.tbl-wrap {
  overflow: auto;
  max-height: 420px;
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
  color: var(--ds-text, #0c4a6e);
  font-size: 11px;
  text-align: left;
  padding: 5px 6px;
  border: 1px solid var(--ds-border, #A0AAB8);
  white-space: nowrap;
}
.grid-table td {
  padding: 3px 6px;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}
.col-check { width: 34px; text-align: center; }
.col-no { width: 40px; text-align: center; }
.col-kode { width: 170px; }
.col-tgl { width: 100px; text-align: center; }
.col-nama { min-width: 180px; }
.mono {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 10.5px;
}
.dim { color: var(--ds-text-muted, #8494A7); }
.chk { cursor: pointer; }
.empty-row {
  text-align: center;
  font-style: italic;
  color: var(--ds-text-muted, #8494A7);
  padding: 12px;
}
.btn-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.edit-hint {
  font-size: 11px;
  color: #0369a1;
  margin: 0;
}
.picker-box {
  background: var(--ds-surface, #fff);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 2.5px solid var(--ds-primary, #0284c7);
  border-radius: 0;
  padding: 14px;
}
.picker-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
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
.picker-item:hover { background: var(--ds-surface, #F0F3F8); }
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
  border-top: 2.5px solid var(--ds-primary, #0284c7);
  border-radius: 0;
  padding: 16px;
}
.confirm-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
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
