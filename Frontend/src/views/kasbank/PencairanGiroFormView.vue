<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { useAfterSave } from "@/composables/useAfterSave";
import { IconCashBanknote, IconSearch } from "@tabler/icons-vue";
import DsDatePicker from "@/components/DsDatePicker.vue";
import {
  pencairanGiroFormApi,
  type PencairanGiroForm,
} from "@/api/kasbank/pencairanGiroFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.nomor);
const isLoading = ref(false);
const isSaving = ref(false);

const today = new Date().toISOString().slice(0, 10);

// ── Form State ───────────────────────────────────────────────────────
const blankForm = (): PencairanGiroForm => ({
  isEdit: false,
  nomor: "",
  tanggal: today,
  nogiro: "",
  tanggalCair: today,
  nilai: 0,
  rekBank: "",
});
const form = ref<PencairanGiroForm>(blankForm());

// "Simpan & Baru": kosongkan form lalu ambil nomor transaksi baru.
const resetForm = () => {
  form.value = blankForm();
  loadMaxNomor();
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Lookup Options ───────────────────────────────────────────────────
const rekeningOptions = ref<{ kode: string; nama: string }[]>([]);
const giroOptions = ref<any[]>([]);
const giroLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showGiroModal = ref(false);

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const nomor = route.params.nomor as string;
  if (!nomor) {
    form.value.isEdit = false;
    await loadMaxNomor();
    return;
  }

  isLoading.value = true;
  try {
    const data = await pencairanGiroFormApi.getDetailForm(decodeURIComponent(nomor));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      nomor: data.nomor || nomor,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data pencairan giro.");
    router.push({ name: "pencairanGiroBrowse" });
  } finally {
    isLoading.value = false;
  }
};

const loadMaxNomor = async () => {
  try {
    const cabang = authStore.userCabang || "P01";
    form.value.nomor = await pencairanGiroFormApi.getMaxNomor(form.value.tanggal, cabang);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal generate nomor.");
  }
};

const loadRekening = async () => {
  try {
    rekeningOptions.value = await pencairanGiroFormApi.getRekening();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data rekening.");
  }
};

// ── Watch tanggal → generate nomor baru ──────────────────────────────
watch(
  () => form.value.tanggal,
  async () => {
    if (!form.value.isEdit) {
      await loadMaxNomor();
    }
  }
);

// ── Search Giro ──────────────────────────────────────────────────────
const searchGiro = async (query: string) => {
  giroLoading.value = true;
  try {
    giroOptions.value = await pencairanGiroFormApi.searchGiro(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari giro.");
  } finally {
    giroLoading.value = false;
  }
};

const openGiroModal = () => {
  showGiroModal.value = true;
  searchGiro("");
};

const selectGiro = (item: any) => {
  form.value.nogiro = item.nogiro;
  form.value.nilai = Number(item.nilai);
  showGiroModal.value = false;
};

// ── Validasi ─────────────────────────────────────────────────────────
const validateSave = (): boolean => {
  if (!form.value.nogiro.trim()) {
    toast.warning("Nomor Giro harus diisi.");
    return false;
  }
  if (!form.value.rekBank) {
    toast.warning("Rekening harus dipilih.");
    return false;
  }
  if (Number(form.value.nilai) <= 0) {
    toast.warning("Nilai harus lebih dari 0.");
    return false;
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!validateSave()) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = await pencairanGiroFormApi.save(form.value);
    const nomor = res?.nomor || form.value.nomor;
    handlePostSave(action, nomor);
    toast.success("Data pencairan giro berhasil disimpan.");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadRekening();
  await loadData();
});

