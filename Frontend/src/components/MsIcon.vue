<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    size?: number | string;
    fill?: boolean | number;
    weight?: number;
  }>(),
  {
    size: 16,
    fill: 0,
    weight: 400,
  },
);
</script>

<template>
  <span
    class="material-symbols-outlined ms-icon"
    :style="{
      fontSize: typeof size === 'number' ? size + 'px' : size,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
    }"
    >{{ name }}</span
  >
</template>

<style scoped>
.ms-icon {
  font-family: "Material Symbols Outlined";
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  user-select: none;
  flex-shrink: 0;
}
</style>
