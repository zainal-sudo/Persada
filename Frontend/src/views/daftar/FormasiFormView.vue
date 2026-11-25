<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import BaseForm from "@/components/BaseForm.vue";
import { IconStack2 } from "@tabler/icons-vue";
import {
  formasiFormApi,
  type FormasiForm,
  type FormasiTarget,
  type FormasiArea,
  type SalesmanOption,
  type TypeOption,
  type DivisiOption,
} from "@/api/daftar/formasiFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => !!route.params.id);
const editId = computed(() => Number(route.params.id));
const isLoading = ref(false);
const isSaving = ref(false);

const emptyForm = (): FormasiForm => ({
  isEdit: false,
  id: null,
  nama: "",
  divisi: "",
  type: "",
  atasanKode: "",
  target: [],
});

const form = ref<FormasiForm>(emptyForm());
const areasList = ref<FormasiArea[]>([]);
const salesmanOptions = ref<SalesmanOption[]>([]);
const typeOptions = ref<TypeOption[]>([]);
const divisiOptions = ref<DivisiOption[]>([]);

const currentYear = new Date().getFullYear();
const tahunOptions = Array.from({ length: 7 }, (_, i) => currentYear - 6 + i);
const tahun = ref(currentYear);

const loadOptions = async () => {
  try {
    const [salesman, types, divisis] = await Promise.all([
      formasiFormApi.getSalesmanOptions(),
      formasiFormApi.getTypeOptions(),
      formasiFormApi.getDivisiOptions(),
    ]);
    salesmanOptions.value = salesman;
    typeOptions.value = types;
    divisiOptions.value = divisis;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat pilihan formasi.");
  }
};

const loadTarget = async (id: number) => {
  try {
    const data = await formasiFormApi.getTargetBulanan(id, tahun.value);
    form.value.target = data.map((t) => ({
      periode: t.periode,
      nama: t.nama,
      target: Number(t.target) || 0,
      targetJenis: t.targetJenis,
      additionalTargetProduk: t.additionalTargetProduk,
    }));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat target bulanan.");
  }
};