// ── Formatting ───────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Pencairan Giro' : 'Tambah Pencairan Giro Baru'"
    :icon="IconCashBanknote"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="pg-layout">
      <!-- Giro Info -->
      <fieldset class="pg-groupbox">
        <legend class="pg-legend">Informasi Giro</legend>
        <div class="pg-groupbody">
          <div class="pg-form-grid">
            <div class="f-row">
              <label class="f-lbl">Nomor Giro <span class="req">*</span></label>
              <div class="search-group">
                <input :value="form.nogiro" class="f-inp readonly-bg" readonly placeholder="Pilih giro..." />
                <button class="btn-search" type="button" @click="openGiroModal">
                  <IconSearch :size="13" />
                </button>
              </div>
            </div>
            <div class="f-row">
              <label class="f-lbl">Nilai <span class="req">*</span></label>
              <input :value="fmt(form.nilai)" class="f-inp readonly-bg text-right" readonly style="max-width:200px" />
            </div>
          </div>
        </div>
      </fieldset>

      <!-- Transaksi Info -->
      <fieldset class="pg-groupbox">
        <legend class="pg-legend">Informasi Transaksi</legend>
        <div class="pg-groupbody">
          <div class="pg-form-grid">
            <div class="f-row">
              <label class="f-lbl">Nomor</label>
              <input :value="form.nomor" class="f-inp readonly-bg" readonly />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal</label>
              <DsDatePicker v-model="form.tanggal" variant="form" style="max-width:200px" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Tanggal Cair</label>
              <DsDatePicker v-model="form.tanggalCair" variant="form" style="max-width:200px" />
            </div>
            <div class="f-row">
              <label class="f-lbl">Rekening <span class="req">*</span></label>
              <select v-model="form.rekBank" class="f-inp">
                <option value="" disabled>-- Pilih Rekening --</option>
                <option v-for="r in rekeningOptions" :key="r.kode" :value="r.kode">
                  {{ r.kode }} - {{ r.nama }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH GIRO ═══ -->
  <SearchModal
    v-model="showGiroModal"
    title="Pilih Nomor Giro"
    :columns="[
      { key: 'nogiro', title: 'No. Giro', width: '150px' },
      { key: 'nilai', title: 'Nilai', width: '120px', align: 'right' },
      { key: 'tanggal', title: 'Tanggal', width: '100px', align: 'center' },
      { key: 'kode', title: 'Kode Customer', width: '100px' },
      { key: 'nama', title: 'Nama Customer' },
    ]"
    :items="giroOptions"
    :loading="giroLoading"
    :server-search="true"
    search-placeholder="Cari giro..."
    @select="selectGiro"
    @search="searchGiro"
  />
</template>

<style scoped>
/* Pencairan Giro Form — matches DOFormView / SOFormView */

input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ds-primary, #0284c7);
  outline-offset: 0;
}

.pg-layout {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
}

.pg-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px 12px;
}

@media (max-width: 768px) {
  .pg-form-grid { grid-template-columns: 1fr; }
}

.pg-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0; margin: 0;
  display: flex; flex-direction: column;
}

.pg-legend {
  font-size: 11px; font-weight: 700;
  color: var(--ds-primary, #0284c7);
  text-transform: uppercase; letter-spacing: 0.03em;
  padding: 2px 6px; margin-left: 6px;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start; line-height: 1.4;
}

.pg-groupbody {
  padding: 8px;
  display: flex; flex-direction: column; gap: 5px;
}

.f-row {
  display: flex; align-items: center; gap: 4px; width: 100%;
}

.f-lbl {
  width: 80px; flex-shrink: 0;
  font-size: 11px; font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}

.req { color: #c62828; }

.f-inp {
  flex: 1; max-width: 400px; height: 24px;
  border: 1px solid var(--ds-border, #A0AAB8); border-radius: 0;
  padding: 0 5px; font-size: 11px; outline: none;
  box-sizing: border-box; background: white;
  color: var(--ds-text, #0c4a6e);
}

.f-inp:focus { border-color: var(--ds-primary, #0284c7); }

.readonly-bg {
  background: var(--ds-surface-inset, #E0E4EA);
  color: #3D4F6A;
}

.text-right { text-align: right; }

.search-group {
  display: flex; flex: 1; max-width: 400px; gap: 2px;
}

.btn-search {
  height: 24px; width: 26px;
  background: var(--ds-primary, #0284c7); color: white;
  border: 1px solid var(--ds-primary-dark, #0369a1); border-radius: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
}
.btn-search:hover { background: var(--ds-primary-dark, #0369a1); }


</style>