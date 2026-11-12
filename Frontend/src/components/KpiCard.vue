<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    subLeft?: string;
    subRight?: string;
    title?: string;
  }>(),
  { subLeft: "", subRight: "", title: "" },
);
</script>

<template>
  <div class="kpi-card" :title="title">
    <div class="kpi-head">
      <span class="kpi-label">{{ label }}</span>
      <span v-if="subRight" class="kpi-tag">{{ subRight }}</span>
    </div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="subLeft" class="kpi-sub">
      <span>{{ subLeft }}</span>
    </div>
  </div>
</template>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border-light, #C4CAD3);
  padding: 6px 8px;
  min-width: 0;
  overflow: hidden;
}
.kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
}
.kpi-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi-tag {
  font-size: 9px;
  color: var(--ds-text-muted, #8494A7);
  white-space: nowrap;
}
.kpi-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--ds-primary-darker, #78350F);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi-sub {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  padding-top: 2px;
  margin-top: 2px;
  font-size: 9px;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>