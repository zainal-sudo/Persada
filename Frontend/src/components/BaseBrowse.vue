<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  watch,
  nextTick,
} from "vue";
import { useRoute } from "vue-router";
import PageLayout from "@/components/PageLayout.vue";
import MsIcon from "@/components/MsIcon.vue";
import ColumnFilter, {
  type FilterType,
  type ColumnFilterValue,
} from "@/components/ColumnFilter.vue";
import { matchColumnFilter } from "@/composables/useColumnFilter";
import {
  IconTable,
  IconX,
  IconFilterOff,
  IconChevronUp,
  IconChevronDown,
  IconFilter,
  IconAdjustmentsHorizontal,
  IconSearch,
  IconSearchOff,
  IconDatabaseOff,
  IconAlertTriangle,
} from "@tabler/icons-vue";

const props = withDefaults(
  defineProps<{
    title: string;
    menuId?: string;
    icon?: any;
    headers: any[];
    items: any[];
    isLoading?: boolean;
    searchPlaceholder?: string;
    itemValue?: string;
    canInsert?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
    showRefresh?: boolean;
    showFilterBar?: boolean;
    autoSelectFirst?: boolean;
    selectStrategy?: "single" | "page" | "all";
    rowPropsFn?: (data: any) => any;
    showExpand?: boolean;
    expanded?: any[];
    selected?: any[];
    loadingDetails?: Set<string>;
    itemsPerPage?: number;
    filterState?: Record<string, any>;
    summaryKey?: string;
    summaryLabel?: string;
    exportFn?: () => void | Promise<void>;
    printFn?: () => void | Promise<void>;
    fixedLayout?: boolean;
    filterValues?: Record<string, any>;
    autoRefresh?: boolean;
    summaryColumns?: { key: string; label?: string; numFmt?: string }[];
    footerValues?: Record<string, string>;
    footerLabel?: string;
    autoSummary?: boolean;
    excludeSummaryKeys?: string[];
    contextMenuItems?: { label: string; icon?: string; disabled?: boolean; action: (item: any) => void }[];
  }>(),
  {
    icon: () => IconTable,
    isLoading: false,
    searchPlaceholder: "Cari data...",
    itemValue: "Kode",
    canInsert: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
    showRefresh: true,
    showFilterBar: true,
    autoSelectFirst: true,
    selectStrategy: "single",
    selected: () => [],
    showExpand: false,
    expanded: () => [],
    loadingDetails: () => new Set<string>(),
    itemsPerPage: 50,
    filterState: () => ({}),
    exportFn: undefined,
    printFn: undefined,
    fixedLayout: true,
    filterValues: () => ({}),
    autoRefresh: false,
    summaryColumns: () => [],
    footerValues: () => ({}),
    footerLabel: "TOTAL",
    autoSummary: true,
    excludeSummaryKeys: () => [],
    contextMenuItems: () => [],
  },
);

const emit = defineEmits([
  "refresh",
  "add",
  "edit",
  "delete",
  "row-click",
  "update:expanded",
  "update:selected",
  "update:filterState",
]);

let autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.filterValues,
  () => {
    if (!props.autoRefresh) return;
    if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
    autoRefreshTimer = setTimeout(() => {
      emit("refresh");
    }, 300);
  },
  { deep: true },
);

const route = useRoute();

const storageKey = computed(() => `finance_browse_${route.path}`);
const loadState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey.value) || "null");
  } catch {
    return null;
  }
};
const saveState = () => {
  try {
    sessionStorage.setItem(
      storageKey.value,
      JSON.stringify({
        search: search.value,
        currentPage: currentPage.value,
        perPage: perPage.value,
        filterState: props.filterState,
      }),
    );
  } catch {
    /* storage penuh */
  }
};

const saved = loadState();
const search = ref<string>(saved?.search ?? "");
const currentPage = ref<number>(saved?.currentPage ?? 1);
const perPage = ref<number>(saved?.perPage ?? props.itemsPerPage);

// ── Hotkey global (F2/F3/F4/F5/F8) ──────────────────────────────────
// DefaultLayout dispatch "erp:hotkey" ke document. Listener hanya terpasang
// saat tab ini BENAR-BENAR tampil (activated): tab KeepAlive yang sedang
// di-deactivate listener-nya dicabut, jadi mustahil tab di belakang layar
// ikut mengeksekusi F2/F3/F4/F5/F8.
// Beberapa view menggambar tombol Export-nya sendiri di slot `extra-actions`
// (karena punya loading/disabled sendiri) alih-alih memakai prop `exportFn`.
// Tombol itu ditandai `data-fkey="export"` supaya F8 sampai ke handler yang
// sama dengan klik; tanpa ini label "[F8] Export" cuma hiasan.
const actionsRef = ref<HTMLElement | null>(null);
const clickExtraAction = (name: string) => {
  const btn = actionsRef.value?.querySelector<HTMLElement>(`[data-fkey="${name}"]`);
  btn?.click();
};

const onGlobalHotkey = (e: Event) => {
  const action = (e as CustomEvent<string>).detail;

  switch (action) {
    case "add":
      if (props.canInsert) emit("add");
      break;
    case "edit":
      if (props.canEdit && isSingleSelected.value)
        emit("edit", internalSelected.value[0]);
      break;
    case "delete":
      if (props.canDelete && isSingleSelected.value)
        requestDelete(internalSelected.value[0]);
      break;
    case "refresh":
      emit("refresh");
      break;
    case "export":
      if (props.exportFn) {
        // View menyerahkan aksinya lewat prop, jadi izin diperiksa di sini.
        if (props.canExport) props.exportFn();
      } else {
        // View menggambar sendiri tombolnya: tampil/tidaknya tombol itu sudah
        // jadi penjaga izinnya, F8 cukup meniru kliknya.
        clickExtraAction("export");
      }
      break;
    case "print":
      if (props.printFn) props.printFn();
      break;
    default:
      break;
  }
};

onMounted(() => {
  document.addEventListener("erp:hotkey", onGlobalHotkey);
});
onActivated(() => {
  document.addEventListener("erp:hotkey", onGlobalHotkey);
});
onDeactivated(() => {
  document.removeEventListener("erp:hotkey", onGlobalHotkey);
});
onUnmounted(() => {
  document.removeEventListener("erp:hotkey", onGlobalHotkey);
  document.removeEventListener("mousedown", onDocMousedownCtx);
  document.removeEventListener("keydown", onDocKeydownCtx);
  if (navRaf) {
    cancelAnimationFrame(navRaf);
    navRaf = 0;
  }
});
const deleteDialog = ref(false);
const pendingDeleteItem = ref<any>(null);

onMounted(() => {
  if (saved?.filterState && Object.keys(saved.filterState).length > 0)
    emit("update:filterState", saved.filterState);
  injectTfoot();
  document.addEventListener("mousedown", onDocMousedownCtx);
  document.addEventListener("keydown", onDocKeydownCtx);
});
watch([search, currentPage, perPage, () => props.filterState], saveState, {
  flush: "post",
  deep: true,
});

