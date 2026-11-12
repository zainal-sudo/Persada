<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import { IconPrinter } from "@tabler/icons-vue";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  options: { label: string; hint?: string; value: any }[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "select", value: any): void;
}>();

const active = ref(0);
const cardRef = ref<HTMLElement | null>(null);
let prevFocus: HTMLElement | null = null;

const restoreFocus = () => {
  if (prevFocus && prevFocus.isConnected) {
    prevFocus.focus();
  }
  prevFocus = null;
};

const choose = (value: any) => {
  emit("update:modelValue", false);
  emit("select", value);
};

const onKeydown = (e: KeyboardEvent) => {
  const n = props.options.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    active.value = (active.value + 1) % n;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    active.value = (active.value - 1 + n) % n;
  } else if (e.key === "Enter") {
    e.preventDefault();
    choose(props.options[active.value].value);
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("update:modelValue", false);
  }
};

// Keyboard aktif selama dialog terbuka via listener window (fokus Vuetify
// focus-trap tak selalu di card, jadi tak andalkan @keydown di card saja).
watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      prevFocus = document.activeElement as HTMLElement | null;
      active.value = 0;
      nextTick(() => cardRef.value?.focus());
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
  <v-dialog :model-value="modelValue" max-width="360" persistent>
    <v-card
      ref="cardRef"
      tabindex="0"
      rounded="false"
      class="cp-card"
    >
      <div class="cp-title">
        <IconPrinter :size="15" :stroke-width="1.8" />
        <span>{{ title || "Pilih Jenis Cetak" }}</span>
      </div>
      <div class="cp-body">
        <button
          v-for="(opt, i) in options"
          :key="String(opt.value)"
          type="button"
          class="cp-opt"
          :class="{ active: i === active }"
          @mouseenter="active = i"
          @click="choose(opt.value)"
        >
          <span class="cp-label">{{ opt.label }}</span>
          <span v-if="opt.hint" class="cp-hint">{{ opt.hint }}</span>
        </button>
      </div>
      <div class="cp-foot">
        <kbd>↑/↓</kbd> pilih
        <span class="cp-sep">·</span>
        <kbd>Enter</kbd> jalankan
        <span class="cp-sep">·</span>
        <kbd>Esc</kbd> tutup
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.cp-card {
  outline: none;
}
.cp-title {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--ds-primary, #D97706);
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 14px;
}
.cp-body {
  padding: 6px;
}
.cp-opt {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border: none;
  border-left: 3px solid transparent;
  background: transparent;
  cursor: pointer;
  font: inherit;
  box-sizing: border-box;
}
.cp-opt.active {
  background: var(--ds-primary-50, #E8EDF5);
  border-left-color: var(--ds-primary, #D97706);
}
.cp-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ds-text, #78350F);
}
.cp-hint {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
}
.cp-foot {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: var(--ds-surface, #F0F3F8);
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.cp-foot kbd {
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: var(--ds-primary-darker, #78350F);
  background: white;
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-bottom-width: 2px;
  border-radius: 2px;
  padding: 1px 4px;
}
.cp-sep {
  color: var(--ds-text-muted, #8494A7);
}
</style>