<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import { IconTruck } from "@tabler/icons-vue";
import { supplierFormApi, type SupplierForm } from "@/api/daftar/supplierFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

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
const emptyForm = (): SupplierForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  alamat: "",
  kota: "",
  telp: "",
  fax: "",
  cp: "",
  email: "",
  top: 0,
  bank: "",
  rekening: "",
  atasnama: "",
  cabang: authStore.cabangKode,
});

const form = ref<SupplierForm>(emptyForm());

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  if (!isEdit.value) return;

  isLoading.value = true;
  try {
    const data = await supplierFormApi.getDetailForm(
      decodeURIComponent(editKode.value),
    );
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: data.kode || editKode.value,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data supplier.");
    router.push({ name: "supplierBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!form.value.kode.trim()) {
    toast.warning("Kode supplier wajib diisi.");
    return;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama supplier wajib diisi.");
    return;
  }

  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await supplierFormApi.save(form.value);
    handlePostSave(action, form.value.kode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data supplier.");
  } finally {
    isSaving.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────
const resetForm = () => {
  form.value = emptyForm();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Supplier' : 'Tambah Supplier Baru'"
    :icon="IconTruck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <!-- ═══ FORM INPUT ═══ -->
    <div class="supplier-form">
      <div class="form-row">
        <label class="form-label">Kode <span v-if="!isEdit" class="req">*</span></label>
        <input
          v-model="form.kode"
          class="form-input mono"
          :readonly="isEdit"
          :class="{ readonly: isEdit }"
          maxlength="10"
          placeholder="Kode supplier..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Nama <span class="req">*</span></label>
        <input
          v-model="form.nama"
          class="form-input"
          maxlength="50"
          placeholder="Nama supplier..."
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
        <label class="form-label">Fax</label>
        <input
          v-model="form.fax"
          class="form-input"
          maxlength="20"
          placeholder="No. fax..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Contact Person</label>
        <input
          v-model="form.cp"
          class="form-input"
          maxlength="50"
          placeholder="Nama contact person..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Email</label>
        <input
          v-model="form.email"
          class="form-input"
          maxlength="40"
          placeholder="Email..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">TOP (Hari)</label>
        <input
          v-model.number="form.top"
          type="number"
          class="form-input"
          min="0"
          placeholder="Terms of payment (hari)..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Bank</label>
        <input
          v-model="form.bank"
          class="form-input"
          maxlength="50"
          placeholder="Nama bank..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">No. Rekening</label>
        <input
          v-model="form.rekening"
          class="form-input"
          maxlength="50"
          placeholder="No. rekening..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Atas Nama</label>
        <input
          v-model="form.atasnama"
          class="form-input"
          maxlength="50"
          placeholder="Atas nama rekening..."
        />
      </div>
    </div>
  </BaseForm>
</template>

<style scoped>
.supplier-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  flex: 1;
  overflow-y: auto;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-label {
  width: 120px;
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
}

.form-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.1);
}

.form-input.mono {
  font-family: monospace;
  text-transform: uppercase;
}

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}
</style>