const internalSelected = computed({
  get: () => props.selected || [],
  set: (val) => emit("update:selected", val),
});
const isSingleSelected = computed(() => internalSelected.value.length === 1);

// Vuetify hanya mengenali align start/end/center; "right"/"left" tidak ada aturan CSS-nya
const normalizeAlign = (align?: string) => {
  if (align === "right") return "end";
  if (align === "left") return "start";
  return align;
};

const finalHeaders = computed(() => {
  const normalized = props.headers.map((h: any) =>
    h.align ? { ...h, align: normalizeAlign(h.align) } : h,
  );
  if (!props.showExpand) return normalized;
  return [
    { title: "", key: "data-table-expand", width: "48px", sortable: false },
    ...normalized,
  ];
});

// ── Column Filters (type-aware) ──────────────────────────────────────────
const columnFilters = ref<Record<string, ColumnFilterValue>>({});
const activeFilterCol = ref<string | null>(null);
const filterDropdownStyle = ref<Record<string, string>>({});
const colWidths = ref<Record<string, number>>({});

// Auto-detect filter type from header config or data
const resolveFilterType = (header: any): FilterType => {
  if (header.filterType) return header.filterType;
  const key = header.key || "";
  // Date patterns
  if (/^(Tanggal|JthTempo|Tanggal.*|Date|date)$/i.test(key)) return "date";
  // Number patterns (right-aligned columns or known numeric keys)
  if (header.align === "right") return "number";
  if (/^(Debet|Kredit|Stok|Total|Saldo|Nilai|Harga|Bayar|Potongan|Giro|Cash|Transfer|PPN|PPH|Mutasi|REAL_|Tambah|Kurang|Buku|Bank|Selisih|Het|HNA|Retur|Disc|Freight|CN|Kontrak|Biaya|Nominal|Avgs|TOR|Min|Disc_Salesman)$/i.test(key)) return "number";
  // Default: select (checkbox-based)
  return "select";
};

const colFilterType = (key: string): FilterType => {
  const h = props.headers.find((x: any) => x.key === key);
  return h ? resolveFilterType(h) : "select";
};

const colHasFilter = (key: string) => {
  return columnFilters.value[key] !== null && columnFilters.value[key] !== undefined;
};

const activeFilterCount = computed(
  () => Object.keys(columnFilters.value).filter((k) => colHasFilter(k)).length,
);

const openColFilter = (key: string, event: MouseEvent) => {
  if (activeFilterCol.value === key) {
    activeFilterCol.value = null;
    return;
  }
  const btn = event.currentTarget as HTMLElement;
  const th = btn.closest("th");
  if (th) {
    const thRect = th.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const POPUP_WIDTH = 190; // harus sama dengan lebar .cf-dropdown
    const MARGIN = 8;
    const viewportW = window.innerWidth;

    // Default: rata kiri dengan sel header kolom
    let left = thRect.left;
    // Kalau melebihi tepi kanan layar, balik ke kiri agar tidak terpotong
    if (left + POPUP_WIDTH + MARGIN > viewportW) {
      left = Math.min(btnRect.right, viewportW - MARGIN) - POPUP_WIDTH;
    }
    // Jaga agar tidak keluar layar di sisi kiri (layar sempit)
    left = Math.max(MARGIN, Math.min(left, viewportW - POPUP_WIDTH - MARGIN));

    filterDropdownStyle.value = {
      position: "fixed",
      top: `${thRect.bottom + 2}px`,
      left: `${left}px`,
    };
  }
  activeFilterCol.value = key;
};
const closeColFilter = () => {
  activeFilterCol.value = null;
};
const onColFilterUpdate = (key: string, val: ColumnFilterValue | null) => {
  if (val === null) {
    const newFilters = { ...columnFilters.value };
    delete newFilters[key];
    columnFilters.value = newFilters;
  } else {
    columnFilters.value = { ...columnFilters.value, [key]: val };
  }
  currentPage.value = 1;
};
const activeFilterColTitle = computed(() => {
  if (!activeFilterCol.value) return "";
  const h = props.headers.find((x: any) => x.key === activeFilterCol.value);
  return h?.title || activeFilterCol.value;
});

// ── Column Resize ────────────────────────────────────────────────────────
let resizing: { key: string; startX: number; startW: number } | null = null;
const onResizeStart = (key: string, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement;
  const currentW = th
    ? th.getBoundingClientRect().width
    : (colWidths.value[key] ?? 80);
  resizing = { key, startX: e.clientX, startW: currentW };
  const onMove = (ev: MouseEvent) => {
    if (!resizing) return;
    colWidths.value = {
      ...colWidths.value,
      [resizing.key]: Math.max(
        40,
        resizing.startW + ev.clientX - resizing.startX,
      ),
    };
  };
  const onUp = () => {
    resizing = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};
const colStyle = (col: any) => {
  const key = col.key;
  if (colWidths.value[key])
    return {
      width: `${colWidths.value[key]}px`,
      minWidth: `${colWidths.value[key]}px`,
    };
  if (col.width)
    return { width: col.width, minWidth: col.minWidth ?? col.width };
  if (col.minWidth) return { minWidth: col.minWidth };
  return {};
};

// ── Filtered & Paged items ───────────────────────────────────────────────
const filteredItems = computed(() => {
  let result = props.items;
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter((item) =>
      Object.values(item).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }
  for (const [key, filter] of Object.entries(columnFilters.value)) {
    if (!filter) continue;
    result = result.filter((item) => matchColumnFilter(item[key], filter));
  }
  return result;
});

const onTableWrapClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (
    !target.closest(".cf-dropdown") &&
    !target.closest(".col-filter-btn")
  )
    closeColFilter();
  // Fokuskan grid agar navigasi ↑↓ langsung aktif setelah klik baris
  if (!target.closest("input, select, textarea, button, a")) {
    tableWrapRef.value?.focus({ preventScroll: true });
  }
};

// ── Summary (tfoot inside table) ───────────────────────────────────
const tableWrapRef = ref<HTMLElement | null>(null);
const dataTableRef = ref<any>(null);
const summaryBarRef = ref<HTMLElement | null>(null);
const onTableScroll = () => {
  /* no-op, tfoot scrolls with table */
};
const summaryTotal = computed(() => {
  if (!props.summaryKey) return 0;
  return filteredItems.value.reduce(
    (sum, item) => sum + (Number(item[props.summaryKey!]) || 0),
    0,
  );
});
const summaryFormatted = computed(() =>
  new Intl.NumberFormat("id-ID").format(summaryTotal.value),
);

