<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import { IconUserCheck } from "@tabler/icons-vue";
import {
  salesmanAktifFormApi,
  type SalesmanAktifForm,
  type FormasiOption,
} from "@/api/daftar/salesmanAktifFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.kode || !!route.params.nomor);
const editKode = computed(() =>
  String(route.params.kode ?? route.params.nomor ?? ""),
);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const emptyForm = (): SalesmanAktifForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  isaktif: true,
  tglMasuk: today,
  formasiId: 0,
});

const form = ref<SalesmanAktifForm>(emptyForm());
const formasiOptions = ref<FormasiOption[]>([]);

// ── Load Data ────────────────────────────────────────────────────────
const loadFormasiOptions = async () => {
  try {
    formasiOptions.value = await salesmanAktifFormApi.getFormasiOptions();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data formasi.");
  }
};

const loadData = async () => {
  await loadFormasiOptions();
  if (!isEdit.value) return;

  isLoading.value = true;
  try {
    const data = await salesmanAktifFormApi.getDetailForm(
      decodeURIComponent(editKode.value),
    );
    form.value = {
      ...emptyForm(),
      ...data,
      isEdit: true,
      isaktif: Number(data.isaktif) === 1,
      formasiId: Number(data.formasiId) || 0,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data salesman.");
    router.push({ name: "salesmanAktifBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!form.value.kode.trim()) {
    toast.warning("Kode salesman wajib diisi.");
    return;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama salesman wajib diisi.");
    return;
  }

  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await salesmanAktifFormApi.save(form.value);
    handlePostSave(action, form.value.kode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data salesman.");
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
    :title="isEdit ? 'Ubah Salesman' : 'Tambah Salesman Baru'"
    :icon="IconUserCheck"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <!-- ═══ FORM INPUT ═══ -->
    <div class="sa-form">
      <div class="form-row">
        <label class="form-label">Kode <span v-if="!isEdit" class="req">*</span></label>
        <input
          v-model="form.kode"
          class="form-input mono"
          :readonly="isEdit"
          :class="{ readonly: isEdit }"
          maxlength="10"
          placeholder="Kode salesman..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Nama <span class="req">*</span></label>
        <input
          v-model="form.nama"
          class="form-input"
          maxlength="50"
          placeholder="Nama salesman..."
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
        <label class="form-label">Aktif</label>
        <input v-model="form.isaktif" type="checkbox" class="form-check" />
        <span class="form-hint">Centang bila salesman masih aktif</span>
      </div>
      <div class="form-row">
        <label class="form-label">Tgl Masuk</label>
        <input v-model="form.tglMasuk" type="date" class="form-input" />
      </div>
    </div>

    <div class="sa-info">
      <p>
        Area/rayon dan target salesman mengikuti Formasi yang dipilih. Atur
        area/rayon serta target pada menu <strong>Formasi</strong>.
      </p>
    </div>
  </BaseForm>
</template>

<style scoped>
.sa-form {
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

.form-hint {
  font-size: 10px;
  color: #6b7280;
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

.form-check {
  width: 15px;
  height: 15px;
  accent-color: var(--ds-primary, #0284c7);
}

.mono {
  font-family: "Consolas", "Courier New", monospace;
}

.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

.sa-info {
  padding: 12px 16px;
  font-size: 11px;
  color: #6b7280;
}

.sa-info p {
  margin: 0;
  max-width: 560px;
  line-height: 1.5;
}
</style>
