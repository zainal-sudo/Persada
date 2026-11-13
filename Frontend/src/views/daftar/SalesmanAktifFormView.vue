<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import { IconUserCheck } from "@tabler/icons-vue";
import {
  salesmanAktifFormApi,
  type SalesmanAktifForm,
  type RayonOption,
} from "@/api/daftar/salesmanAktifFormApi";
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

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const emptyForm = (): SalesmanAktifForm => ({
  isEdit: false,
  kode: "",
  nama: "",
  isaktif: true,
  tglMasuk: today,
  detail: [],
});

const form = ref<SalesmanAktifForm>(emptyForm());
const rayonOptions = ref<RayonOption[]>([]);
const newRayonKode = ref("");

// Rayon yang sudah dipilih → tidak muncul lagi di dropdown
const availableRayon = computed(() => {
  const used = new Set(form.value.detail.map((d) => d.slsKode));
  return rayonOptions.value.filter((r) => !used.has(r.kode));
});

// ── Load Data ────────────────────────────────────────────────────────
const loadRayonOptions = async () => {
  try {
    rayonOptions.value = await salesmanAktifFormApi.getRayon();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data area/rayon.");
  }
};

const loadData = async () => {
  await loadRayonOptions();
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
      detail: (data.detail || []).map((d) => ({
        slsKode: d.slsKode,
        slsNama: d.slsNama,
      })),
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data salesman.");
    router.push({ name: "salesmanAktifBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Detail Grid ──────────────────────────────────────────────────────
const addRayon = () => {
  const kode = newRayonKode.value;
  if (!kode) return;
  const opt = rayonOptions.value.find((r) => r.kode === kode);
  if (!opt) return;
  if (form.value.detail.some((d) => d.slsKode === kode)) {
    toast.warning("Area/rayon sudah ada di daftar.");
    return;
  }
  form.value.detail.push({ slsKode: opt.kode, slsNama: opt.nama });
  newRayonKode.value = "";
};

const removeRayon = (idx: number) => {
  form.value.detail.splice(idx, 1);
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
  if (form.value.detail.length === 0) {
    toast.warning("Minimal 1 area/rayon harus diisi.");
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
        <label class="form-label">Aktif</label>
        <input v-model="form.isaktif" type="checkbox" class="form-check" />
        <span class="form-hint">Centang bila salesman masih aktif</span>
      </div>
      <div class="form-row">
        <label class="form-label">Tgl Masuk</label>
        <input v-model="form.tglMasuk" type="date" class="form-input" />
      </div>
    </div>

    <!-- ═══ DETAIL AREA/RAYON ═══ -->
    <div class="detail-section">
      <div class="detail-header">
        <span class="detail-title">Area/Rayon yang Di-handle</span>
      </div>

      <div class="detail-add-row">
        <select v-model="newRayonKode" class="detail-select">
          <option value="" disabled>Pilih area/rayon...</option>
          <option v-for="r in availableRayon" :key="r.kode" :value="r.kode">
            {{ r.kode }} — {{ r.nama }}
          </option>
        </select>
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :disabled="!newRayonKode"
          @click="addRayon"
        >
          Tambah
        </v-btn>
      </div>

      <div class="detail-table-wrap">
        <table class="detail-table">
          <thead>
            <tr>
              <th style="width: 40px" class="tc">No</th>
              <th style="width: 110px">Kode</th>
              <th style="min-width: 220px">Nama Area/Rayon</th>
              <th style="width: 60px" class="tc">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in form.detail" :key="item.slsKode">
              <td class="tc">{{ idx + 1 }}</td>
              <td class="mono">{{ item.slsKode }}</td>
              <td>{{ item.slsNama }}</td>
              <td class="tc">
                <button
                  type="button"
                  class="del-btn"
                  title="Hapus baris"
                  @click="removeRayon(idx)"
                >
                  &times;
                </button>
              </td>
            </tr>
            <tr v-if="form.detail.length === 0">
              <td colspan="4" class="tc empty-cell">
                Belum ada area/rayon. Pilih di atas lalu klik Tambah.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

/* Detail Section */
.detail-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  gap: 8px;
  background: white;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.detail-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
}

.detail-add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-select {
  width: 340px;
  height: 28px;
  border: 1px solid var(--ds-border, #a0aab8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  background: white;
}

.detail-select:focus {
  border-color: var(--ds-primary, #0284c7);
}

.detail-table-wrap {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ds-border-light, #dde1e6);
  border-radius: 0;
  max-width: 560px;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.detail-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.detail-table th {
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

.detail-table td {
  padding: 3px 8px;
  border: 1px solid var(--ds-border-light, #dde1e6);
  vertical-align: middle;
}

.detail-table tbody tr:hover td {
  background: rgba(59, 89, 152, 0.04);
}

.tc {
  text-align: center;
}

.del-btn {
  border: none;
  background: transparent;
  color: #dc2626;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 6px;
  line-height: 1;
}

.del-btn:hover {
  color: #991b1b;
}

.empty-cell {
  color: #9e9e9e;
  font-style: italic;
  padding: 12px;
}
</style>
