// Hotkey global ala ERP desktop (F2..F12 + Ctrl+W + Alt+1..9).
//
// Registrasi di MODULE SCOPE (bukan onMounted) dengan capture phase agar:
//  - selalu aktif setelah reload apa pun, tanpa butuh remount komponen;
//  - votta lolos HMR (dispose/accept): listener lama dicabut, baru dipasang;
//  - menerima event PERTAMA sebelum handler lain bisa mengganggu; preventDefault
//    Ctrl+W membatalkan aksi default browser (tutup tab Chrome).
//
// Event didispatch ke document:
//  - "erp:hotkey"    (BaseBrowse/BaseForm)
//  - "erp:close-tab" (TabBar, Ctrl+W)
//  - "erp:alt-nav"   (AppSidebar, navigasi menu Penjualan ke-n, Alt+1..9)
export type ErpHotkeyAction =
  | "add"        // F2
  | "edit"       // F3
  | "delete"     // F4
  | "refresh"    // F5
  | "export"     // F8
  | "draft"      // F9
  | "saveNew"    // F10
  | "saveClose"  // F11
  | "print";     // F12

const KEY_MAP: Record<string, ErpHotkeyAction> = {
  F2: "add",
  F3: "edit",
  F4: "delete",
  F5: "refresh",
  F8: "export",
  F9: "draft",
  F10: "saveNew",
  F11: "saveClose",
  F12: "print",
};

// Cegah salah-trigger saat user mengetik (misal isi field namanya "F2")
const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return true;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    (target as HTMLElement).isContentEditable
  );
};

// ── Anti-spam satu aksi ──
// Tahan tombol mengirim keydown berulang tiap ~30ms, dan double-tap cepat
// bisa mendarat dua kali dalam rentang itu. Keduanya harus jadi SATU aksi.
// Dijaga di sini, bukan di tiap view, supaya seluruh aplikasi ikut aman:
// ini satu-satunya tempat hotkey di-dispatch.
const REPEAT_WINDOW_MS = 350;
let lastSig = "";
let lastSigAt = 0;

const isSpam = (e: KeyboardEvent, sig: string) => {
  const now = Date.now();
  const dup =
    e.repeat || (sig === lastSig && now - lastSigAt < REPEAT_WINDOW_MS);
  lastSig = sig;
  lastSigAt = now;
  return dup;
};

const onKey = (e: KeyboardEvent) => {
  // Gate: hotkey hanya aktif dalam DefaultLayout (ada tab & toolbar).
  // Di BlankLayout (login/cetak/error + page luar) browser tetap default.
  if (!document.querySelector(".app-shell")) return;

  // ── Ctrl+W: tutup tab APLIKASI, kalau tidak dicegah browser tutup tab-nya
  // sendiri. preventDefault harus tanpa syarat sebelum keydown target.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === "KeyW") {
    e.preventDefault();
    if (isSpam(e, "close-tab")) return;
    document.dispatchEvent(new CustomEvent("erp:close-tab"));
    return;
  }

  // ── Alt+1..9: navigasi menu grup Penjualan ke-n (AppSidebar). Abaikan
  // saat dialog terbuka agar tidak ganggu input data.
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      if (document.querySelector(".v-overlay--active")) return;
      e.preventDefault();
      if (isSpam(e, `alt-nav-${n}`)) return;
      document.dispatchEvent(
        new CustomEvent<number>("erp:alt-nav", { detail: n }),
      );
      return;
    }
  }

  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  const action = KEY_MAP[e.key] || KEY_MAP[e.key.toUpperCase()];
  if (!action) return;

  // F5 = refresh: bukan tombol karakter yang diketik di input, jadi diizinkan
  // walau fokus di field (mis. periode): cegah reload browser.
  const isRefresh = action === "refresh";

  // Ruang untuk komponen: dialog Vuetify punya class .v-overlay--active.
  // F5 tetap di-preventDefault (tanpa reload) tapi tidak dispatch saat dialog
  // terbuka: refresh grid di belakang overlay tidak terjadi.
  if (document.querySelector(".v-overlay--active")) {
    if (isRefresh) e.preventDefault();
    return;
  }

  if (isRefresh) {
    e.preventDefault();
    if (isSpam(e, action)) return;
    document.dispatchEvent(
      new CustomEvent<ErpHotkeyAction>("erp:hotkey", { detail: "refresh" }),
    );
    return;
  }

  if (isTyping(e.target)) return;
  e.preventDefault();
  if (isSpam(e, action)) return;
  document.dispatchEvent(
    new CustomEvent<ErpHotkeyAction>("erp:hotkey", { detail: action }),
  );
};

let cleanup: (() => void) | null = null;

function installHotkeys() {
  if (cleanup) return;
  window.addEventListener("keydown", onKey, true);
  cleanup = () => window.removeEventListener("keydown", onKey, true);
}

installHotkeys();

// HMR: sebelum modul diganti, cabut listener lama; setelah diganti, modul baru
// mengeksekusi installHotkeys() lagi → listener segar selalu terpasang.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanup?.();
    cleanup = null;
  });
  import.meta.hot.accept(() => {});
}