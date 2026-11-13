<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import {
  prosesBiayaPromosiApi,
  type PratinjauBiayaPromosi,
} from "@/api/utility/prosesBiayaPromosiApi";
import { IconRefresh, IconPlayerPlay } from "@tabler/icons-vue";
import { useEscClose } from "@/composables/useEscClose";

const route = useRoute();
const toast = useToast();
const permission = usePermissionStore();

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const now = new Date();
const bulan = ref(now.getMonth() + 1);
const tahun = ref(now.getFullYear());

// Tahun diketik bebas (paritas Delphi edtTahun csDropDown), batas sama dengan
// BE valPeriod: 2000..2100.
const sanitizeTahun = () => {
  const digits = String(tahun.value ?? "").replace(/\D/g, "").slice(0, 4);
  tahun.value = digits === "" ? ("" as unknown as number) : Number(digits);
};
const tahunError = computed(() => {
  const t = Number(tahun.value);
  if (!tahun.value || !Number.isFinite(t)) return "Tahun wajib diisi (2000–2100).";
  if (t < 2000 || t > 2100) return "Tahun harus antara 2000–2100.";
  return "";
});
const canSubmit = computed(() => !tahunError.value);

const isLoading = ref(false);
const isProcessing = ref(false);
const showConfirm = ref(false);
useEscClose(showConfirm, () => (showConfirm.value = false));

const canProses = computed(() => permission.canByRoute(route.path, "insert"));

const pratinjau = ref<PratinjauBiayaPromosi | null>(null);

const loadPratinjau = async () => {
  // Jangan tembak BE dengan tahun setengah-ketik (mis. "2") — pasti ditolak
  // valPeriod. Kosongkan pratinjau biar tidak menampilkan data periode lama.
  if (!canSubmit.value) {
    pratinjau.value = null;
    return;
  }
  isLoading.value = true;
  try {
    pratinjau.value = await prosesBiayaPromosiApi.pratinjau(
      bulan.value,
      tahun.value
    );
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat pratinjau.");
  } finally {
    isLoading.value = false;
  }
};

// Pratinjau mengikuti periode yang dipilih.
watch([bulan, tahun], loadPratinjau);

const selectedLabel = computed(() => `${NAMA_BULAN[bulan.value - 1]} ${tahun.value}`);

const runProses = async () => {
  isProcessing.value = true;
  try {
    const hasil = await prosesBiayaPromosiApi.proses({
      bulan: bulan.value,
      tahun: tahun.value,
    });
    toast.success(
      `Proses Biaya Promosi ${selectedLabel.value} selesai: ` +
        `${hasil.detailTersalin} baris detail tersalin, ` +
        `${hasil.fakturDiperbarui} faktur diperbarui.`
    );
    await loadPratinjau();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal proses biaya promosi.");
  } finally {
    isProcessing.value = false;
    showConfirm.value = false;
  }
};

onMounted(loadPratinjau);

// Tab KeepAlive: muat ulang saat kembali ke tab ini.
let sudahAktif = false;
onActivated(() => {
  if (sudahAktif) loadPratinjau();
  sudahAktif = true;
});
</script>

<template>
  <PageLayout title="Proses Biaya Promosi" :icon="IconPlayerPlay" :loading="isLoading">
    <div class="pbp-layout">
      <fieldset class="group-box">
        <legend>Periode</legend>
        <div class="field-row">
          <label class="field-label">Bulan</label>
          <select v-model.number="bulan" class="field-input w-200">
            <option v-for="(nama, i) in NAMA_BULAN" :key="i + 1" :value="i + 1">
              {{ nama }}
            </option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Tahun</label>
          <input
            v-model="tahun"
            type="text"
            inputmode="numeric"
            class="field-input w-200"
            :class="{ 'is-invalid': tahunError }"
            placeholder="2000–2100"
            maxlength="4"
            @input="sanitizeTahun"
          />
        </div>
        <p v-if="tahunError" class="field-error">{{ tahunError }}</p>
        <button type="button" class="btn-load" :disabled="!canSubmit" @click="loadPratinjau">
          <IconRefresh :size="13" :stroke-width="1.8" />
          Muat Ulang Pratinjau
        </button>
      </fieldset>

      <fieldset class="group-box">
        <legend>Pratinjau</legend>
        <table v-if="pratinjau" class="info-table">
          <tbody>
            <tr>
              <td class="lbl">Setting Biaya Promosi (master)</td>
              <td class="val">{{ pratinjau.jmlSetting }} baris</td>
            </tr>
            <tr>
              <td class="lbl">Faktur pada periode</td>
              <td class="val">{{ pratinjau.jmlFaktur }} faktur</td>
            </tr>
            <tr>
              <td class="lbl">Faktur terkait setting promosi</td>
              <td class="val">{{ pratinjau.jmlFakturTerkaitPromosi }} faktur</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-state">Pratinjau tidak tersedia.</p>
      </fieldset>

      <div class="btn-row">
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isProcessing"
          :disabled="!canProses || !canSubmit"
          @click="showConfirm = true"
        >
          <template #prepend><IconPlayerPlay :size="14" :stroke-width="1.8" /></template>
          Proses
        </v-btn>
        <p v-if="!canProses" class="edit-hint">
          Anda tidak memiliki hak insert untuk menu ini.
        </p>
      </div>
    </div>
  </PageLayout>

  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Proses Biaya Promosi</h3>
      <p class="confirm-text">
        Yakin memproses biaya promosi periode <strong>{{ selectedLabel }}</strong>?
        Nilai <code>fpd_bp_pr</code>/<code>fpd_bp_rp</code> detail faktur dan
        <code>fp_biayarp</code> header faktur periode ini akan ditimpa ulang dari
        setting master biaya promosi.
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showConfirm = false">Batal</v-btn>
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isProcessing"
          @click="runProses"
        >
          Proses
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.pbp-layout {
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
  max-width: 640px;
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
  margin-bottom: 8px;
}
.field-row:last-of-type {
  margin-bottom: 12px;
}
.field-label {
  width: 70px;
  flex-shrink: 0;
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
  box-shadow: 0 0 0 2px rgba(59, 89, 152, 0.12);
}
.w-200 {
  width: 200px;
}
.field-input.is-invalid {
  border-color: #DC2626;
}
.field-error {
  margin: 0;
  font-size: 11px;
  color: #DC2626;
}
.btn-load {
  height: 26px;
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
.btn-load:hover {
  background: var(--ds-surface-inset, #E8ECF1);
}
.info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.info-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
}
.info-table .lbl {
  color: var(--ds-text-secondary, #5A6A7E);
}
.info-table .val {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ds-text, #0c4a6e);
}
.empty-state {
  font-size: 12px;
  color: var(--ds-text-muted, #8494A7);
  font-style: italic;
  margin: 4px 0 0;
}
.btn-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.edit-hint {
  font-size: 11px;
  color: #0369a1;
  margin: 0;
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
.confirm-text code {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 11px;
  background: var(--ds-surface-inset, #E8ECF1);
  padding: 0 3px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