// Format nilai total sesuai numFmt (mis. "#,##0.00" = 2 desimal)
const formatSummaryValue = (total: number, numFmt?: string) => {
  let minFrac = 0;
  let maxFrac = 3;
  if (numFmt) {
    const m = numFmt.match(/\.(0+)/);
    if (m) {
      minFrac = m[1].length;
      maxFrac = m[1].length;
    }
  }
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(total);
};

// Key yang tidak pernah layak dijumlahkan (identitas, kontak, dsb)
const AUTO_SUMMARY_EXCLUDE_KEYS = /^(nomor|no|nourut|urut|id|kode|kode_cust|telp|fax|bulan|tahun|.+_id)$/i;

// Deteksi kolom numerik secara otomatis dari data terfilter
const autoSummaryColumns = computed<{ key: string; numFmt?: string }[]>(() => {
  if (!props.autoSummary) return [];
  const hasExplicitSummary =
    props.summaryColumns.length > 0 ||
    !!props.summaryKey ||
    Object.keys(props.footerValues).length > 0;
  if (hasExplicitSummary) return [];
  const excluded = new Set(props.excludeSummaryKeys ?? []);
  const rows = filteredItems.value;
  const found: { key: string }[] = [];
  for (const h of props.headers) {
    const key = h?.key;
    if (!key || key === "data-table-expand") continue;
    if (excluded.has(key) || AUTO_SUMMARY_EXCLUDE_KEYS.test(key)) continue;
    let sawValue = false;
    let allNumeric = true;
    for (const item of rows) {
      const v = item?.[key];
      if (v === null || v === undefined || v === "") continue;
      sawValue = true;
      if (!Number.isFinite(Number(v))) {
        allNumeric = false;
        break;
      }
    }
    if (sawValue && allNumeric) found.push({ key });
  }
  return found;
});

// Kolom summary efektif: eksplisit, lalu legacy summaryKey, kalau tidak pakai deteksi otomatis
const summaryColumnsEffective = computed(() => {
  if (props.summaryColumns.length > 0) return props.summaryColumns;
  if (props.summaryKey) return [{ key: props.summaryKey }];
  return autoSummaryColumns.value;
});

const summaryLabelText = computed(() => props.summaryLabel || "TOTAL");

// Hitung total untuk kolom summary (eksplisit atau otomatis)
const summaryTotals = computed(() => {
  const result: Record<string, string> = {};
  for (const col of summaryColumnsEffective.value) {
    const total = filteredItems.value.reduce(
      (sum, item) => sum + (Number(item[col.key]) || 0),
      0,
    );
    result[col.key] = formatSummaryValue(total, col.numFmt);
  }
  return result;
});
const hasSummaryRow = computed(
  () =>
    summaryColumnsEffective.value.length > 0 ||
    !!props.summaryKey ||
    Object.keys(props.footerValues).length > 0,
);

// Inject <tfoot> ke elemen <table> sebenarnya
const injectTfoot = () => {
  nextTick(() => {
    const wrapper = tableWrapRef.value?.querySelector(
      ".v-table__wrapper",
    ) as HTMLElement | null;
    if (!wrapper) return;
    const table = wrapper.querySelector("table") as HTMLTableElement | null;
    if (!table) return;

    // Hapus tfoot lama supaya tidak menumpuk
    const oldTfoot = table.querySelector("tfoot");
    if (oldTfoot) oldTfoot.remove();

    if (!hasSummaryRow.value) return;

    const tfoot = document.createElement("tfoot");
    const tr = document.createElement("tr");
    tr.className = "summary-tfoot-row";

    const useCustom = Object.keys(props.footerValues).length > 0;
    // finalHeaders = kolom yang benar-benar dirender (termasuk kolom expand)
    const colKeys = finalHeaders.value.map((h: any) => h.key);
    const totalCols = colKeys.length;

    const summaryMap: Record<string, string> = {};
    if (useCustom) {
      Object.assign(summaryMap, props.footerValues);
    } else {
      for (const col of summaryColumnsEffective.value) {
        summaryMap[col.key] = summaryTotals.value[col.key] || "0";
      }
    }

    // Label TOTAL diletakkan di kolom data pertama yang tidak punya nilai
    let labelPlaced = false;
    for (let i = 0; i < totalCols; i++) {
      const td = document.createElement("td");
      td.className = "summary-tfoot-td";
      const key = colKeys[i] || "";
      const isExpand = key === "data-table-expand";

      if (useCustom) {
        const val = summaryMap[key];
        if (val !== undefined && val !== null && val !== "") {
          td.textContent = val;
          td.classList.add("summary-tfoot-val");
          td.style.textAlign = "right";
        } else if (!isExpand && !labelPlaced) {
          td.textContent = props.footerLabel;
          td.classList.add("summary-tfoot-label");
          labelPlaced = true;
        }
      } else {
        const val = summaryMap[key];
        if (val) {
          td.textContent = val;
          td.classList.add("summary-tfoot-val");
          td.style.textAlign = "right";
        } else if (!isExpand && !labelPlaced) {
          td.textContent = summaryLabelText.value;
          td.classList.add("summary-tfoot-label");
          labelPlaced = true;
        }
      }

      tr.appendChild(td);
    }

    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  });
};

// ── Pagination ────────────────────────────────────────────────────────────
const totalItems = computed(() => filteredItems.value.length);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalItems.value / perPage.value)),
);
const pageStart = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * perPage.value + 1,
);
const pageEnd = computed(() =>
  Math.min(currentPage.value * perPage.value, totalItems.value),
);
const pagedItems = computed(() =>
  filteredItems.value.slice(
    (currentPage.value - 1) * perPage.value,
    currentPage.value * perPage.value,
  ),
);
const goToPage = (p: number) => {
  currentPage.value = Math.max(1, Math.min(p, totalPages.value));
};
const onSearch = (val: string) => {
  search.value = val;
  currentPage.value = 1;
};

// ── Row cursor (navigasi keyboard ↑↓/Enter di grid) ─────────────────
const rowCursor = ref(0);

// Navigasi tahan-arrow: rowCursor instan (garis), bagian berat (selection +
// scroll) disinkron 1× per frame, event keydown berlebih di frame sama di-drop.
let navTarget = -1;
let navRaf = 0;

const applyRowAt = (i: number) => {
  const list = pagedItems.value;
  const n = list.length;
  if (!n) return;
  const r = Math.min(i, n - 1);
  rowCursor.value = r;
  const raw = list[r];
  if (props.selectStrategy === "single") internalSelected.value = [raw];
  const el = tableWrapRef.value?.querySelectorAll("tbody tr")[r] as HTMLElement | null;
  el?.scrollIntoView({ block: "nearest" });
};

const selectRowAt = (idx: number) => {
  const n = pagedItems.value.length;
  if (!n) return;
  navTarget = Math.max(0, Math.min(idx, n - 1));
  rowCursor.value = navTarget;
  if (navRaf) return;
  navRaf = requestAnimationFrame(() => {
    navRaf = 0;
    applyRowAt(navTarget);
  });
};

