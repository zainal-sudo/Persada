// Esc untuk menutup dialog `persistent`.
//
// Vuetify SENGAJA tidak menutup dialog persistent dengan Esc (lihat
// VOverlay.js:212, `if (!props.persistent) isActive.value = false`). Persistent
// dipakai supaya klik backdrop tidak membuang form yang sudah diisi separuh,
// jadi Esc harus dipasang sendiri di sini.
//
// Dua hal yang perlu dijaga di satu tempat, bukan di tiap dialog:
//
// 1. STACK. Banyak view menumpuk dialog konfirmasi di atas dialog form. Kalau
//    tiap dialog memasang listener sendiri ke window, satu tekan Esc menutup
//    semuanya sekaligus. Stack membuat hanya dialog paling atas yang menutup.
//
// 2. FOKUS. Grid memakai ↑↓ untuk pindah baris. Kalau fokus masih tinggal di
//    dalam dialog yang sudah hilang, navigasi grid mati. Fokus dikembalikan ke
//    elemen yang membuka dialog.

import { nextTick, onScopeDispose, watch, type Ref } from "vue";

/** Sumber apa pun yang punya .value read/write: Ref, computed, atau reactive. */
type OpenSource = { value: boolean };

const stack: { cancel: () => void }[] = [];
let bound = false;

const onKey = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || !stack.length) return;
  e.preventDefault();
  // BaseBrowse punya handler Esc sendiri (menu konteks + dialog hapus) di level
  // document. Tanpa stopPropagation, satu tekan Esc akan menutup dua dialog.
  e.stopPropagation();
  stack[stack.length - 1].cancel();
};

/**
 * @param open  sumber kebenaran kondisi buka/tutup (Ref, computed, atau
 *              `computed(() => state.value.visible)`)
 * @param onCancel aksi batal. WAJIB parameter, bukan default `() => open.value
 *              = false`, karena tidak semua dialog bisa ditutup dengan cara
 *              itu: dialog ConfirmDialog/ReturPenjualan menutup lewat
 *              `onNo()` supaya Promise di baliknya ikut resolve.
 */
export function useEscClose(open: OpenSource, onCancel: () => void) {
  let prevFocus: HTMLElement | null = null;
  let entry: { cancel: () => void } | null = null;

  const restoreFocus = () => {
    const target = prevFocus;
    prevFocus = null;
    if (target && target.isConnected) nextTick(() => target.focus());
  };

  watch(
    open,
    (isOpen) => {
      if (isOpen) {
        prevFocus = document.activeElement as HTMLElement | null;
        entry = { cancel: onCancel };
        stack.push(entry);
        if (!bound) {
          window.addEventListener("keydown", onKey);
          bound = true;
        }
      } else {
        if (entry) {
          const i = stack.indexOf(entry);
          if (i !== -1) stack.splice(i, 1);
          entry = null;
        }
        restoreFocus();
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    if (entry) {
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
    }
    // Listener global tetap dipakai dialog lain; lepas hanya saat tidak ada
    // satu pun dialog yang memakainya.
    if (bound && !stack.length) {
      window.removeEventListener("keydown", onKey);
      bound = false;
    }
  });
}
