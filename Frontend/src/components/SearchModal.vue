<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import {
  IconSearch,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-vue";

export interface SearchColumn {
  key: string;
  title: string;
  width?: string;
  align?: "left" | "center" | "right";
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    columns: SearchColumn[];
    items: any[];
    loading?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    searchKeys?: string[]; // kolom yang ikut disearch, default semua
    serverSearch?: boolean; // true = search dikirim ke parent via @search
    itemsPerPage?: number;
  }>(),
  {
    loading: false,
    searchable: true,
    searchPlaceholder: "Cari...",
    searchKeys: () => [],
    serverSearch: false,
    itemsPerPage: 50,
  },
);

const emit = defineEmits<{
  "update:modelValue": [val: boolean];
  select: [item: any];
  search: [query: string]; // hanya emit kalau serverSearch=true
}>();

const searchQuery = ref("");
const currentPage = ref(1);

const filteredItems = computed(() => {
  if (props.serverSearch || !searchQuery.value) return props.items;
  const q = searchQuery.value.toLowerCase();
  const keys = props.searchKeys.length
    ? props.searchKeys
    : props.columns.map((c) => c.key);
  return props.items.filter((item) =>
    keys.some((k) =>
      String(item[k] ?? "")
        .toLowerCase()
        .includes(q),
    ),
  );
});

// Hitung total halaman
const totalPages = computed(() => {
  return Math.ceil(filteredItems.value.length / props.itemsPerPage) || 1;
});

// Potong data sesuai halaman aktif
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * props.itemsPerPage;
  const end = start + props.itemsPerPage;
  return filteredItems.value.slice(start, end);
});

// Reset halaman ketika pencarian berubah
watch(searchQuery, () => {
  currentPage.value = 1;
});

// Reset halaman & pencarian ketika modal dibuka
watch(
  () => props.modelValue,
  (val) => {
    // Buka-tutup cepat: buang timer yang masih tertunda supaya tidak
    // menembak request dengan kata kunci lama setelah dialog dibuka lagi.
    clearTimeout(searchTimer);
    if (val) {
      searchQuery.value = "";
      currentPage.value = 1;
    }
  },
);

// Server-search: request ditunda 250ms. Tanpa ini satu kata kunci = satu
// request per huruf, dan request lama bisa tiba setelah request baru sehingga
// daftar sempat menampilkan hasil kata kunci sebelumnya.
const SEARCH_DEBOUNCE_MS = 250;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const onSearchInput = () => {
  if (!props.serverSearch) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => emit("search", searchQuery.value), SEARCH_DEBOUNCE_MS);
};

// Dialog ditutup / dilepas → jangan ada request yang menggantung.
const cancelPendingSearch = () => clearTimeout(searchTimer);

onUnmounted(cancelPendingSearch);

const close = () => {
  clearTimeout(searchTimer);
  searchQuery.value = "";
  emit("update:modelValue", false);
};

const select = (item: any) => {
  emit("select", item);
  searchQuery.value = "";
};

// ── Keyboard navigation (↑↓ pilih, Enter konfirmasi) ────────────────
const rowRefs = ref<HTMLElement[]>([]);
const highlightIndex = ref(-1);

const resetHighlight = () => {
  highlightIndex.value = -1;
};

watch(
  [paginatedItems, () => props.modelValue],
  () => resetHighlight(),
);

const setHighlight = (idx: number) => {
  highlightIndex.value = idx;
  nextTick(() => {
    const el = rowRefs.value[idx];
    el?.scrollIntoView({ block: "nearest" });
  });
};

const onRowKeydown = (e: KeyboardEvent) => {
  const total = paginatedItems.value.length;
  if (total === 0) return;
  if (e.key === "ArrowDown" || e.key === "Down") {
    e.preventDefault();
    setHighlight((highlightIndex.value + 1) % total);
  } else if (e.key === "ArrowUp" || e.key === "Up") {
    e.preventDefault();
    setHighlight((highlightIndex.value - 1 + total) % total);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const item = paginatedItems.value[highlightIndex.value];
    if (item) select(item);
  }
};

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};

