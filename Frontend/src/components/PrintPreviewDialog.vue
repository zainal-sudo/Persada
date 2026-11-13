<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from "vue";
import { IconPrinter, IconX } from "@tabler/icons-vue";

const PAGE_SIZE = 66;

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  lines: string[];
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: boolean];
  print: [pages: number[]];
}>();

const onClose = () => {
  emit("update:modelValue", false);
};

let prevFocus: HTMLElement | null = null;

const restoreFocus = () => {
  if (prevFocus && prevFocus.isConnected) {
    prevFocus.focus();
  }
  prevFocus = null;
};

const previewText = computed(() => props.lines.join("\n"));
const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.lines.length / PAGE_SIZE)),
);

// Kirim seluruh rentang halaman → pemakai (onPrintFromPreview) masuk cabang
// printRaw = 1 job kontinu. Signature emit tetap buat kompat pemakai.
const onPrint = () => {
  emit("print", Array.from({ length: pageCount.value }, (_, i) => i + 1));
};

// ── Esc tutup ──
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    onClose();
  }
};

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      prevFocus = document.activeElement as HTMLElement | null;
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
      // Kembalikan fokus ke grid agar navigasi ↑↓ tetap jalan setelah dialog tutup.
      nextTick(restoreFocus);
    }
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="onClose"
    max-width="1000"
    persistent
  >
    <v-card rounded="false" class="pp-card">
      <!-- Header -->
      <div class="pp-title">
        <IconPrinter :size="15" :stroke-width="1.8" />
        <span>{{ title || "Preview Cetakan" }}</span>
        <span class="pp-chip">{{ lines.length }} baris</span>
        <v-spacer />
        <button class="pp-close" type="button" @click="onClose" title="Tutup (Esc)">
          <IconX :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="pp-body">
        <div v-if="isLoading" class="pp-loading">
          <v-progress-circular indeterminate color="primary" size="26" />
          <span class="pp-loading-txt">Memuat data cetak...</span>
        </div>
        <div v-else class="pp-sheet">
          <pre class="pp-content">{{ previewText }}</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="pp-foot">
        <v-spacer />
        <v-btn variant="text" size="small" @click="onClose">Batal</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="isLoading"
          @click="onPrint"
        >
          <template #prepend>
            <IconPrinter :size="15" />
          </template>
          Cetak
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pp-card {
  overflow: hidden;
}
.pp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ds-primary, #0284c7);
  color: white;
  font-size: 12.5px;
  font-weight: 700;
  padding: 8px 8px 8px 14px;
}
.pp-chip {
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  padding: 1px 8px;
}
.pp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: white;
  border-radius: 3px;
  cursor: pointer;
}
.pp-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.pp-body {
  padding: 12px 16px;
  background: var(--ds-surface, #F0F3F8);
}
.pp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
}
.pp-loading-txt {
  font-size: 12px;
  color: var(--ds-text-secondary, #5A6A7E);
}

.pp-sheet {
  max-height: 64vh;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--ds-border-light, #C4CAD3);
  box-shadow: 0 2px 10px rgba(27, 45, 74, 0.1);
  padding: 0 22px;
}
.pp-content {
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
  line-height: 1.3;
  white-space: pre;
  margin: 0;
  padding: 14px 0;
  tab-size: 8;
}

.pp-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--ds-surface-raised, #FFFFFF);
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
}
</style>