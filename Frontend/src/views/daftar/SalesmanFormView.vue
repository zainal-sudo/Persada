<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import { IconUsers } from "@tabler/icons-vue";
import {
  salesmanFormApi,
  type SalesmanForm,
  type TargetBulanan,
} from "@/api/daftar/salesmanFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

import DsDatePicker from "@/components/DsDatePicker.vue";
const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.kode);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<SalesmanForm>({
  isEdit: false,
  kode: "",
  nama: "",
  alamat: "",
  kota: "",
  telp: "",
  tglMasuk: today,
  cabang: authStore.cabangKode,
  target: [],
});

// Tahun periode target
const currentYear = new Date().getFullYear();
const tahunOptions = Array.from({ length: 7 }, (_, i) => currentYear - 6 + i);
const tahun = ref(currentYear);

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const kode = route.params.kode as string;
  if (!kode) {
    form.value.isEdit = false;
    form.value.target = [];
    await loadMaxKode();
    await loadTargetBulanan(form.value.kode);
    return;
  }

  isLoading.value = true;
  try {
    const data = await salesmanFormApi.getDetailForm(decodeURIComponent(kode));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: data.kode || kode,
    };
    tahun.value = new Date(data.tglMasuk).getFullYear();
    await loadTargetBulanan();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data area/rayon.");
    router.push({ name: "salesmanBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxKode = async () => {
  try {
    form.value.kode = await salesmanFormApi.getMaxKode();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate kode area/rayon.");
  }
};

const loadTargetBulanan = async (overrideKode?: string) => {
  try {
    const kode = overrideKode ?? form.value.kode;
    const data = await salesmanFormApi.getTargetBulanan(
      kode,
      tahun.value
    );
    form.value.target = data.map((t: any) => ({
      periode: t.periode,
      nama: t.nama,
      target: t.target ?? 0,
    }));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat target bulanan.");
  }
};

// Ganti tahun
const onTahunChange = async () => {
  await loadTargetBulanan();
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const payload = {
      ...form.value,
      tahun: tahun.value,
    };
    const res = await salesmanFormApi.save(payload);
    handlePostSave(action, form.value.kode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data area/rayon.");
  } finally {
    isSaving.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = {
    isEdit: false,
    kode: "",
    nama: "",
    alamat: "",
    kota: "",
    telp: "",
    tglMasuk: today,
    cabang: authStore.cabangKode,
    target: [],
  };
  loadMaxKode();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Area/Rayon' : 'Tambah Area/Rayon Baru'"
    :icon="IconUsers"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <!-- ═══ FORM INPUT ═══ -->
    <div class="salesman-form">
      <div class="form-row">
        <label class="form-label">Kode</label>
        <input :value="form.kode" class="form-input readonly" readonly />
      </div>
      <div class="form-row">
        <label class="form-label">Nama Area/Rayon <span class="req">*</span></label>
        <input
          v-model="form.nama"
          class="form-input"
          maxlength="50"
          placeholder="Nama area/rayon..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Alamat</label>
        <input
          v-model="form.alamat"
          class="form-input"
          maxlength="200"
          placeholder="Alamat..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Kota</label>
        <input
          v-model="form.kota"
          class="form-input"
          maxlength="20"
          placeholder="Kota..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Telp</label>
        <input
          v-model="form.telp"
          class="form-input"
          maxlength="20"
          placeholder="No. telp..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Tanggal Masuk</label>
        <DsDatePicker v-model="form.tglMasuk" variant="form" class="form-input" />
      </div>
    </div>

    <!-- ═══ TARGET SALESMAN ═══ -->
    <div class="target-section">
      <div class="target-header">
        <span class="target-title">Target Area/Rayon</span>
        <div class="target-tahun">
          <label class="form-label">Tahun Periode</label>
          <select v-model="tahun" class="tahun-select" @change="onTahunChange">
            <option v-for="t in tahunOptions" :key="t" :value="t">
              {{ t }}
            </option>
          </select>
        </div>
      </div>

      <div class="target-table-wrap">
        <table class="target-table">
          <thead>
            <tr>
              <th style="width: 50px" class="tc">No</th>
              <th style="width: 150px">Bulan</th>
              <th style="width: 150px" class="tr">Target</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in form.target" :key="item.periode">
              <td class="tc">{{ idx + 1 }}</td>
              <td>{{ item.nama }}</td>
              <td class="tr">
                <input
                  v-model.number="item.target"
                  type="number"
                  class="target-input"
                  min="0"
                />
              </td>
            </tr>
            <tr v-if="form.target.length === 0">
              <td colspan="3" class="tc empty-cell">
                Belum ada data target.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseForm>
</template>

<style scoped>
.salesman-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-label {
  width: 110px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

.req {
  color: red;
}

.form-input {
  flex: 1;
  max-width: 400px;
  height: 28px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.1);
}

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

/* Target Section */
.target-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  gap: 8px;
  background: white;
}

.target-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  max-width: 520px;
}

.target-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
}

.target-tahun {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tahun-select {
  height: 28px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  background: white;
}

.tahun-select:focus {
  border-color: var(--ds-primary, #0284c7);
}

.target-table-wrap {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ds-border-light, #dde1e6);
  border-radius: 0;
  max-width: 520px;
}

.target-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.target-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.target-table th {
  color: white;
  font-weight: 700;
  padding: 5px 8px;
  white-space: nowrap;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
  border: 1px solid var(--ds-border-light, #dde1e6);
}

.target-table td {
  padding: 3px 8px;
  border: 1px solid var(--ds-border-light, #dde1e6);
  vertical-align: middle;
}

.target-table tbody tr:hover td {
  background: rgba(59, 89, 152, 0.04);
}

.target-input {
  width: 120px;
  height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 6px;
  font-size: 11px;
  outline: none;
  text-align: right;
}

.target-input:focus {
  border-color: var(--ds-primary, #0284c7);
}

.tc {
  text-align: center;
}
.tr {
  text-align: right;
}
.empty-cell {
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>