const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    el.isContentEditable
  );
};

const onTableKeydown = (e: KeyboardEvent) => {
  if (isTypingTarget(e.target)) return;
  if (document.querySelector(".v-overlay--active")) return;
  const n = pagedItems.value.length;
  if (!n) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectRowAt(rowCursor.value + 1);
      break;
    case "ArrowUp":
      e.preventDefault();
      selectRowAt(rowCursor.value - 1);
      break;
    case "Home":
      e.preventDefault();
      selectRowAt(0);
      break;
    case "End":
      e.preventDefault();
      selectRowAt(n - 1);
      break;
    case "Enter": {
      const raw = pagedItems.value[rowCursor.value];
      if (raw) {
        e.preventDefault();
        emit("row-click", raw);
      }
      break;
    }
    default:
      break;
  }
};

// Auto pilih baris 1 saat data pertama/pindah halaman; sinkronkan cursor.
watch(
  pagedItems,
  (list) => {
    if (navRaf) {
      cancelAnimationFrame(navRaf);
      navRaf = 0;
    }
    if (list.length === 0) {
      rowCursor.value = 0;
      return;
    }
    rowCursor.value = 0;
    if (props.autoSelectFirst && internalSelected.value.length === 0) {
      selectRowAt(0);
    }
  },
  { immediate: true },
);

// Inject tfoot whenever data changes or table re-renders
watch(
  () => [pagedItems.value.length, hasSummaryRow.value, summaryColumnsEffective.value, props.items, props.footerValues],
  () => injectTfoot(),
  { deep: true },
);
watch(
  () => pagedItems.value,
  () => injectTfoot(),
  { deep: true },
);

// ── Row click ───────────────────────────────────────────────────────────
const handleRowClick = (event: PointerEvent, { item, index }: { item: any; index: number }) => {
  rowCursor.value = index;
  const raw = item?.raw || item;
  if (props.selectStrategy === "single") {
    internalSelected.value =
      internalSelected.value.length > 0 &&
      internalSelected.value[0][props.itemValue] === raw[props.itemValue]
        ? []
        : [raw];
  }
  emit("row-click", raw);
};
const resolvedRowProps = (data: any) => {
  let customProps: any = props.rowPropsFn ? props.rowPropsFn(data) : {};
  const raw = data?.item?.raw ?? data?.item ?? data;
  const isSelected = internalSelected.value.some(
    (s) => s[props.itemValue] === raw[props.itemValue],
  );
  const isCursor = data?.index === rowCursor.value;
  return {
    ...customProps,
    "data-row-val": String(raw?.[props.itemValue] ?? ""),
    class: (
      (customProps.class || "") +
      (isSelected ? " row-selected" : "") +
      (isCursor ? " row-cursor" : "")
    ).trim(),
    // Gabung style dari rowPropsFn dengan cursor pointer
    style: "cursor:pointer;" + (customProps.style || ""),
  };
};

// ── Context menu (klik kanan baris), opsional via prop contextMenuItems ──
const contextMenu = ref<{ show: boolean; x: number; y: number; item: any }>({
  show: false, x: 0, y: 0, item: null,
});