const formatValue = (val: any) => {
  if (typeof val === "number") {
    return new Intl.NumberFormat("id-ID").format(val);
  }
  return val ?? "";
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="close"
    max-width="850"
    scrollable
  >
    <v-card rounded="false" class="search-modal-card" @keydown="onRowKeydown">
      <!-- Header: bar solid Steel Blue, mengikuti dialog cetak
           (PrintPreviewDialog / CetakPickerDialog). -->
      <div class="sm-header">
        <IconSearch :size="15" :stroke-width="1.8" class="sm-header-icon" />
        <span class="sm-header-title">{{ title }}</span>
        <button
          type="button"
          class="sm-close-btn"
          title="Tutup (Esc)"
          aria-label="Tutup"
          @click="close"
        >
          <IconX :size="16" />
        </button>
      </div>

      <!-- Search input -->
      <div v-if="searchable" class="sm-search-bar">
        <div class="sm-search-wrap">
          <IconSearch :size="13" :stroke-width="1.8" class="sm-search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="sm-search-input"
            @input="onSearchInput"
            autofocus
          />
        </div>
      </div>

      <!-- Table -->
      <v-card-text class="sm-body">
        <div class="sm-table-wrap">
        <table class="sm-table">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                :style="{ width: col.width, textAlign: col.align || 'left' }"
              >
                {{ col.title }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading state: tampil di dalam tabel, bukan mengganti tabel -->
            <tr v-if="loading">
              <td :colspan="columns.length" class="sm-empty">
                <div class="d-flex align-center justify-center gap-2">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="16"
                    width="2"
                  />
                  <span>Memuat data...</span>
                </div>
              </td>
            </tr>
            <tr
              v-else
              v-for="(item, idx) in paginatedItems"
              :key="idx"
              class="sm-row"
              :class="{ 'sm-row-highlight': highlightIndex === idx }"
              :ref="(el: any) => (rowRefs[idx] = el as HTMLElement)"
              @click="select(item)"
              @mouseenter="highlightIndex = idx"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                :style="{ textAlign: col.align || 'left' }"
              >
                <slot
                  :name="`cell.${col.key}`"
                  :item="item"
                  :value="item[col.key]"
                >
                  {{ formatValue(item[col.key]) }}
                </slot>
              </td>
            </tr>
            <tr v-if="!loading && !paginatedItems.length">
              <td :colspan="columns.length" class="sm-empty">
                Tidak ada data{{
                  searchQuery ? ` untuk "${searchQuery}"` : ""
                }}.
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </v-card-text>

      <!-- Footer: kiri petunjuk Esc, kanan info jumlah data + tutup. -->
      <div class="sm-footer">
        <div class="sm-hints">
          <kbd>Esc</kbd> tutup
        </div>

        <div class="sm-footer-right">
          <span class="sm-count" v-if="loading">Memuat...</span>
          <span class="sm-count" v-else-if="filteredItems.length > 0">
            {{ (currentPage - 1) * itemsPerPage + 1 }} -
            {{ Math.min(currentPage * itemsPerPage, filteredItems.length) }}
            dari {{ filteredItems.length }}
          </span>
          <span class="sm-count" v-else>0 data</span>

          <div class="sm-pagination" v-if="totalPages > 1">
            <button
              type="button"
              class="page-btn"
              :disabled="currentPage === 1"
              title="Halaman sebelumnya"
              aria-label="Halaman sebelumnya"
              @click="prevPage"
            >
              <IconChevronLeft :size="16" />
            </button>
            <span class="page-info"
              >Hal {{ currentPage }} / {{ totalPages }}</span
            >
            <button
              type="button"
              class="page-btn"
              :disabled="currentPage === totalPages"
              title="Halaman berikutnya"
              aria-label="Halaman berikutnya"
              @click="nextPage"
            >
              <IconChevronRight :size="16" />
            </button>
          </div>

          <v-btn size="small" variant="text" @click="close">Tutup</v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.search-modal-card {
  overflow: hidden;
}

/* Header: bar solid Steel Blue, sama seperti dialog cetak. Header putih
   dengan garis tipis di atas kartu membuat lookup terlihat beda modul. */
.sm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  background: var(--ds-primary, #0284c7);
  color: #FFFFFF;
  flex-shrink: 0;
}
.sm-header-icon {
  color: #FFFFFF;
  flex-shrink: 0;
}
.sm-header-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #FFFFFF;
  flex: 1;
}
.sm-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  color: #FFFFFF;
}
.sm-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Fokus di atas bar biru tidak boleh pakai outline Steel Blue: tak terlihat. */
.sm-close-btn:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}