const loadData = async () => {
  await loadOptions();
  if (!isEdit.value) {
    await loadTarget(0);
    return;
  }

  isLoading.value = true;
  try {
    const data = await formasiFormApi.getDetailForm(editId.value);
    form.value = {
      ...emptyForm(),
      isEdit: true,
      id: data.id,
      nama: data.nama,
      divisi: data.divisi,
      type: data.type,
      atasanKode: data.atasanKode,
    };
    areasList.value = data.areas || [];
    await loadTarget(data.id);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data formasi.");
    router.push({ name: "formasiBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const onTahunChange = async () => {
  await loadTarget(form.value.id || 0);
};

const formatTarget = (value: number): string =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    value || 0,
  );

const onTargetFocus = (item: FormasiTarget, e: Event) => {
  if (!item.target) (e.target as HTMLInputElement).value = "";
};

const onTargetInput = (item: FormasiTarget, e: Event) => {
  const el = e.target as HTMLInputElement;
  const digits = el.value.replace(/\D/g, "");
  item.target = digits ? Number(digits) : 0;
  el.value = digits ? formatTarget(item.target) : "";
};

const onTargetBlur = (item: FormasiTarget, e: Event) => {
  (e.target as HTMLInputElement).value = formatTarget(item.target);
};

const confirmSave = async (action: "new" | "close") => {
  if (!form.value.nama.trim()) {
    toast.warning("Nama formasi wajib diisi.");
    return;
  }
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await formasiFormApi.save({
      ...form.value,
      tahun: tahun.value,
    });
    handlePostSave(action, String(res?.data?.id || form.value.id || ""));
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan formasi.");
  } finally {
    isSaving.value = false;
  }
};

const resetForm = async () => {
  form.value = emptyForm();
  areasList.value = [];
  await loadTarget(0);
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

onMounted(() => {
  loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Formasi' : 'Tambah Formasi Baru'"
    :icon="IconStack2"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="formasi-form">
      <div class="form-row">
        <label class="form-label">Nama Formasi <span class="req">*</span></label>
        <input
          v-model="form.nama"
          class="form-input"
          maxlength="255"
          placeholder="Nama formasi..."
        />
      </div>
      <div class="form-row">
        <label class="form-label">Divisi</label>
        <select v-model="form.divisi" class="form-input">
          <option value="">- Pilih divisi -</option>
          <option v-for="d in divisiOptions" :key="d.kode" :value="d.kode">
            {{ d.nama && d.nama !== d.kode ? `${d.kode} — ${d.nama}` : d.kode }}
          </option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Type</label>
        <select v-model="form.type" class="form-input">
          <option value="">- Pilih type -</option>
          <option
            v-if="form.type && !typeOptions.some((t) => t.kode === form.type)"
            :value="form.type"
          >
            {{ form.type }}
          </option>
          <option v-for="t in typeOptions" :key="t.kode" :value="t.kode">
            {{ t.keterangan ? `${t.kode} — ${t.keterangan}` : t.kode }}
          </option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Atasan</label>
        <select v-model="form.atasanKode" class="form-input">
          <option value="">- Pilih atasan -</option>
          <option v-for="s in salesmanOptions" :key="s.kode" :value="s.kode">
            {{ s.kode }} — {{ s.nama }}
          </option>
        </select>
      </div>
    </div>

    <div class="formasi-body">
      <section class="area-panel">
        <div class="panel-header">
          <span class="panel-title">Area/Rayon dalam Formasi</span>
          <span class="panel-count">{{ areasList.length }} area</span>
        </div>

        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 40px" class="tc">No</th>
                <th style="width: 120px">Kode</th>
                <th style="min-width: 220px">Nama Area/Rayon</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(area, idx) in areasList" :key="area.kode">
                <td class="tc">{{ idx + 1 }}</td>
                <td class="mono">{{ area.kode }}</td>
                <td>{{ area.nama }}</td>
              </tr>
              <tr v-if="areasList.length === 0">
                <td colspan="3" class="tc empty-cell">
                  Belum ada area/rayon pada formasi ini. Pengaturan area dilakukan di modul Area/Rayon.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="target-panel">
        <div class="panel-header">
          <span class="panel-title">Target Formasi</span>
          <div class="target-tahun">
            <label class="tahun-label">Tahun</label>
            <select v-model="tahun" class="tahun-select" @change="onTahunChange">
              <option v-for="t in tahunOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="target-table-wrap">
          <table class="target-table">
            <thead>
              <tr>
                <th style="width: 40px" class="tc">No</th>
                <th style="width: 110px">Bulan</th>
                <th class="tr">Target</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in form.target" :key="item.periode">
                <td class="tc">{{ idx + 1 }}</td>
                <td>{{ item.nama }}</td>
                <td class="tr">
                  <input
                    :value="formatTarget(item.target)"
                    type="text"
                    inputmode="numeric"
                    class="target-input"
                    @focus="onTargetFocus(item, $event)"
                    @input="onTargetInput(item, $event)"
                    @blur="onTargetBlur(item, $event)"
                  />
                </td>
              </tr>
              <tr v-if="form.target.length === 0">
                <td colspan="3" class="tc empty-cell">Belum ada data target.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </BaseForm>
</template>

<style scoped>
.formasi-form {
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
  background: white;
}

.form-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.1);
}

.mono {
  font-family: "Consolas", "Courier New", monospace;
}

.formasi-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 8px 16px 12px;
  background: white;
}

.area-panel,
.target-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.area-panel {
  flex: 1 1 0;
  min-width: 0;
}

.target-panel {
  flex: 0 0 400px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase;
}

.panel-count {
  font-size: 10px;
  color: #6b7280;
}

.target-tahun {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tahun-select {
  height: 28px;
  border: 1px solid var(--ds-border, #a0aab8);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  background: white;
}

.tahun-label {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
}

.tahun-select {
  width: 76px;
}

.detail-table-wrap,
.target-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ds-border-light, #dde1e6);
  border-radius: 0;
}

.detail-table,
.target-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.detail-table thead tr,
.target-table thead tr {
  background: var(--ds-primary, #0284c7);
}

.detail-table th,
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

.detail-table td,
.target-table td {
  padding: 3px 8px;
  border: 1px solid var(--ds-border-light, #dde1e6);
  vertical-align: middle;
}

.detail-table tbody tr:hover td,
.target-table tbody tr:hover td {
  background: rgba(59, 89, 152, 0.04);
}

.target-input {
  width: 100%;
  height: 24px;
  border: 1px solid var(--ds-border, #a0aab8);
  border-radius: 0;
  padding: 0 6px;
  font-size: 11px;
  outline: none;
  text-align: right;
  box-sizing: border-box;
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

@media (max-width: 900px) {
  .formasi-body {
    flex-direction: column;
    overflow-y: auto;
  }

  .area-panel,
  .target-panel {
    flex: 0 0 auto;
  }

  .detail-table-wrap,
  .target-table-wrap {
    flex: none;
    max-height: 300px;
  }
}
</style>