const openContextMenu = (e: MouseEvent) => {
  const tr = (e.target as HTMLElement).closest("tbody tr") as HTMLElement | null;
  if (!tr) return;
  let item: any = null;
  const val = tr.getAttribute("data-row-val");
  if (val != null && val !== "") {
    item =
      pagedItems.value.find((r: any) => String(r?.[props.itemValue]) === String(val)) ?? null;
  }
  if (!item && tr.parentElement) {
    const idx = Array.from(tr.parentElement.children).indexOf(tr);
    item = pagedItems.value[idx] ?? null;
  }
  if (!item || props.contextMenuItems.length === 0) return;
  // Klik kanan juga memilih baris tsb (paritas select pada klik biasa).
  if (props.selectStrategy === "single") internalSelected.value = [item];
  const H = props.contextMenuItems.length * 28 + 8;
  contextMenu.value = {
    show: true,
    x: Math.max(4, Math.min(e.clientX, window.innerWidth - 240)),
    y: Math.max(4, Math.min(e.clientY, window.innerHeight - H)),
    item,
  };
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

const runContextItem = (m: { label: string; icon?: string; disabled?: boolean; action: (item: any) => void }) => {
  if (m.disabled) return;
  closeContextMenu();
  m.action(contextMenu.value.item);
};

const onDocMousedownCtx = (ev: MouseEvent) => {
  const t = ev.target as HTMLElement;
  if (contextMenu.value.show && !t.closest(".browse-ctxmenu")) closeContextMenu();
};

const onDocKeydownCtx = (ev: KeyboardEvent) => {
  if (ev.key !== "Escape") return;
  closeContextMenu();
  // Dialog hapus sengaja tetap `persistent` supaya klik backdrop tidak
  // membatalkan penghapusan tanpa sengaja, jadi Esc ditangani sendiri di sini.
  if (deleteDialog.value) cancelDelete();
};

// ── Delete confirm ───────────────────────────────────────────────────────
const requestDelete = (item: any) => {
  // Idempoten: F4/klik ganda saat dialog sudah terbuka tidak boleh menimpa
  // record yang sedang dikonfirmasi.
  if (deleteDialog.value) return;
  pendingDeleteItem.value = item;
  deleteDialog.value = true;
};
const cancelDelete = () => {
  deleteDialog.value = false;
  pendingDeleteItem.value = null;
};
const confirmDelete = () => {
  emit("delete", pendingDeleteItem.value);
  cancelDelete();
};

// Baris yang akan dihapus. Dialog lama hanya bilang "data ini", operator tak
// tahu record mana yang kena. Ambil dari kolom kunci grid (itemValue, default
// "Kode"); kalau kosong, pakai kolom pertama yang ada isinya.
const pendingDeleteRef = computed(() => {
  const item = pendingDeleteItem.value;
  if (!item) return null;
  const headerKeys = props.headers
    .map((h: any) => h?.key)
    .filter(
      (k: any) =>
        typeof k === "string" &&
        k &&
        k !== "actions" &&
        k !== "data-table-select",
    );
  for (const key of [props.itemValue, ...headerKeys]) {
    const value = item[key];
    if (value === null || value === undefined || value === "") continue;
    const title = props.headers.find((h: any) => h?.key === key)?.title;
    return {
      label: typeof title === "string" && title ? title : "Kode",
      value: String(value),
    };
  }
  return null;
});

// ── Empty state ──────────────────────────────────────────────────────────
const emptyStateText = computed(() =>
  search.value
    ? `Tidak ada hasil untuk "${search.value}"`
    : "Belum ada data tersedia",
);
const emptyStateSubtext = computed(() =>
  search.value
    ? "Coba kata kunci lain atau hapus filter"
    : "Klik tombol + Baru untuk menambah data pertama",
);

const clearSelection = () => {
  internalSelected.value = [];
};

const tableLayout = computed(() => (props.fixedLayout ? "fixed" : "auto"));
const tdMaxWidth = computed(() => (props.fixedLayout ? "0" : "none"));

defineExpose({ clearSelection, search, filteredItems });
watch(
  () => filteredItems.value.length,
  () => {
    if (currentPage.value > totalPages.value) currentPage.value = 1;
  },
);
</script>

<template>
  <PageLayout :title="title" :menu-id="menuId" :icon="icon">
    <div class="browse-content">
      <!-- KPI strip (opsional per halaman) -->
      <div v-if="$slots.kpi" class="kpi-strip">
        <slot name="kpi" />
      </div>

      <!-- 2. Parameter Filter fieldset -->
      <fieldset v-if="showFilterBar" class="ff-bar">
        <div class="filter-bar">
          <slot name="filter-left" />
          <slot name="filter-right-prepend" />
          <v-btn
            v-if="showRefresh"
            class="tb-btn tb-btn-neutral"
            @click="emit('refresh')"
            size="small"
            :loading="isLoading"
          >
            <template #prepend><MsIcon name="refresh" :size="13" /></template>
            <span class="tb-fkey">[F5]</span> Load
          </v-btn>
          <v-btn
            v-if="activeFilterCount > 0"
            size="small"
            color="warning"
            variant="tonal"
            @click="columnFilters = {}"
          >
            <template #prepend
              ><IconFilterOff :size="14" :stroke-width="1.8"
            /></template>
            Reset ({{ activeFilterCount }})
          </v-btn>
          <v-spacer />
          <slot name="filter-right" />

          <!-- Actions (F-key toolbar), satu baris dgn filter -->
          <div ref="actionsRef" class="browse-actions">
            <v-btn v-if="canInsert" size="small" class="tb-btn tb-btn-primary" @click="emit('add')">
              <template #prepend><MsIcon name="add_box" :size="13" /></template>
              <span class="tb-fkey">[F2]</span> Baru
            </v-btn>
            <v-btn
              v-if="canEdit"
              size="small"
              class="tb-btn tb-btn-ubah"
              :disabled="!isSingleSelected"
              @click="emit('edit', internalSelected[0])"
            >
              <template #prepend><MsIcon name="edit_note" :size="13" /></template>
              <span class="tb-fkey">[F3]</span> Ubah
            </v-btn>
            <v-btn
              v-if="canDelete"
              size="small"
              class="tb-btn tb-btn-danger"
              :disabled="!isSingleSelected"
              @click="requestDelete(internalSelected[0])"
            >
              <template #prepend><MsIcon name="delete" :size="13" /></template>
              <span class="tb-fkey">[F4]</span> Hapus
            </v-btn>
            <span v-if="canDelete || canEdit" class="tb-sep" />
            <v-btn
              v-if="canExport && props.exportFn"
              size="small"
              class="tb-btn tb-btn-success"
              @click="props.exportFn?.()"
            >
              <template #prepend>
                <MsIcon name="table_view" :size="13" />
              </template>
              <span class="tb-fkey">[F8]</span> Export
            </v-btn>
            <slot name="extra-actions" :selected="internalSelected" />
          </div>
        </div>
      </fieldset>

      <!-- Table + Summary -->
      <div class="table-section">
        <!-- Grid control sub-bar (Stitch) -->
        <div class="grid-bar">
          <div class="grid-bar-left">
            <MsIcon name="table_rows" :size="14" />
            <span class="grid-bar-title">Daftar {{ props.title }}</span>
            <span class="grid-bar-sep"></span>
            <!-- Instant search (sunken) -->
            <div class="grid-search-wrap">
              <IconSearch :size="12" class="grid-search-icon" />
              <input
                :value="search"
                @input="onSearch(($event.target as HTMLInputElement).value)"
                type="text"
                :placeholder="`Cari ${searchPlaceholder}`"
                class="grid-search-input"
              />
            </div>
          </div>
          <div class="grid-bar-right">
            <!-- Baris per halaman -->
            <div class="per-page-wrap">
              <span class="page-info">Baris:</span>
              <select
                v-model="perPage"
                class="per-page-select"
                @change="currentPage = 1"
              >
                <option v-for="n in [25, 50, 100, 200]" :key="n" :value="n">
                  {{ n }}
                </option>
              </select>
            </div>
            <span class="grid-bar-sep"></span>
            <!-- Pagination bordered-group « < 1/1 > » -->
            <div class="pager-group">
              <button
                class="pager-btn"
                :disabled="currentPage === 1"
                @click="goToPage(1)"
              >
                «
              </button>
              <button
                class="pager-btn"
                :disabled="currentPage === 1"
                @click="goToPage(currentPage - 1)"
              >
                ‹
              </button>
              <span class="pager-cur">{{ currentPage }} / {{ totalPages }}</span>
              <button
                class="pager-btn"
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
              >
                ›
              </button>
              <button
                class="pager-btn"
                :disabled="currentPage === totalPages"
                @click="goToPage(totalPages)"
              >
                »
              </button>
            </div>
          </div>
        </div>
        <div
          class="table-wrap"
          ref="tableWrapRef"
          tabindex="0"
          @keydown="onTableKeydown"
          @click="onTableWrapClick"
          @scroll.passive="onTableScroll"
          @contextmenu.prevent="openContextMenu"
        >
          <v-data-table
            v-model="internalSelected"
            :headers="finalHeaders"
            :items="pagedItems"
            :loading="isLoading"
            :item-value="itemValue"
            :select-strategy="selectStrategy"
            :expanded="expanded"
            @update:expanded="emit('update:expanded', $event)"
            return-object
            density="compact"
            fixed-header
            hide-default-footer
            :items-per-page="perPage"
            class="base-table"
            :row-props="resolvedRowProps"
            @click:row="handleRowClick"
            sort-asc-icon=""
            sort-desc-icon=""
            :cell-props="({ value }) => ({ title: value ?? '' })"
          >
            <template #headers="{ columns, isSorted, getSortIcon, toggleSort }">
              <tr>
                <template
                  v-for="col in columns"
                  :key="String(col.key ?? col.title ?? '')"
                >
                  <th
                    :style="colStyle(col)"
                    :class="['base-th', col.align ? `text-${col.align}` : '']"
                  >
                    <div class="th-inner">
                      <span
                        class="th-title"
                        :class="{ sortable: col.sortable !== false }"
                        @click="col.sortable !== false && toggleSort(col)"
                      >
                        {{ col.title }}
                        <IconChevronUp
                          v-if="
                            isSorted(col) && getSortIcon(col) === '$sortAsc'
                          "
                          :size="10"
                          style="display: inline; vertical-align: middle"
                        />
                        <IconChevronDown
                          v-else-if="isSorted(col)"
                          :size="10"
                          style="display: inline; vertical-align: middle"
                        />
                      </span>
                      <button
                        v-if="col.key && col.key !== 'data-table-expand'"
                        class="col-filter-btn"
                        :class="{ active: colHasFilter(col.key) }"
                        @click.stop="openColFilter(col.key, $event)"
                        :title="`Filter ${col.title}`"
                      >
                        <IconFilter
                          v-if="colHasFilter(col.key)"
                          :size="9"
                          :stroke-width="2.2"
                        />
                        <IconAdjustmentsHorizontal
                          v-else
                          :size="9"
                          :stroke-width="2.2"
                        />
                      </button>
                    </div>
                    <div
                      v-if="col.key && col.key !== 'data-table-expand'"
                      class="col-resize-handle"
                      @mousedown.stop="onResizeStart(col.key, $event)"
                    />
                  </th>
                </template>
              </tr>
            </template>

            <template
              v-for="slotName in Object.keys($slots).filter(
                (k) =>
                  ![
                    'extra-actions',
                    'filter-left',
                    'filter-right-prepend',
                    'filter-right',
                    'detail',
                    'summary-row',
                  ].includes(k),
              )"
              v-slot:[slotName]="slotProps"
            >
              <slot :name="slotName" v-bind="slotProps" />
            </template>
            <template #loading
              ><v-skeleton-loader type="table-row@10"
            /></template>
            <template #no-data>
              <div class="empty-state">
                <IconSearchOff
                  v-if="search"
                  :size="38"
                  :stroke-width="1.3"
                  class="empty-icon"
                />
                <IconDatabaseOff
                  v-else
                  :size="38"
                  :stroke-width="1.3"
                  class="empty-icon"
                />
                <div class="empty-text">{{ emptyStateText }}</div>
                <div class="empty-subtext">{{ emptyStateSubtext }}</div>
                <v-btn
                  v-if="search"
                  size="small"
                  variant="text"
                  color="primary"
                  @click="search = ''"
                  >Hapus Pencarian</v-btn
                >
              </div>
            </template>
            <template #expanded-row="{ columns, item }">
              <tr>
                <td :colspan="columns.length" class="expanded-cell">
                  <div class="expanded-inner">
                    <slot name="detail" :item="item.raw || item" />
                  </div>
                </td>
              </tr>
            </template>

          </v-data-table>
        </div>
      </div>

      <!-- Context menu klik-kanan baris -->
      <div
        v-if="contextMenu.show && contextMenuItems.length"
        class="browse-ctxmenu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @mousedown.stop
      >
        <div class="bcm-title">Aksi Baris</div>
        <button
          v-for="m in contextMenuItems"
          :key="m.label"
          type="button"
          class="bcm-item"
          :class="{ 'bcm-disabled': m.disabled }"
          @click="runContextItem(m)"
        >
          <MsIcon v-if="m.icon" :name="m.icon" :size="15" />
          <span v-else class="bcm-item-dot" />
          {{ m.label }}
        </button>
        <div class="bcm-foot"><kbd>Esc</kbd> tutup</div>
      </div>

      <!-- Stitch status bar bawah (hotkey + info data) -->
      <div class="sb-stitch">
        <div class="sb-left">
          <span class="sb-item"><kbd class="ds-kbd">F2</kbd> Baru</span>
          <span class="sb-item"><kbd class="ds-kbd">F3</kbd> Ubah</span>
          <span class="sb-item"><kbd class="ds-kbd">F5</kbd> Refresh</span>
          <span class="sb-item"><kbd class="ds-kbd">F8</kbd> Ekspor</span>
          <span class="sb-item"><kbd class="ds-kbd">Enter</kbd> Buka Data</span>
        </div>
        <div class="sb-right">
          <span>Total: <b>{{ totalItems }} Data</b></span>
          <span class="sb-sep">|</span>
          <span>Filter Aktif: <b>{{ activeFilterCount }}</b></span>
        </div>
      </div>

      <!-- Drill-down pane (opsional) -->
      <div v-if="$slots.drill" class="drill-strip">
        <slot name="drill" />
      </div>
    </div>

    <!-- Delete Dialog -->
    <v-dialog v-model="deleteDialog" max-width="420" persistent>
      <v-card rounded="false">
        <!-- Header: bar merah padat. Merah khusus aksi merusak, dialog lain
             tetap Steel Blue, jadi warnanya masih satu sistem. -->
        <div class="del-title">
          <IconAlertTriangle :size="16" class="del-title-icon" />
          <span class="del-title-text">Hapus Data</span>
          <button
            type="button"
            class="del-close"
            title="Batal (Esc)"
            aria-label="Batal"
            @click="cancelDelete"
          >
            <IconX :size="16" />
          </button>
        </div>

        <div class="del-body">
          <div v-if="pendingDeleteRef" class="del-ref">
            <span class="del-ref-label">{{ pendingDeleteRef.label }}</span>
            <span class="del-ref-value">{{ pendingDeleteRef.value }}</span>
          </div>
          <p class="del-text">
            Yakin ingin menghapus data ini? Tindakan ini
            <strong>tidak dapat dibatalkan</strong>.
          </p>
        </div>

        <div class="del-foot">
          <span class="del-hint"><kbd>Esc</kbd> batal</span>
          <v-btn size="small" variant="text" @click="cancelDelete">
            Batal
          </v-btn>
          <v-btn
            size="small"
            color="error"
            variant="flat"
            @click="confirmDelete"
          >
            Ya, Hapus
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </PageLayout>

  <Teleport to="body">
    <ColumnFilter
      v-if="activeFilterCol"
      :filter-type="colFilterType(activeFilterCol)"
      :column-key="activeFilterCol"
      :title="activeFilterColTitle"
      :items="items"
      :model-value="columnFilters[activeFilterCol] ?? null"
      :dropdown-style="filterDropdownStyle"
      @update:model-value="onColFilterUpdate(activeFilterCol, $event)"
      @close="closeColFilter"
    />
  </Teleport>