/* Search bar: tinggi 28px + border --ds-border, sama dengan kolom cari di
   dialog Tambah Detail (.tb-search-input) supaya tidak ada dua rupa kolom
   cari di satu modul yang sama. */
.sm-search-bar {
  padding: 10px 12px 8px;
  background: transparent;
  flex-shrink: 0;
}
.sm-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 8px;
  height: 28px;
  background: rgb(var(--v-theme-surface));
}
.sm-search-wrap:focus-within {
  border-color: var(--ds-primary, #0284c7);
}
.sm-search-icon {
  color: var(--ds-text-secondary, #5A6A7E);
  flex-shrink: 0;
}
.sm-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface));
}

/* Body: scroll dipindah ke pembungkus tabel supaya border membingkai area
   gulir (pola .tb-table-wrap di dialog Tambah Detail), bukan ikut tergulir. */
.sm-body {
  padding: 0 12px 10px;
}
.sm-table-wrap {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--ds-border-light, #C4CAD3);
}
.sm-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  font-size: 12px;
  color: var(--ds-text-secondary, #5A6A7E);
  justify-content: center;
}

/* Table: densitas mengikuti .modal-tbl pada dialog Tambah Detail. */
.sm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.sm-table thead tr {
  background: var(--ds-primary, #0284c7);
  position: sticky;
  top: 0;
  z-index: 1;
}
.sm-table th {
  color: white;
  font-weight: 700;
  font-size: 11px;
  padding: 5px 8px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.sm-table td {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgb(var(--v-theme-on-surface));
  vertical-align: middle;
  white-space: nowrap;
}
.sm-row {
  cursor: pointer;
}
.sm-row:hover td {
  background: rgba(59, 89, 152, 0.07);
}
.sm-row:active td {
  background: rgba(59, 89, 152, 0.14);
}
.sm-row-highlight td {
  background: var(--ds-primary-50, #E8EDF5) !important;
  box-shadow: inset 2px 0 0 var(--ds-primary, #0284c7);
}

/* Zebra */
.sm-table tbody tr:nth-of-type(even) td {
  background: rgba(var(--v-theme-on-surface), 0.015);
}
.sm-table tbody tr:nth-of-type(even):hover td {
  background: rgba(59, 89, 152, 0.07);
}

.sm-empty {
  text-align: center;
  padding: 18px 12px;
  color: var(--ds-text-secondary, #5A6A7E);
  font-size: 11px;
}

/* Footer: kiri petunjuk Esc saja. ↑/↓ dan Enter tidak ditulis karena
   gendarnya sudah kelihatan dari baris yang tersorot, sedangkan Esc tidak
   punya petunjuk visual apa pun. Kanan: info jumlah data, paginasi, tutup. */
.sm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  background: var(--ds-surface, #F0F3F8);
  flex-shrink: 0;
}
.sm-hints {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.sm-hints kbd {
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: var(--ds-primary-darker, #0c4a6e);
  background: #FFFFFF;
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-bottom-width: 2px;
  border-radius: 2px;
  padding: 1px 4px;
}
.sm-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sm-count {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
}

/* Pagination di Footer */
.sm-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 2px;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
}
.page-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.page-info {
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text, #0c4a6e);
  padding: 0 4px;
}
</style>
