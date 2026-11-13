<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import { tutupPeriodeApi } from "@/api/utility/tutupPeriodeApi";
import { useEscClose } from "@/composables/useEscClose";
import { IconLock, IconLockOpen } from "@tabler/icons-vue";

const route = useRoute();
const toast = useToast();
const permission = usePermissionStore();

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const now = new Date();
const currentYear = ref(now.getFullYear());
const lastPeriode = ref<{ bulan: number; tahun: number } | null>(null);

const bulan = ref(now.getMonth() + 1);
const tahun = ref(currentYear.value);

// Tahun diketik bebas (paritas Delphi edtTahun csDropDown), batas sama dengan
// BE valPeriod: 2000..2100. Angka saja, tanpa titik — biar langsung jelas.
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
const isOpening = ref(false);
const confirmAction = ref<"proses" | "buka" | null>(null);

const canProses = computed(() => permission.canByRoute(route.path, "insert"));
const canBuka = computed(() => permission.canByRoute(route.path, "delete"));
const selectedLabel = computed(
  () => `${NAMA_BULAN[bulan.value - 1]} ${tahun.value || "?"}`
);
const isTutup = computed(() => confirmAction.value === "proses");
const showConfirm = computed({
  get: () => confirmAction.value !== null,
  set: (v: boolean) => {
    if (!v) confirmAction.value = null;
  },
});

// Esc = batal. Setter di atas sudah membersihkan confirmAction, jadi cukup
// set false lewat showConfirm.
useEscClose(showConfirm, () => { showConfirm.value = false; });

const loadLast = async () => {
  // Tab KeepAlive bisa terbuka melewati pergantian tahun.
  currentYear.value = new Date().getFullYear();
  isLoading.value = true;
  try {
    const last = await tutupPeriodeApi.getLast();
    if (last?.tahun && last?.bulan) {
      lastPeriode.value = { bulan: last.bulan, tahun: last.tahun };
      let b = last.bulan + 1;
      let t = last.tahun;
      if (b > 12) {
        b = 1;
        t += 1;
      }
      bulan.value = b;
      tahun.value = t;
    }
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat periode terakhir.");
  } finally {
    isLoading.value = false;
  }
};

const runProses = async () => {
  isProcessing.value = true;
  try {
    await tutupPeriodeApi.proses({ bulan: bulan.value, tahun: tahun.value });
    toast.success(`Tutup Periode ${selectedLabel.value} Berhasil.`);
    await loadLast();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal tutup periode.");
  } finally {
    isProcessing.value = false;
    confirmAction.value = null;
  }
};

const runBuka = async () => {
  isOpening.value = true;
  try {
    await tutupPeriodeApi.buka({ bulan: bulan.value, tahun: tahun.value });
    toast.success(`Buka Periode ${selectedLabel.value} Berhasil.`);
    await loadLast();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal buka periode.");
  } finally {
    isOpening.value = false;
    confirmAction.value = null;
  }
};

onMounted(loadLast);

// `onMounted` sudah memuat data saat tab pertama dibuka, jadi aktivasi pertama
// dilewati agar tidak ada dua request. Aktivasi berikutnya (kembali ke tab ini)
// memuat ulang supaya periode terakhir tidak basi.
let sudahAktif = false;
onActivated(() => {
  if (sudahAktif) loadLast();
  sudahAktif = true;
});
</script>

<template>
  <PageLayout title="Tutup Periode" :icon="IconLock" :loading="isLoading">
    <form class="tp-layout" @submit.prevent>
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
      </fieldset>

      <fieldset class="group-box">
        <legend>Status Periode</legend>
        <table v-if="lastPeriode" class="info-table">
          <tbody>
            <tr>
              <td class="lbl">Periode terakhir ditutup</td>
              <td class="val">
                {{ NAMA_BULAN[lastPeriode.bulan - 1] }} {{ lastPeriode.tahun }}
              </td>
            </tr>
            <tr>
              <td class="lbl">Periode terbuka berikutnya</td>
              <td class="val">{{ selectedLabel }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-state">Belum ada periode yang ditutup.</p>
      </fieldset>

      <div class="btn-row">
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isProcessing"
          :disabled="!canProses || !canSubmit"
          @click="confirmAction = 'proses'"
        >
          <template #prepend><IconLock :size="14" :stroke-width="1.8" /></template>
          Proses
        </v-btn>
        <v-btn
          size="small"
          class="tb-btn tb-btn-danger"
          :loading="isOpening"
          :disabled="!canBuka || !canSubmit"
          @click="confirmAction = 'buka'"
        >
          <template #prepend><IconLockOpen :size="14" :stroke-width="1.8" /></template>
          Buka
        </v-btn>
        <p v-if="!canProses || !canBuka" class="edit-hint">
          Anda tidak memiliki hak {{ !canProses ? "insert" : "delete" }} untuk
          menu ini.
        </p>
      </div>
    </form>
  </PageLayout>

  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">{{ isTutup ? "Tutup Periode" : "Buka Periode" }}</h3>
      <p class="confirm-text">
        Yakin ingin {{ isTutup ? "menutup" : "membuka" }} periode
        <strong>{{ selectedLabel }}</strong
        >{{ isTutup
        ? "? Jurnal laba rugi periode ini akan dibuat dan transaksi setelahnya diblokir."
        : "? Record penutupan periode ini akan dihapus." }}
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="confirmAction = null">Batal</v-btn>
        <v-btn
          size="small"
          :class="isTutup ? 'tb-btn tb-btn-primary' : 'tb-btn tb-btn-danger'"
          :loading="isProcessing || isOpening"
          @click="isTutup ? runProses() : runBuka()"
        >
          {{ isTutup ? "Tutup" : "Buka" }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.tp-layout {
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
.field-row:last-of-type { margin-bottom: 0; }
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
  border-top-color: var(--ds-border-inset-edge, #7E8B9B);
  border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  border-radius: 0;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
  background: white;
}
.field-input:focus {
  border-color: var(--ds-primary, #0284c7);
}
.field-input.is-invalid {
  border-color: #DC2626;
}
.field-error {
  margin: 0;
  font-size: 11px;
  color: #DC2626;
}
.w-200 { width: 200px; }
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
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
