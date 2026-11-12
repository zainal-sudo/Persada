<script setup lang="ts">
/**
 * Dialog konfirmasi bersama (menggantikan dialog inline yang tersebar di view).
 *
 * Struktur mengikuti dialog konfirmasi hapus di BaseBrowse dan dialog simpan di
 * BaseForm: bar judul padat berisi aksi, baris fakta, kalimat, lalu footer
 * dengan petunjuk Esc di kiri dan tombol aksi di kanan.
 *
 * Selalu `persistent`: klik backdrop tidak boleh membatalkan konfirmasi diam
 * diam, karena aksi di baliknya (cetak ulang, ubah status bayar) sulit
 * dibatalkan. Esc dan tombol tutup tetap tersedia.
 */
import { ref, watch, nextTick, onUnmounted } from "vue";
import MsIcon from "@/components/MsIcon.vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    /** Nama ikon Material Symbols, mis. "print"/"help"/"warning". */
    icon?: string;
    /** Kalimat penjelas, mis. "Faktur ini sudah pernah dicetak." */
    message?: string;
    /** Pertanyaan yang diminta diputuskan, mis. "Yakin ingin mencetak lagi?" */
    question?: string;
    /** Baris fakta (identitas data) di atas kalimat. */
    subjectLabel?: string;
    subjectValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Teks setelah kbd Esc di footer. */
    hint?: string;
    /** Merah hanya untuk aksi merusak (hapus), sisanya Steel Blue. */
    tone?: "primary" | "danger";
    busy?: boolean;
    maxWidth?: number | string;
  }>(),
  {
    title: "Konfirmasi",
    icon: "",
    message: "",
    question: "",
    subjectLabel: "",
    subjectValue: "",
    confirmLabel: "Ya",
    cancelLabel: "Batal",
    hint: "batal",
    tone: "primary",
    busy: false,
    maxWidth: 420,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const cardRef = ref<HTMLElement | null>(null);
let prevFocus: HTMLElement | null = null;
// Kunci single-flight: dua klik cepat pada tombol konfirmasi tetap harus
// menjadi satu aksi.
let dispatched = false;

const close = () => {
  emit("update:modelValue", false);
  emit("cancel");
};

const confirm = () => {
  if (dispatched || props.busy) return;
  dispatched = true;
  emit("update:modelValue", false);
  emit("confirm");
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  close();
};

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      dispatched = false;
      prevFocus = document.activeElement as HTMLElement | null;
      nextTick(() => cardRef.value?.focus());
      // Fokus Vuetify belum tentu ada di card, jadi Esc dipegang lewat window.
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
      // Kembalikan fokus ke pemanggil agar navigasi keyboard tetap jalan.
      const target = prevFocus;
      prevFocus = null;
      if (target && target.isConnected) nextTick(() => target.focus());
    }
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <v-dialog :model-value="modelValue" :max-width="maxWidth" persistent>
    <v-card ref="cardRef" tabindex="0" rounded="false" class="cd-card">
      <div class="cd-title" :class="{ 'cd-title-danger': tone === 'danger' }">
        <MsIcon v-if="icon" :name="icon" :size="16" class="cd-title-icon" />
        <span class="cd-title-text">{{ title }}</span>
        <button
          type="button"
          class="cd-close"
          :title="cancelLabel + ' (Esc)'"
          aria-label="Tutup"
          @click="close"
        >
          <MsIcon name="close" :size="16" />
        </button>
      </div>

      <div class="cd-body">
        <div v-if="subjectLabel || subjectValue" class="cd-fact">
          <span class="cd-fact-lbl">{{ subjectLabel }}</span>
          <span class="cd-fact-val">{{ subjectValue }}</span>
        </div>
        <p v-if="message" class="cd-message">{{ message }}</p>
        <p v-if="question" class="cd-question">{{ question }}</p>
        <slot />
      </div>

      <div class="cd-foot">
        <span class="cd-hint"><kbd>Esc</kbd> {{ hint }}</span>
        <v-btn size="small" variant="text" :disabled="busy" @click="close">
          {{ cancelLabel }}
        </v-btn>
        <v-btn
          size="small"
          :color="tone === 'danger' ? 'error' : 'primary'"
          variant="flat"
          :loading="busy"
          :disabled="busy"
          @click="confirm"
        >
          {{ confirmLabel }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.cd-card {
  outline: none;
}
.cd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  background: var(--ds-primary, #D97706);
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
}
/* Merah hanya untuk aksi merusak, supaya warna tetap punya arti. */
.cd-title-danger {
  background: var(--ds-error, #DC2626);
}
.cd-title-icon {
  flex: 0 0 auto;
}
.cd-title-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
.cd-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 0;
  color: #FFFFFF;
  cursor: pointer;
}
.cd-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Outline Steel Blue tak akan terlihat di atas bar biru. */
.cd-close:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}
.cd-body {
  padding: 14px;
}
.cd-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
}
.cd-fact-lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
}
.cd-fact-val {
  font-family: monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-text, #78350F);
  text-align: right;
  overflow-wrap: anywhere;
}
.cd-message {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text-secondary, #5A6A7E);
}
.cd-question {
  margin: 6px 0 0;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--ds-text, #78350F);
}
.cd-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  background: var(--ds-surface, #F0F3F8);
}
.cd-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.cd-hint kbd {
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: var(--ds-primary-darker, #78350F);
  background: #FFFFFF;
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-bottom-width: 2px;
  border-radius: 2px;
  padding: 1px 4px;
}
</style>
