<script setup lang="ts">
import { computed } from "vue";

interface Props {
  title: string;
  menuId?: string;
  icon?: any;
  loading?: boolean;
  desktopMode?: boolean;
  maxWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  icon: "description",
  loading: false,
  desktopMode: true,
  maxWidth: "100%",
});

const emit = defineEmits<{ "update:loading": [value: boolean] }>();

const containerClass = computed(() => ({
  "page-container": true,
  "desktop-mode": props.desktopMode,
  "modern-mode": !props.desktopMode,
}));

const loadingModel = computed({
  get: () => props.loading,
  set: (v: boolean) => emit("update:loading", v),
});
</script>

<template>
  <div :class="containerClass" :style="{ maxWidth: maxWidth }">
    <!-- Actions strip (sejajar ff-bar, tanpa judul bar) -->
    <div v-if="$slots['header-actions']" class="page-actions-strip">
      <slot name="header-actions" />
    </div>

    <!-- Breadcrumb / sub-header strip (Stitch) -->
    <div v-if="$slots['breadcrumb']" class="ds-crumb">
      <slot name="breadcrumb" />
    </div>

    <!-- ── Content area ── -->
    <div class="content-area">
      <v-overlay
        v-model="loadingModel"
        contained
        persistent
        class="d-flex align-center justify-center"
      >
        <v-progress-circular indeterminate color="primary" />
      </v-overlay>

      <div class="content-wrapper">
        <slot />
      </div>

      <div v-if="$slots.footer" class="content-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
}
.desktop-mode {
  height: 100%;
  padding: 8px 12px;
  gap: 6px;
}
.modern-mode {
  padding: 20px 24px;
  gap: 16px;
  min-height: calc(100vh - 52px);
}

/* ── Actions strip (tanpa judul bar) ── */
.page-actions-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 2px 4px;
  background: var(--ds-surface-window, #E8ECF1);
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-radius: 0;
  flex-wrap: wrap;
  row-gap: 4px;
}

/* ── Content area ── */
.content-area {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  overflow: hidden;
  border-top: 2.5px solid var(--ds-primary, #D97706);
  box-shadow: none;
}
.content-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--wrapper-padding, 16px);
  overflow: hidden;
}
.desktop-mode .content-wrapper {
  --wrapper-padding: 0;
}
.content-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* ── Responsif PageLayout ── */
@media (max-width: 1280px) {
  .desktop-mode {
    padding: 6px 10px;
    gap: 5px;
  }
  .page-actions-strip {
    padding: 2px 4px;
    gap: 4px;
  }
}

@media (max-width: 1024px) {
  .desktop-mode {
    height: 100%;
    padding: 5px 8px;
    gap: 4px;
  }
  .page-actions-strip {
    gap: 4px;
  }
  /* Tombol header lebih kecil */
  .page-actions-strip :deep(.v-btn) {
    font-size: 11px !important;
  }
  .page-actions-strip :deep(.v-btn .v-btn__content) {
    gap: 2px !important;
  }
}

@media (max-width: 768px) {
  .desktop-mode {
    height: 100%;
    padding: 4px 6px;
    gap: 3px;
  }
  .modern-mode {
    padding: 12px;
    gap: 10px;
  }
  .page-actions-strip {
    padding: 2px 4px;
    gap: 3px;
  }
  /* Sembunyikan teks tombol Tutup di mobile, sisakan ikon */
  .page-actions-strip :deep(.v-btn--variant-text span:not(.v-icon)) {
    display: none;
  }
}
</style>