</template>

<style scoped>
.browse-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1 1 0;
  min-height: 0;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  background: #F7F9FB;
}

/* Filter bar */
.ff-bar {
  border: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
  border-radius: 0;
  padding: 4px;
  margin: 0;
  flex-shrink: 0;
  box-shadow: none;
  min-width: 0;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  flex-shrink: 0;
  min-height: 24px;
  flex-wrap: wrap;
  row-gap: 4px;
  column-gap: 8px;
  box-shadow: none;
}
/* Rampingkan elemen filter agar bar tidak tinggi: kover .date-inp & tombol
   di dalam filter bar supaya konsisten di semua view. */
.ff-bar .date-inp,
.ff-bar input.f-inp,
.ff-bar .filter-select,
.ff-bar :deep(.v-btn),
.ff-bar :deep(.v-field),
.ff-bar :deep(.v-input) {
  min-height: 24px;
  height: 24px;
}
.ff-bar .date-inp,
.ff-bar input.f-inp,
.ff-bar .filter-select {
  font-size: 11px;
}
.ff-bar :deep(.v-btn .v-btn__content) {
  font-size: 11px;
}
/* Table section */
.table-section {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  background: var(--ds-surface, #ffffff);
  box-shadow: none;
}
.grid-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px;
  flex-shrink: 0;
  background: var(--ds-surface-window, #E8ECF1);
  border-bottom: 1px solid var(--ds-border, #A0AAB8);
}
.grid-bar-left,
.grid-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.grid-bar-left .ms-icon {
  color: var(--ds-primary, #D97706);
  flex-shrink: 0;
}
.grid-bar-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ds-primary-darker, #78350F);
  white-space: nowrap;
}
.grid-bar-sep {
  width: 1px;
  height: 12px;
  background: var(--ds-border-light, #C4CAD3);
  flex-shrink: 0;
}
/* Instant search sunken (Stitch grid control bar) */
.grid-search-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top-color: var(--ds-border-inset-edge, #7E8B9B);
  border-left-color: var(--ds-border-inset-edge, #7E8B9B);
  height: 24px;
  padding: 0 6px;
}
.grid-search-icon {
  color: var(--ds-text-muted, #8494A7);
  flex-shrink: 0;
}
.grid-search-input {
  width: 190px;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 11px;
  color: var(--ds-text, #78350F);
  font-family: var(--ds-font);
}
.grid-search-input::placeholder {
  color: var(--ds-text-muted, #8494A7);
}
/* Pagination bordered-group « < 1/1 > » */
.pager-group {
  display: flex;
  align-items: center;
  border: 1px solid var(--ds-border, #A0AAB8);
  background: #fff;
}
.pager-btn {
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border: none;
  border-right: 1px solid var(--ds-border, #A0AAB8);
  background: var(--ds-surface, #F0F3F8);
  color: var(--ds-text-secondary, #5A6A7E);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pager-btn:last-child {
  border-right: none;
}
.pager-btn:hover:not(:disabled) {
  background: #fff;
  color: var(--ds-primary, #D97706);
}
.pager-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.pager-cur {
  padding: 0 8px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--ds-text, #78350F);
  border-right: 1px solid var(--ds-border, #A0AAB8);
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.base-table {
  font-size: 12px;
  height: 100%;
}
.base-table :deep(.v-table__wrapper) {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

/* Header tabel */
.base-table :deep(thead th) {
  background: #D97706 !important;
  color: white !important;
  font-size: 10.5px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  height: 24px !important;
  padding: 0 6px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid #B45309 !important;
  border-bottom: 2px solid #B45309 !important;
  box-shadow: none;
}
.base-table :deep(thead th:last-child) {
  border-right: none !important;
}
.base-table :deep(tbody td) {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
  height: 22px !important;
  padding: 0 6px !important;
  border-right: 1px solid var(--ds-border-light, #C4CAD3) !important;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.base-table :deep(tbody td:last-child) {
  border-right: none !important;
}
.base-table :deep(tbody tr:nth-child(odd)) {
  background-color: #F0F3F8;
}
.base-table :deep(tbody tr:nth-child(even)) {
  background-color: #E4EBF4;
}
.base-table :deep(tbody tr:hover) {
  background-color: #D8E2EF !important;
}
.base-table :deep(tbody tr.row-selected) {
  background-color: #D6E4F0 !important;
  color: #78350F !important;
}
.base-table :deep(tbody tr.row-selected:hover) {
  background-color: #C0D4E8 !important;
}
.base-table :deep(tbody tr.row-cursor) td {
  box-shadow: inset 0 0 0 1px var(--ds-primary, #D97706);
}
.table-wrap:focus {
  outline: none;
}
.table-wrap:focus-visible {
  outline: none;
}
.base-table :deep(table) {
  table-layout: v-bind(tableLayout) !important;
  width: 100% !important;
}
.base-table :deep(tbody td) {
  max-width: v-bind(tdMaxWidth) !important;
}
.base-table :deep(tbody tr) {
  height: 22px !important;
  max-height: 22px !important;
}
/* Tombol/ikon expand tidak boleh memaksa tinggi baris */
.base-table :deep(tbody td .v-btn),
.base-table :deep(tbody td .v-icon) {
  height: 20px !important;
  min-height: 20px !important;
  width: 20px !important;
  min-width: 20px !important;
  font-size: 16px !important;
}
.base-table :deep(tbody td .v-btn--icon .v-icon) {
  font-size: 16px !important;
}
.base-table :deep(tbody td .v-btn) {
  padding: 0 !important;
}
.base-table :deep(tbody td .num-cell) {
  display: block;
  text-align: right;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 16px;
  gap: 6px;
}
.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.25);
  margin-bottom: 4px;
}
.empty-text {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.empty-subtext {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

/* Expanded row */
.expanded-cell {
  padding: 0 !important;
  background-color: #F0F3F8 !important;
}
.expanded-inner {
  padding: 6px 10px;
  display: flex;
  justify-content: flex-start;
}

/* ── Tfoot summary row: real <tfoot> inside <table> ── */
.base-table :deep(tfoot tr.summary-tfoot-row) {
  background: var(--ds-surface-window, #E8ECF1);
  border-top: 2px solid var(--ds-border, #A0AAB8);
}
.base-table :deep(tfoot td.summary-tfoot-td) {
  font-size: 12px;
  height: 30px;
  padding: 0 8px !important;
  border-bottom: none !important;
  white-space: nowrap;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: inherit;
}
.base-table :deep(tfoot td.summary-tfoot-label) {
  font-weight: 700;
  color: var(--ds-primary-darker, #78350F);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 11px;
}
.base-table :deep(tfoot td.summary-tfoot-val) {
  font-weight: 800;
  color: var(--ds-primary-darker, #78350F);
  font-family: var(--ds-font-data, "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Pagination (di dalam grid-bar, kompak) */
.page-info {
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
  white-space: nowrap;
}
.per-page-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}
.per-page-select {
  height: 20px;
  padding: 0 3px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 11px;
  background: var(--ds-surface, #ffffff);
  cursor: pointer;
  outline: none;
}
.per-page-select:focus {
  border-color: var(--ds-primary, #D97706);
}

/* ── Actions (F-key toolbar), satu baris dgn filter ── */
.browse-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* ── KPI strip (grid 6-kolom dense) ── */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 4px;
  flex-shrink: 0;
}
@media (min-width: 1200px) {
  .kpi-strip {
    grid-template-columns: repeat(6, 1fr);
  }
}

/* ── Drill-down pane ── */
.drill-strip {
  flex-shrink: 0;
  overflow: auto;
}

/* ── Stitch status bar bawah ── */
.sb-stitch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px;
  flex-shrink: 0;
  background: var(--ds-surface, #F0F3F8);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  font-size: 11px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.sb-left,
.sb-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.sb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.sb-stitch b {
  color: var(--ds-primary-darker, #78350F);
}
.sb-sep {
  color: var(--ds-border, #A0AAB8);
}
.tb-fkey {
  font-size: 11px;
  font-weight: 700;
  opacity: 1;
  letter-spacing: 0;
}

/* Custom header th */
.base-th {
  background-color: #D97706 !important;
  color: white !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  height: 34px !important;
  padding: 0 8px !important;
  user-select: none;
  position: relative;
  overflow: visible !important;
}
.th-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  padding-right: 6px;
}
.th-title {
  flex: 1;
  white-space: nowrap;
}
.th-title.sortable {
  cursor: pointer;
}
.col-filter-btn {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.col-filter-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
.col-filter-btn.active {
  background: #ffd54f;
  border-color: #ffd54f;
  color: #1a1a1a;
}
.col-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  border-right: 2px solid rgba(255, 255, 255, 0.25);
}
.col-resize-handle:hover,
.col-resize-handle:active {
  border-right-color: rgba(255, 255, 255, 0.85);
}

/* ── Dialog konfirmasi hapus ────────────────────────────────────────── */
/* Struktur mengikuti dialog lain: bar judul padat, body, footer dengan
   petunjuk Esc. Bedanya hanya warnanya: merah, karena aksinya merusak. */
.del-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  background: var(--ds-error, #DC2626);
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
}
/* Jangan pakai `.del-title > span`: ikon Material Symbol juga elemen span,
   jadi aturan itu ikut meregangkan ikonnya dan tampak tidak sejajar. */
.del-title-icon {
  flex: 0 0 auto;
}
.del-title-text {
  flex: 1 1 auto;
  min-width: 0;
}
.del-close {
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
.del-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Outline Steel Blue tak akan terlihat di atas bar merah. */
.del-close:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}
.del-body {
  padding: 14px;
}
/* Baris data yang akan dihapus: ini inti dialognya, jadi ditaruh paling atas
   dan selebar penuh, bukan pil kecil yang menempel di bawah kalimat tanya. */
.del-ref {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  background: var(--ds-primary-50, #E8EDF5);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 7px 12px;
}
.del-ref-label {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ds-text-secondary, #5A6A7E);
}
.del-ref-value {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
  font-size: 13px;
  font-weight: 800;
  font-family: var(--ds-font-mono, "Consolas", monospace);
  color: var(--ds-primary, #D97706);
}
.del-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text, #78350F);
}
.del-ref + .del-text {
  margin-top: 10px;
}
.del-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  background: var(--ds-surface, #F0F3F8);
}
.del-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.del-hint kbd {
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

<style>
/* Toolbar buttons (.tb-btn*) pindah ke assets/design-system.css.
   Sebelumnya di sini (style non-scoped), sehingga style tombol HANYA ter-load
   setelah halaman browse dibuka: form & utility yang tidak mengimpor
   BaseBrowse tampil tanpa bentuk/warna tombol. */

/* ── Input filter slot (global – .date-inp didefinisikan per-view, scoped) ── */
/* Paritas mockup: input periode putih (bg-surface-lowest), bukan abu panel. */
.ff-bar .date-inp,
.filter-bar .date-inp {
  background: #FFFFFF;
}
/* Column filter styles now in ColumnFilter.vue */

/* ── Responsif ── */

/* Tablet landscape (≤1280px) */
@media (max-width: 1280px) {
  .browse-content {
    padding: 6px;
    gap: 6px;
  }
  .filter-bar {
    padding: 0;
    min-height: 24px;
    gap: 8px;
  }
  .base-table :deep(thead th) {
    font-size: 10px !important;
    height: 24px !important;
  }
  .base-table :deep(tbody td) {
    font-size: 11px;
    height: 26px !important;
  }
.base-table :deep(tfoot td.summary-tfoot-td) {
    height: 28px;
    font-size: 11px;
  }
}

/* Tablet portrait (≤1024px) */
@media (max-width: 1024px) {
  .browse-content {
    padding: 4px;
    gap: 4px;
  }
.filter-bar {
    padding: 0;
    min-height: 24px;
    gap: 6px;
  }
  .grid-search-input {
    width: 140px;
  }
  .page-info {
    display: none;
  }
  .per-page-select {
    height: 20px;
    font-size: 11px;
  }
}

/* Mobile (≤768px) */
@media (max-width: 768px) {
  .browse-content {
    padding: 2px;
    gap: 3px;
  }
.filter-bar {
    padding: 0;
    min-height: 22px;
    gap: 5px;
  }
  .grid-search-input {
    width: 100px;
  }
  .base-table :deep(tfoot td.summary-tfoot-td) {
    height: 26px;
    font-size: 10px;
    padding: 0 5px !important;
  }
  .pager-btn {
    min-width: 18px;
    padding: 0 2px;
  }
  .pager-cur {
    padding: 0 5px;
    font-size: 10px;
  }
  /* Header tabel lebih kompak */
  .base-table :deep(thead th) {
    font-size: 9px !important;
    height: 22px !important;
    padding: 0 5px !important;
  }
  .base-table :deep(tbody td) {
    font-size: 10px;
    height: 24px !important;
    padding: 0 5px !important;
  }
}

/* ── Context menu klik-kanan ─────────────────────────────── */
.browse-ctxmenu {
  position: fixed;
  z-index: 3000;
  min-width: 240px;
  background: var(--ds-surface-raised, #FFFFFF);
  border: 1px solid var(--ds-border, #A0AAB8);
  border-top: 3px solid var(--ds-primary, #D97706);
  box-shadow: 0 6px 18px rgba(27, 45, 74, 0.16);
  padding: 4px;
  display: flex;
  flex-direction: column;
  animation: bcm-pop 0.12s ease-out;
}
@keyframes bcm-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.bcm-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ds-primary, #D97706);
  padding: 4px 8px 6px;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  margin-bottom: 4px;
  user-select: none;
}
.bcm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 7px 10px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text, #78350F);
  cursor: pointer;
  border-radius: 0;
  font-family: inherit;
  transition: background 0.1s ease, color 0.1s ease;
}
.bcm-item:hover {
  background: var(--ds-primary, #D97706);
  color: #ffffff;
}
.bcm-item-dot {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--ds-primary-light, #F59E0B);
}
.bcm-item.bcm-disabled {
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
}
.bcm-item.bcm-disabled:hover {
  background: transparent;
  color: var(--ds-text-muted, #8494A7);
}
.bcm-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 2px;
  font-size: 10px;
  color: var(--ds-text-muted, #8494A7);
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  margin-top: 4px;
}
.bcm-foot kbd {
  font-family: inherit;
  font-size: 9px;
  font-weight: 700;
  color: var(--ds-primary-darker, #78350F);
  background: var(--ds-surface, #E8ECF1);
  border: 1px solid var(--ds-border-light, #C4CAD3);
  border-bottom-width: 2px;
  border-radius: 2px;
  padding: 1px 4px;
}
</style>
