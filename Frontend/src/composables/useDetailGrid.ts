import { ref, onMounted, onBeforeUnmount } from "vue";

// ─────────────────────────────────────────────────────────────────────
// useDetailGrid — Grid keyboard-first ala Excel / ERP desktop.
// Perilaku identik DOFormView (referensi: DOFormView.vue ~baris 398-507):
//   - Enter: commit edit (blur) / mulai edit sel terpilih
//   - Escape: commit edit
//   - ArrowUp/Down/Left/Right: pindah sel (wrap baris & kolom)
//   - Space: toggle kolom checkbox (closed/lunas/aktif)
//   - type-to-edit: ketik angka/huruf saat sel terpilih → langsung edit
// Property yang harus di-scope per form:
//   - cols: daftar kolom CUKUP yang bisa dinavigasi (dalam urutan panah)
//   - cellId(c, r): id DOM element sel (harus unik per form)
//   - rowCount: () => jumlah baris detail saat ini
//   - onPicker?: kolom ini membuka lookup (SearchModal) saat Enter
//   - isToggle?: kolom checkbox
//   - onToggle?: aksi toggle baris (default: flip nilai 0/1)
//   - typeEditCols?: kolom yang boleh type-to-edit (selain picker)
//   - onTypeEdit?: apa yang dilakukan saat type-to-edit (default: fokus input)
//   - cellPrefix?: prefix id (guard: jangan ganggu input luar form)
// ─────────────────────────────────────────────────────────────────────

export interface DetailGridOptions {
  cols: string[];
  rowCount: () => number;
  cellId: (c: string, r: number) => string;
  onPicker?: (r: number, c: string) => void;
  isToggle?: (c: string) => boolean;
  onToggle?: (r: number, c: string, el: HTMLElement | null) => void;
  typeEditCols?: string[];
  onTypeEdit?: (r: number, c: string, key: string) => void;
  cellPrefix?: string;
}

export function useDetailGrid(opts: DetailGridOptions) {
  const focusCell = ref<{ r: number; c: string } | null>(null);
  const editMode = ref(false);

  const cols = opts.cols;
  const prefix = opts.cellPrefix || "cell";
  const isOwnCellEl = (el: HTMLElement | null) =>
    !!el && el.id?.startsWith(`${prefix}-`);

  const setSelect = (r: number, c: string) => {
    focusCell.value = { r, c };
    editMode.value = false;
  };

  const gridBlur = () => {
    editMode.value = false;
  };

  const onGridCellFocus = (c: string, r: number) => {
    focusCell.value = { r, c };
    editMode.value = true;
  };

  const commitEdit = () => {
    editMode.value = false;
    const el = document.activeElement as HTMLElement | null;
    if (el && isOwnCellEl(el)) el.blur?.();
  };

  const enterEdit = (r: number, c: string) => {
    focusCell.value = { r, c };
    if (opts.isToggle?.(c)) {
      const d = opts.onToggle;
      if (d) d(r, c, null);
      return;
    }
    if (opts.onPicker && isPickerCol(c)) {
      opts.onPicker(r, c);
      return;
    }
    editMode.value = true;
    const el = document.getElementById(opts.cellId(c, r)) as HTMLElement | null;
    if (el) el.focus();
  };

  const isPickerCol = (c: string) =>
    !!opts.cols.length &&
    !!opts.cellId(c, 0) &&
    !!opts.onPicker &&
    // kolom picker = kolom dengan input readonly + tombol cari; untuk
    // kesederhanaan: treat nama-nama ini sebagai picker
    /^(sku|kode|barang|nama|akun|customer|salesman|rekening|identitas|kendaraan|ekspedisi)$/i.test(c);

  const moveFocus = (dr: number, dc: number) => {
    const n = opts.rowCount();
    if (!n) return;
    let r = focusCell.value?.r ?? 0;
    let ci = focusCell.value ? cols.indexOf(focusCell.value.c) : cols.indexOf("qty");
    if (ci < 0) ci = 0;
    ci += dc;
    r = ((r + dr) % n + n) % n;
    ci = ((ci % cols.length) + cols.length) % cols.length;
    setSelect(r, cols[ci]);
  };

  const startTypeEdit = (r: number, c: string, key: string) => {
    focusCell.value = { r, c };
    editMode.value = true;
    const el = document.getElementById(opts.cellId(c, r)) as HTMLInputElement | null;
    const onTE = opts.onTypeEdit;
    if (onTE) {
      onTE(r, c, key);
      return;
    }
    if (!el) return;
    el.focus();
    el.value = key;
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch {
      /* noop */
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // ── Keydown GLOBAL (perilaku identik DOFormView) ──────────────────
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    const k = e.key;
    const t = e.target as HTMLElement | null;

    // Jangan ganggu input di luar grid (kotak cari, modal, dsb).
    const targetIsOtherInput =
      !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && !isOwnCellEl(t);
    if (targetIsOtherInput) return;

    if (k === "Enter" || k === "Escape") {
      if (!opts.rowCount()) return;
      if (editMode.value) {
        e.preventDefault();
        commitEdit();
        return;
      }
      if (k === "Enter" && focusCell.value) {
        e.preventDefault();
        enterEdit(focusCell.value.r, focusCell.value.c);
      }
      return;
    }

    if (editMode.value) return; // Arrow saat edit → kursor teks (default)
    if (!opts.rowCount()) return;

    if (k === "ArrowUp") { e.preventDefault(); moveFocus(-1, 0); }
    else if (k === "ArrowDown") { e.preventDefault(); moveFocus(1, 0); }
    else if (k === "ArrowLeft") { e.preventDefault(); moveFocus(0, -1); }
    else if (k === "ArrowRight") { e.preventDefault(); moveFocus(0, 1); }

    // Space pd kolom toggle → toggle (Excel-like).
    if (k === " " && focusCell.value && opts.isToggle?.(focusCell.value.c) && opts.rowCount()) {
      e.preventDefault();
      const d = opts.onToggle;
      if (d) d(focusCell.value.r, focusCell.value.c, null);
      return;
    }

    // Type-to-edit: karakter cetak pada sel terpilih.
    const typeCols = opts.typeEditCols || [];
    if (
      focusCell.value &&
      k.length === 1 &&
      !e.ctrlKey && !e.metaKey && !e.altKey &&
      (typeCols.includes(focusCell.value.c) || /^[0-9]$/.test(k))
    ) {
      const cc = focusCell.value.c;
      if (typeCols.includes(cc) || /^[0-9]$/.test(k)) {
        e.preventDefault();
        startTypeEdit(focusCell.value.r, cc, k);
      }
    }
  };

  onMounted(() => window.addEventListener("keydown", handleGlobalKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", handleGlobalKeydown));

  return {
    focusCell,
    editMode,
    setSelect,
    gridBlur,
    onGridCellFocus,
    commitEdit,
    enterEdit,
    moveFocus,
    startTypeEdit,
  };
}