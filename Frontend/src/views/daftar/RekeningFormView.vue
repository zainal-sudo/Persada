<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconBuildingBank } from "@tabler/icons-vue";
import {
  rekeningFormApi,
  type RekeningForm,
} from "@/api/daftar/rekeningFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.kode);
const isLoading = ref(false);
const isSaving = ref(false);

// ── Form State ───────────────────────────────────────────────────────
const blankForm = (): RekeningForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  kolId: 0,
  isAktif: false,
});
const form = ref<RekeningForm>(blankForm());

// "Simpan & Baru": kosongkan form untuk entri berikutnya.
const resetForm = () => {
  form.value = blankForm();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Lookup Options ───────────────────────────────────────────────────
const kelompokOptions = ref<{ kode: number; nama: string }[]>([]);

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const kode = route.params.kode as string;
  if (!kode) {
    form.value.isEdit = false;
    return;
  }

  isLoading.value = true;
  try {
    const data = await rekeningFormApi.getDetailForm(decodeURIComponent(kode));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: data.kode || kode,
      isAktif: Boolean(data.isAktif),
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data rekening.");
    router.push({ name: "rekeningBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadKelompok = async () => {
  try {
    kelompokOptions.value = await rekeningFormApi.getKelompok();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data kelompok.");
  }
};

// ── Validasi ─────────────────────────────────────────────────────────
const validateSave = async (): Promise<boolean> => {
  if (!form.value.kode.trim()) {
    toast.warning("Kode belum diisi.");
    return false;
  }

  // Cek duplikat kode saat insert
  if (!form.value.isEdit) {
    const exists = await rekeningFormApi.cekKode(form.value.kode.trim());
    if (exists) {
      toast.warning("Kode sudah ada.");
      return false;
    }
  }

  if (!form.value.kolId) {
    toast.warning("Kelompok belum dipilih.");
    return false;
  }

  if (!form.value.nama.trim()) {
    toast.warning("Nama harus diisi.");
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
    await rekeningFormApi.save(form.value);
    handlePostSave(action, form.value.kode);
    toast.success("Data rekening berhasil disimpan.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadKelompok();
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Rekening' : 'Tambah Rekening Baru'"
    :icon="IconBuildingBank"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="rekening-form">
      <div class="form-row">
        <label class="form-label">Kelompok <span class="req">*</span></label>
        <select v-model="form.kolId" class="form-input w-167">
          <option :value="0" disabled>-- Pilih Kelompok --</option>
          <option v-for="k in kelompokOptions" :key="k.kode" :value="k.kode">
            {{ k.kode }} - {{ k.nama }}
          </option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Kode <span class="req">*</span></label>
        <input
          v-model="form.kode"
          class="form-input w-98"
          :class="{ readonly: form.isEdit }"
          :readonly="form.isEdit"
          maxlength="6"
          placeholder="Kode..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Nama <span class="req">*</span></label>
        <input
          v-model="form.nama"
          class="form-input w-345"
          maxlength="30"
          placeholder="Nama rekening..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Status</label>
        <label class="check-lbl">
          <input v-model="form.isAktif" type="checkbox" /> Aktif
        </label>
      </div>
    </div>
  </BaseForm>
</template>

<style scoped>
.rekening-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: white;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-label {
  width: 90px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

.req { color: red; }

.form-input {
  height: 28px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  background: white;
}

.form-input:focus {
  border-color: #2e7d32;
  box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.1);
}

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

.w-98 { width: 98px; }
.w-167 { width: 167px; }
.w-345 { width: 345px; max-width: 100%; }

.check-lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  user-select: none;
}

.check-lbl input {
  accent-color: #2e7d32;
  width: 14px;
  height: 14px;
  cursor: pointer;
  margin: 0;
}
</style>