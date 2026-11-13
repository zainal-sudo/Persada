<script setup lang="ts">
/**
 * Dialog form tambah/edit untuk semua menu master.
 *
 * Tampilan mengikuti CostCenterView yang lama (patokan owner), bukan density
 * form utama: bar judul 13px, body 20x24, input 30px, tombol Batal/Simpan
 * polos. Dulu tiap view punya versinya sendiri dengan ukuran berbeda; sekarang
 * satu komponen, satu tampilan.
 *
 * Field di dalam slot memakai kelas global .fd-row / .fd-label / .fd-input
 * (lihat design-system.css, blok FORM DIALOG). Kelas global itu wajib, bukan
 * scoped: isi slot milik view pemanggil dan scoped CSS komponen tidak
 * menjangkau isi slot.
 */
import { computed, type Component } from "vue";
import MsIcon from "@/components/MsIcon.vue";
import { useEscClose } from "@/composables/useEscClose";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    /** Ikon tabler untuk bar judul. */
    icon?: Component;
    /** Spinner di body, untuk dialog yang memuat data saat dibuka. */
    loading?: boolean;
    saving?: boolean;
    saveLabel?: string;
    maxWidth?: number | string;
  }>(),
  { saveLabel: "Simpan", maxWidth: 520 },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "save"): void;
  (e: "cancel"): void;
}>();

const open = computed(() => props.modelValue);

const close = () => {
  emit("update:modelValue", false);
  emit("cancel");
};

useEscClose(open, close);
</script>

<template>
  <v-dialog :model-value="modelValue" :max-width="maxWidth" persistent>
    <v-card tabindex="0" rounded="false" class="fd-card">
      <div class="fd-title">
        <component
          :is="icon"
          v-if="icon"
          :size="18"
          :stroke-width="1.8"
          class="fd-title-icon"
        />
        <span class="fd-title-text">{{ title }}</span>
        <button
          type="button"
          class="fd-close"
          title="Batal (Esc)"
          aria-label="Batal"
          @click="close"
        >
          <MsIcon name="close" :size="16" />
        </button>
      </div>

      <div class="fd-body">
        <div v-if="loading" class="fd-loading">
          <v-progress-circular indeterminate color="primary" size="26" width="2" />
        </div>
        <div v-else class="fd-fields">
          <slot />
        </div>
      </div>

      <div class="fd-foot">
        <span class="fd-hint"><kbd>Esc</kbd> batal</span>
        <button type="button" class="fd-cancel" :disabled="saving" @click="close">
          Batal
        </button>
        <button
          type="button"
          class="fd-save"
          :disabled="saving || loading"
          @click="emit('save')"
        >
          <span v-if="saving" class="fd-spinner" />
          {{ saving ? "Menyimpan..." : saveLabel }}
        </button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* v-card memakai --v-theme-surface; CostCenter lama memakai white eksplisit. */
.fd-card {
  background: #ffffff;
  border-radius: 0;
  outline: none;
  overflow: hidden;
}

.fd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--ds-primary, #0284c7);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}
/* Ikon Material Symbol juga elemen span, jadi pakai kelas eksplisit:
   "> span" akan ikut meregangkan ikon dan tampak tidak sejajar. */
.fd-title-icon {
  flex: 0 0 auto;
}
.fd-title-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
.fd-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 0;
  color: #ffffff;
  cursor: pointer;
}
.fd-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Outline Steel Blue tidak akan terlihat di atas bar biru. */
.fd-close:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.fd-body {
  padding: 20px 24px;
}
.fd-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fd-loading {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.fd-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--ds-border-light, #dde1e6);
  background: var(--ds-surface, #F0F3F8);
}
.fd-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.fd-hint kbd {
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: var(--ds-primary-darker, #0c4a6e);
  background: #ffffff;
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-bottom-width: 2px;
  border-radius: 2px;
  padding: 1px 4px;
}

.fd-cancel {
  height: 30px;
  padding: 0 16px;
  background: #ffffff;
  color: var(--ds-text-secondary, #5A6A7E);
  border: 1px solid var(--ds-border-light, #dde1e6);
  border-radius: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.fd-cancel:hover:not(:disabled) {
  background: #f5f5f5;
}

.fd-save {
  height: 30px;
  padding: 0 16px;
  background: var(--ds-primary, #0284c7);
  color: #ffffff;
  border: none;
  border-radius: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fd-save:hover:not(:disabled) {
  background: #2d4a80;
}
.fd-cancel:disabled,
.fd-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
