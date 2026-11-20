<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import PageLayout from "@/components/PageLayout.vue";
import { usePermissionStore } from "@/stores/permissionStore";
import {
  postingJurnalBulananApi,
  type PratinjauJurnalBulanan,
} from "@/api/utility/postingJurnalBulananApi";
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
const pratinjau = ref<PratinjauJurnalBulanan | null>(null);

const loadPratinjau = async () => {
  if (!canSubmit.value) {
    pratinjau.value = null;
    return;
  }
  isLoading.value = true;
  try {
    pratinjau.value = await postingJurnalBulananApi.pratinjau(bulan.value, tahun.value);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal memuat pratinjau jurnal.");
  } finally {
    isLoading.value = false;
  }
};

watch([bulan, tahun], loadPratinjau);

const selectedLabel = computed(() => `${NAMA_BULAN[bulan.value - 1]} ${tahun.value}`);
const bisaPosting = computed(
  () => Boolean(pratinjau.value?.bisaDiposting && pratinjau.value.rows.length)
);
const canPosting = computed(() => canProses.value && bisaPosting.value);

const fmtAngka = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const fmtTanggal = (v: string | null) => {
  if (!v) return "-";
  const [y, m, d] = v.split("-");
  return `${d}-${m}-${y}`;
};

const runProses = async () => {
  isProcessing.value = true;
  try {
    const hasil = await postingJurnalBulananApi.proses({
      bulan: bulan.value,
      tahun: tahun.value,
    });
    toast.success(
      `Posting Jurnal Bulanan ${selectedLabel.value} selesai: ${hasil.jumlahJurnal} jurnal ditulis.`
    );
    await loadPratinjau();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message ?? "Gagal posting jurnal bulanan.");
  } finally {
    isProcessing.value = false;
    showConfirm.value = false;
  }
};

onMounted(loadPratinjau);

let sudahAktif = false;
onActivated(() => {
  if (sudahAktif) loadPratinjau();
  sudahAktif = true;
});
</script>

<template>
  <PageLayout title="Posting Jurnal Bulanan" :icon="IconPlayerPlay" :loading="isLoading">
    <div class="pjb-layout">
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

      <fieldset class="group-box wide">
        <legend>Pratinjau</legend>
        <template v-if="pratinjau">
          <div v-if="!pratinjau.bisaDiposting" class="warning-box">
            {{ pratinjau.alasan }}
          </div>
          <div class="tbl-wrap">
            <table class="grid-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-kode">Jenis</th>
                  <th class="col-kode">Nomor Jurnal</th>
                  <th class="col-tgl">Tanggal</th>
                  <th class="col-nama">Keterangan</th>
                  <th class="col-angka">Debet</th>
                  <th class="col-angka">Kredit</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in pratinjau.rows" :key="r.nomor">
                  <td class="col-no">{{ i + 1 }}</td>
                  <td class="col-kode mono">{{ r.jenis }}</td>
                  <td class="col-kode mono">{{ r.nomor }}</td>
                  <td class="col-tgl">{{ fmtTanggal(r.tanggal) }}</td>
                  <td class="col-nama">{{ r.keterangan }}</td>
                  <td class="col-angka num">{{ fmtAngka(r.totalDebet) }}</td>
                  <td class="col-angka num">{{ fmtAngka(r.totalKredit) }}</td>
                </tr>
                <tr v-if="!pratinjau.rows.length">
                  <td colspan="7" class="empty-row">Tidak ada jurnal pada periode ini.</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" class="total-label">Total</td>
                  <td class="col-angka num">{{ fmtAngka(pratinjau.totalDebet) }}</td>
                  <td class="col-angka num">{{ fmtAngka(pratinjau.totalKredit) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </template>
        <p v-else class="empty-state">Pratinjau tidak tersedia.</p>
      </fieldset>

      <div class="btn-row">
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isProcessing"
          :disabled="!canPosting"
          @click="showConfirm = true"
        >
          <template #prepend><IconPlayerPlay :size="14" :stroke-width="1.8" /></template>
          Posting
        </v-btn>
        <p v-if="!canProses" class="edit-hint">
          Anda tidak memiliki hak insert untuk menu ini.
        </p>
      </div>
    </div>
  </PageLayout>

  <v-dialog v-model="showConfirm" width="460" persistent>
    <div class="confirm-box">
      <h3 class="confirm-title">Posting Jurnal Bulanan</h3>
      <p class="confirm-text">
        Yakin memposting jurnal bulanan periode <strong>{{ selectedLabel }}</strong>?
        Jurnal dengan nomor <code>J.*.{{ String(bulan).padStart(2, "0") }}{{ tahun }}</code>
        akan ditimpa ulang (baris lama dihapus, lalu ditulis kembali).
      </p>
      <div class="confirm-actions">
        <v-btn size="small" variant="outlined" @click="showConfirm = false">Batal</v-btn>
        <v-btn
          size="small"
          class="tb-btn tb-btn-primary"
          :loading="isProcessing"
          @click="runProses"
        >
          Ya, Posting
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.pjb-layout {
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
.group-box.wide {
  max-width: 980px;
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
.warning-box {
  margin-bottom: 8px;
  padding: 7px 9px;
  border: 1px solid #F59E0B;
  background: #FFFBEB;
  color: #92400E;
  font-size: 11px;
  font-weight: 600;
}
.tbl-wrap {
  overflow: auto;
  max-height: 420px;
}
.grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.grid-table th {
  position: sticky;
  top: 0;
  background: var(--ds-surface-inset, #E8ECF1);
  color: var(--ds-text, #0c4a6e);
  font-size: 11px;
  text-align: left;
  padding: 5px 6px;
  border: 1px solid var(--ds-border, #A0AAB8);
  white-space: nowrap;
}
.grid-table td {
  padding: 3px 6px;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}
.col-no { width: 40px; text-align: center; }
.col-kode { width: 150px; }
.col-tgl { width: 100px; text-align: center; }
.col-nama { min-width: 180px; }
.col-angka { width: 150px; text-align: right; }
.mono {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 10.5px;
}
.num {
  font-variant-numeric: tabular-nums;
}
.total-label {
  text-align: right;
  font-weight: 700;
  color: var(--ds-text-secondary, #5A6A7E);
}
.grid-table tfoot td {
  background: var(--ds-surface, #F0F3F8);
  font-weight: 700;
}
.empty-row {
  text-align: center;
  font-style: italic;
  color: var(--ds-text-muted, #8494A7);
  padding: 12px;
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
