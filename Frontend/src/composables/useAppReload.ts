import { ref } from "vue";
import type { Router } from "vue-router";
import { hasUnsavedChanges, hasOpenForm } from "@/composables/useUnsavedForms";

// Penjaga ini menggantikan kebiasaan "user harus Ctrl+R sendiri" setelah deploy.
export type ReloadBlockReason = "unsaved" | "formOpen" | "loop" | "dev" | null;

const STAMP_KEY = "bsm_last_auto_reload";
// Jeda minimum antar muat ulang otomatis. Kalau berkas tetap tidak ada setelah
// reload, hentikan supaya tab tidak berputar tanpa henti.
const LOOP_WINDOW_MS = 10_000;

const blockReason = ref<ReloadBlockReason>(null);

export const reloadBlockReason = () => blockReason.value;
export const dismissReloadNotice = () => {
  blockReason.value = null;
};

const readStamp = () => {
  try {
    return Number(sessionStorage.getItem(STAMP_KEY) || 0);
  } catch {
    return 0;
  }
};

const writeStamp = () => {
  try {
    sessionStorage.setItem(STAMP_KEY, String(Date.now()));
  } catch {
    /* sessionStorage diblokir: penjaga loop mundur ke hitungan sesi ini saja */
  }
};

const reloadedRecently = () => {
  const t = readStamp();
  return t > 0 && Date.now() - t < LOOP_WINDOW_MS;
};

/**
 * Muat ulang halaman.
 * force = false: ditahan kalau ada isian form yang belum tersimpan, dan alasan
 * penahanan dibuka lewat dialog supaya user bisa menyimpan dulu.
 */
export const reloadNow = (force = false) => {
  if (!force && hasUnsavedChanges()) {
    blockReason.value = "unsaved";
    return;
  }
  blockReason.value = null;
  writeStamp();
  window.location.reload();
};

// Vite menolak modul yang Content-Type-nya HTML (jawaban try_files nginx untuk
// berkas aset yang sudah terhapus), dan tiap browser menuliskan pesannya beda.
const CHUNK_ERROR_RE =
  /dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk \d+ failed|MIME type|text\/html/i;

export const isChunkLoadError = (err: unknown) =>
  CHUNK_ERROR_RE.test(String((err as { message?: string })?.message || err || ""));

/** Dipanggil saat potongan halaman gagal dimuat, biasanya setelah rilis baru. */
export const handleChunkLoadFailure = () => {
  // Hal yang paling butuh tindakan user diperiksa lebih dulu, supaya alasannya
  // muncul apa adanya dan tidak tertutup pesan lain. Urutan ini juga membuat
  // perilaku di lokal sama dengan produksi untuk kedua kasus form tersebut.
  if (hasUnsavedChanges()) {
    blockReason.value = "unsaved";
    return;
  }
  if (hasOpenForm()) {
    blockReason.value = "formOpen";
    return;
  }
  // Mode pengembangan tidak punya berkas ber-hash yang bisa basi, sementara
  // Vite memang memuat ulang sendiri saat dependensinya berubah. Muat ulang
  // otomatis di sini hanya berisiko menghapus isian yang sedang diketik.
  if (import.meta.env.DEV) {
    blockReason.value = "dev";
    return;
  }
  if (reloadedRecently()) {
    blockReason.value = "loop";
    return;
  }
  reloadNow();
};

export function installReloadGuard(router: Router) {
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    handleChunkLoadFailure();
  });

  // Menangkap gagal muat komponen yang di-lazy-load router (klik menu setelah
  // deploy: berkas chunk lamanya sudah hilang di server).
  router.onError((err) => {
    if (isChunkLoadError(err)) handleChunkLoadFailure();
  });
}
