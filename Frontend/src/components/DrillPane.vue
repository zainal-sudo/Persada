<script setup lang="ts">
import MsIcon from "@/components/MsIcon.vue";

defineProps<{
  icon?: string;
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="drill-pane">
    <div class="drill-header">
      <div class="drill-header-left">
        <MsIcon v-if="icon" :name="icon" :size="14" class="drill-header-icon" />
        <span class="drill-header-title">{{ title }}</span>
      </div>
      <span v-if="subtitle" class="drill-header-sub">{{ subtitle }}</span>
    </div>
    <div class="drill-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.drill-pane {
  border: 1px solid var(--ds-border, #A0AAB8);
  margin: 8px 0;
}
.drill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--ds-primary-darker, #0c4a6e);
  color: #fff;
}
.drill-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}
.drill-header-icon {
  color: var(--ds-primary-light, #0ea5e9);
  flex-shrink: 0;
}
.drill-header-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drill-header-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  flex-shrink: 0;
}
.drill-body {
  background: var(--ds-surface, #F0F3F8);
  padding: 8px;
}
</style>