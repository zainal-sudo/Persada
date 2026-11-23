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
  type FormasiOption,
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
const emptyForm = (): SalesmanForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  alamat: "",
  kota: "",
  telp: "",
  tglMasuk: today,
  cabang: authStore.cabangKode,
  formasiId: 0,
});

const form = ref<SalesmanForm>(emptyForm());
const formasiOptions = ref<FormasiOption[]>([]);

// ── Load Data ────────────────────────────────────────────────────────
const loadFormasiOptions = async () => {
  try {
    formasiOptions.value = await salesmanFormApi.getFormasiOptions();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data formasi.");
  }
};

const loadData = async () => {
  await loadFormasiOptions();
  const kode = route.params.kode as string;
  if (!kode) {
    form.value.isEdit = false;
    await loadMaxKode();
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
      formasiId: Number(data.formasiId) || 0,
    };
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

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await salesmanFormApi.save(form.value);
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
  form.value = emptyForm();
  loadMaxKode();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData();
});
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
        <label class="form-label">Formasi</label>
        <select v-model.number="form.formasiId" class="form-input">
          <option :value="0">- Tanpa formasi -</option>
          <option v-for="f in formasiOptions" :key="f.id" :value="f.id">
            {{ f.nama }}
          </option>
        </select>
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
  border: 1px solid var(--ds-border, #a0aab8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  background: white;
}

.form-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.1);
}

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}
</style>
