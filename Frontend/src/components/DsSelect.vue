<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

// class/style dari pemakai diteruskan ke tombol field (mis. class="w-sls"),
// pola sama seperti DsDatePicker.
defineOptions({ inheritAttrs: false });

type Option = string | number | { value: string | number; label: string };

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    options?: Option[];
    disabled?: boolean;
    /** toolbar = filter 130px; form = melebar seperti .f-inp; cell = sel grid detail */
    variant?: "toolbar" | "form" | "cell";
    placeholder?: string;
  }>(),
  {
    modelValue: "",
    options: () => [],
    disabled: false,
    variant: "form",
    placeholder: "",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string | number): void;
  (e: "change", v: string | number): void;
}>();

const norm = computed(() =>
  props.options.map((o) =>
    typeof o === "object" && o !== null ? o : { value: o, label: String(o) },
  ),
);

const selected = computed(() => norm.value.find((o) => o.value === props.modelValue));
const display = computed(
  () => selected.value?.label ?? (props.modelValue ? String(props.modelValue) : ""),
);

const menu = ref(false);
const query = ref("");
const activeIdx = ref(0);
const fieldEl = ref<HTMLButtonElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLUListElement | null>(null);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return norm.value;
  return norm.value.filter((o) => o.label.toLowerCase().includes(q));
});

watch(menu, async (open) => {
  if (!open) return;
  query.value = "";
  const i = filtered.value.findIndex((o) => o.value === props.modelValue);
  activeIdx.value = i < 0 ? 0 : i;
  await nextTick();
  searchEl.value?.focus();
});

watch(activeIdx, async () => {
  await nextTick();
  listEl.value?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
});

watch(query, () => {
  activeIdx.value = 0;
});

function select(o: { value: string | number; label: string }) {
  if (o.value !== props.modelValue) {
    emit("update:modelValue", o.value);
    emit("change", o.value);
  }
  menu.value = false;
}

function onSearchKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx.value = Math.max(activeIdx.value - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const o = filtered.value[activeIdx.value];
    if (o) select(o);
  } else if (e.key === "Escape") {
    e.preventDefault();
    menu.value = false;
    fieldEl.value?.focus();
  }
}

defineExpose({ focus: () => fieldEl.value?.focus() });

const cls = computed(() => ["ds-select", `ds-select--${props.variant}`]);
</script>

<template>
  <div :class="cls">
    <VMenu
      v-model="menu"
      :activator="fieldEl ?? undefined"
      :close-on-content-click="false"
      location="bottom start"
      origin="top start"
      :disabled="disabled"
      :z-index="10001"
      content-class="ds-select__menu"
    >
      <div class="ds-select__panel">
        <input
          ref="searchEl"
          v-model="query"
          class="ds-select__search"
          placeholder="Cari..."
          autocomplete="off"
          @keydown="onSearchKey"
        />
        <ul ref="listEl" class="ds-select__list" role="listbox">
          <li
            v-for="(o, i) in filtered"
            :key="`${o.value}-${i}`"
            role="option"
            :aria-selected="o.value === modelValue"
            :class="[
              'ds-select__opt',
              { 'is-active': i === activeIdx, 'is-selected': o.value === modelValue },
            ]"
            @mousemove="activeIdx = i"
            @mousedown.prevent
            @click="select(o)"
          >
            {{ o.label }}
          </li>
          <li v-if="!filtered.length" class="ds-select__empty">Tidak ada data.</li>
        </ul>
      </div>
    </VMenu>
    <button
      ref="fieldEl"
      v-bind="$attrs"
      type="button"
      class="ds-select__field"
      :disabled="disabled"
      :aria-expanded="menu"
      @keydown.down.prevent="menu = true"
    >
      <span class="ds-select__label" :class="{ 'is-placeholder': !display }">
        {{ display || placeholder }}
      </span>
      <span class="ds-select__caret" aria-hidden="true"></span>
    </button>
  </div>
</template>

<style scoped>
.ds-select {
  display: inline-flex;
}

/* Resep sunken yang sama dengan input design-system: border abu, sisi atas/kiri
   lebih gelap supaya terlihat masuk ke dalam. Sudut tajam, tanpa bayangan. */
.ds-select__field {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  background: #fff;
  color: #000000;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top-color: var(--ds-border-inset-edge, #7E8B9B);
  border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  border-radius: 0;
}
.ds-select__field:focus {
  border-color: var(--ds-primary, #0284c7);
}
.ds-select__field:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  cursor: not-allowed;
}
.ds-select__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-select__label.is-placeholder {
  color: var(--ds-text-secondary, #5A6A7E);
}
/* Caret menandai bahwa kontrol membuka daftar pilihan (affordance, bukan hiasan). */
.ds-select__caret {
  flex: none;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--ds-text-secondary, #5A6A7E);
}

.ds-select--toolbar {
  min-width: 130px;
}
.ds-select--toolbar .ds-select__field {
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
}

.ds-select--form {
  flex: 1 1 auto;
  min-width: 120px;
  max-width: 400px;
}
.ds-select--form .ds-select__field {
  height: 22px;
  padding: 1px 6px;
  font-size: 11px;
}

.ds-select--cell {
  flex: 1 1 auto;
  width: 100%;
}
.ds-select--cell .ds-select__field {
  height: 20px;
  padding: 0 3px;
  font-size: 11px;
}
</style>

<!-- Panel ter-teleport ke body, jadi butuh style non-scoped. -->
<style>
/* Tanpa radius, tanpa bayangan: kedalaman lewat border (design system). */
.ds-select__menu .ds-select__panel {
  min-width: 160px;
  background: #fff;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
}
.ds-select__menu .ds-select__search {
  display: block;
  width: 100%;
  box-sizing: border-box;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  border: 0;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  border-radius: 0;
}
.ds-select__menu .ds-select__search:focus {
  border-bottom-color: var(--ds-primary, #0284c7);
}
.ds-select__menu .ds-select__search::placeholder {
  color: var(--ds-text-secondary, #5A6A7E);
}
.ds-select__menu .ds-select__list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
}
.ds-select__menu .ds-select__opt {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--ds-text, #0c4a6e);
  cursor: pointer;
  white-space: nowrap;
}
.ds-select__menu .ds-select__opt.is-active {
  background: var(--ds-surface-inset, #E8ECF1);
}
.ds-select__menu .ds-select__opt.is-selected {
  color: var(--ds-primary, #0284c7);
  font-weight: 700;
}
.ds-select__menu .ds-select__empty {
  padding: 6px 8px;
  font-size: 11px;
  font-style: italic;
  color: var(--ds-text-muted, #8494A7);
}
</style>
