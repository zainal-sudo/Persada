<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import { perusahaanApi, type Perusahaan } from "@/api/setting/perusahaanApi";
import { IconBuildingBank, IconDeviceFloppy, IconRefresh } from "@tabler/icons-vue";

const route = useRoute();
const toast = useToast();
const permission = usePermissionStore();

const form = ref<Perusahaan>({
  perush_nama: "", perush_alamat: "", perush_kota: "", perush_notelp: "",
  perush_nofax: "", perush_npwp: "", perush_nama_npwp: "", perush_alnpwp: "",
  perush_ktnpwp: "", perush_rekening: "",
});
const isLoading = ref(false);
const isSaving = ref(false);

const canEdit = computed(() => permission.canByRoute(route.path, "edit"));

const loadData = async () => {
  isLoading.value = true;
  try {
    const d = await perusahaanApi.get();
    if (d) form.value = { ...form.value, ...d };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat data.");
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  if (!form.value.perush_nama.trim()) {
    toast.warning("Nama perusahaan wajib diisi.");
    return;
  }
  isSaving.value = true;
  try {
    await perusahaanApi.update(form.value);
    toast.success("Identitas perusahaan berhasil disimpan.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal menyimpan.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <PageLayout title="Identitas Perusahaan" :icon="IconBuildingBank" :loading="isLoading">
    <template #header-actions>
      <v-btn size="small" class="tb-btn tb-btn-edit" :loading="isLoading" @click="loadData">
        <template #prepend><IconRefresh :size="14" :stroke-width="1.8" /></template>
        Muat Ulang
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-neutral"
        :loading="isSaving"
        :disabled="!canEdit"
        @click="handleSave"
      >
        <template #prepend><IconDeviceFloppy :size="14" :stroke-width="1.8" /></template>
        Simpan
      </v-btn>
    </template>

    <form class="perusahaan-form" @submit.prevent="handleSave">
      <div class="form-grid">
        <!-- ── Data Perusahaan ── -->
        <fieldset class="group-box">
          <legend>Data Perusahaan</legend>
          <div class="field-row">
            <label class="field-label">Nama <span class="req">*</span></label>
            <input v-model="form.perush_nama" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Alamat</label>
            <input v-model="form.perush_alamat" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Kota</label>
            <input v-model="form.perush_kota" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Telp</label>
            <input v-model="form.perush_notelp" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Fax</label>
            <input v-model="form.perush_nofax" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Rekening</label>
            <input v-model="form.perush_rekening" class="field-input" :disabled="!canEdit" />
          </div>
        </fieldset>

        <!-- ── Data NPWP ── -->
        <fieldset class="group-box">
          <legend>Data NPWP</legend>
          <div class="field-row">
            <label class="field-label">No NPWP</label>
            <input v-model="form.perush_npwp" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Nama NPWP</label>
            <input v-model="form.perush_nama_npwp" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Alamat NPWP</label>
            <input v-model="form.perush_alnpwp" class="field-input" :disabled="!canEdit" />
          </div>
          <div class="field-row">
            <label class="field-label">Kota NPWP</label>
            <input v-model="form.perush_ktnpwp" class="field-input" :disabled="!canEdit" />
          </div>
        </fieldset>
      </div>

      <p v-if="!canEdit" class="edit-hint">Anda tidak memiliki hak akses untuk mengubah identitas perusahaan.</p>
    </form>
  </PageLayout>
</template>

<style scoped>
.perusahaan-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow: auto;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  align-items: start;
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
}
.field-row:last-child { margin-bottom: 0; }
.field-label {
  width: 130px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}
.req { color: #c62828; }
.field-input {
  flex: 1;
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
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.12);
}
.field-input:disabled {
  background: var(--ds-surface, #F0F3F8);
  color: #6b7280;
}
.edit-hint { font-size: 11px; color: #b45309; margin: 0; }
</style>
