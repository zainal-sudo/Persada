<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { otorisasiApi, type OtorisasiKonteks } from "@/api/otorisasiApi";

// Dua mode:
// - Konteks ada (FP baru)  → kode dari server (waktu server), verifikasi via
//   POST /otorisasi/request + /verify; backend mencatat konteks & waktu verifikasi.
// - Konteks kosong (legacy, modul yang belum dimigrasi: RETUR/CUSTOMER) →
//   paritas TfrmOtorisasi: kode = waktu lokal (HHMMSS / 99HHMMSS + variant 2),
//   verifikasi rumus kode×21+53×4 di browser.
const props = defineProps<{
  modelValue: boolean;
  variant?: 1 | 2;
  title?: string;
  konteks?: OtorisasiKonteks | null;
  // Paritas UfrmOtorisasi3.edtKeterangan: teks readonly yang memberi
  // konteks baris mana yang butuh persetujuan (mis. "no - customer - nilai").
  keterangan?: string;
  // Kode yang sudah pernah diminta (mis. dari draft/sesi sebelumnya) —
  // kalau ada, dialog pakai kode itu tanpa request baru, supaya kode
  // otorisasi tidak berganti-ganti tiap dialog dibuka ulang.
  kodeCache?: string | null;
  // Mode FP baru: tampilkan tombol "Simpan Draft" di dalam dialog.
  showDraftAction?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "success", kode: string): void;
  (e: "fail", kode: string): void;
  (e: "cancel"): void;
  (e: "draft", kode: string): void;
}>();

const kode = ref("");
const passwordInput = ref("");
const pwdField = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const errMsg = ref("");

const localKode = () => {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const nn = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  return (props.variant === 2 ? "99" : "") + hh + nn + ss;
};

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    errMsg.value = "";
    kode.value = props.konteks ? "" : localKode();
    passwordInput.value = "";

    if (props.kodeCache) {
      // Reuse kode lama — tidak request ulang, kode tidak berubah.
      kode.value = props.kodeCache;
      errMsg.value = "";
    } else if (props.konteks) {
      loading.value = true;
      otorisasiApi
        .request({ ...props.konteks, variant: props.variant || 1 })
        .then(({ kode: k }) => {
          kode.value = k;
        })
        .catch((e: any) => {
          errMsg.value = e?.response?.data?.message || "Gagal meminta kode otorisasi.";
        })
        .finally(() => {
          loading.value = false;
        });
    }
    nextTick(() => pwdField.value?.focus());
  }
);

const submit = async () => {
  if (loading.value) return;
  const pass = passwordInput.value;

  if (!pass) {
    emit("fail", kode.value);
    passwordInput.value = "";
    pwdField.value?.focus();
    return;
  }

  if (!props.konteks) {
    // Mode legacy (tanpa konteks): paritas lama
    const kodeNum = Number(kode.value);
    const passNum = Number(pass);
    if (!kode.value || isNaN(passNum) || kodeNum * 21 + 53 * 4 !== passNum) {
      emit("fail", kode.value);
      passwordInput.value = "";
      pwdField.value?.focus();
      return;
    }
    emit("update:modelValue", false);
    emit("success", kode.value);
    return;
  }

  // Mode baru: verifikasi via backend (mencatat waktu DONE)
  try {
    const { approved } = await otorisasiApi.verify(kode.value, pass);
    if (!approved) {
      emit("fail", kode.value);
      passwordInput.value = "";
      pwdField.value?.focus();
      return;
    }
    emit("update:modelValue", false);
    emit("success", kode.value);
  } catch {
    emit("fail", kode.value);
    passwordInput.value = "";
    pwdField.value?.focus();
  }
};
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="380" persistent>
    <v-card rounded="false">
      <div class="ot-title-bar">
        <span>{{ title || (variant === 2 ? 'Otorisasi Harga Bawah Lastcost' : 'Otorisasi') }}</span>
      </div>
      <v-card-text class="pa-4">
        <div class="ot-row">
          <label class="ot-lbl">Kode</label>
          <input :value="kode" class="ot-inp ot-readonly" readonly />
        </div>
        <div class="ot-row">
          <label class="ot-lbl">Password</label>
          <input
            ref="pwdField"
            v-model="passwordInput"
            type="password"
            class="ot-inp"
            :disabled="loading"
            autocomplete="off"
            @keyup.enter="submit"
          />
        </div>
        <div v-if="keterangan" class="ot-row ot-row-ket">
          <label class="ot-lbl">Ket.</label>
          <textarea class="ot-inp ot-ket" readonly rows="2">{{ keterangan }}</textarea>
        </div>
        <div v-if="loading" class="ot-hint">Meminta kode…</div>
        <div v-else-if="errMsg" class="ot-hint ot-err">{{ errMsg }}</div>
      </v-card-text>
      <v-card-actions class="pa-3 pt-0">
        <v-spacer />
        <v-btn
          v-if="showDraftAction"
          size="small"
          variant="text"
          color="primary"
          @click="emit('draft', kode); emit('update:modelValue', false)"
        >
          Simpan Draft
        </v-btn>
        <v-btn size="small" variant="text" @click="emit('cancel'); emit('update:modelValue', false)">
          Batal
        </v-btn>
        <v-btn size="small" color="primary" variant="flat" :disabled="loading" @click="submit">
          OK
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.ot-title-bar {
  background: var(--ds-primary, #0284c7);
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
}
.ot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.ot-row-ket {
  align-items: flex-start;
}
.ot-ket {
  height: auto;
  min-height: 40px;
  padding: 4px 6px;
  resize: none;
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text, #0c4a6e);
  line-height: 1.4;
  font-size: 11px;
}
.ot-lbl {
  width: 70px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
}
.ot-inp {
  flex: 1;
  height: 28px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 6px;
  font-size: 12px;
  outline: none;
  background: white;
}
.ot-inp:focus {
  border-color: var(--ds-primary, #0284c7);
}
.ot-readonly {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text, #0c4a6e);
  font-family: monospace;
  font-weight: 700;
}
.ot-hint {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.ot-err {
  color: #C62828;
}
</style>