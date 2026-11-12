import { ref, computed } from "vue";
import { systemApi, type ChangelogEntry, type SystemInfo } from "@/api/systemApi";
import { compareVersion, entriesSince } from "@/utils/changelog";

// Versi rilis yang terakhir dibaca user. Kehadirannya yang mencegah pengumuman
// muncul berulang tiap pindah halaman.
const SEEN_KEY = "bsm_seen_version";
const buildVersion = __APP_VERSION__;

const info = ref<SystemInfo | null>(null);
const pending = ref<ChangelogEntry[]>([]);
const isOpen = ref(false);
const mode = ref<"new" | "all">("new");
const isLoading = ref(false);
const hasError = ref(false);

let started = false;

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
};

const writeSeen = (v: string) => {
  try {
    localStorage.setItem(SEEN_KEY, v);
  } catch {
    /* localStorage bisa diblokir; pengumuman tetap tampil sekali per sesi */
  }
};

const version = computed(() => info.value?.version || "");
const date = computed(() => info.value?.date || null);

// Versi yang belum dibaca user. Panel memakainya untuk menandai mana yang baru
// dan untuk menyembunyikan rilis yang sudah lama dibaca.
const unreadVersions = computed(() => pending.value.map((e) => e.version));

// Bundle di browser belum ikut ter-update: tawarkan muat ulang.
const isStaleBuild = computed(
  () => !!version.value && compareVersion(buildVersion, version.value) < 0,
);

const entries = computed(() =>
  mode.value === "all" ? info.value?.history || [] : pending.value,
);

/**
 * Ambil info versi dari server.
 * auto = true: buka sendiri kalau ada catatan yang belum dibaca user.
 * auto = false: hanya memuat data, dipakai saat user membuka panel manual.
 */
const check = async (auto = true) => {
  isLoading.value = true;
  hasError.value = false;
  try {
    const data = await systemApi.getInfo();
    info.value = data;

    const seen = readSeen();
    if (!seen) {
      // Pemakaian pertama di browser ini: catat sebagai sudah dibaca. Riwayat
      // 1.0.0 sampai sekarang tidak relevan lagi untuk pemakai baru.
      writeSeen(data.version);
      pending.value = [];
      return;
    }

    pending.value = entriesSince(data.history || [], seen);
    if (auto && pending.value.length > 0) {
      mode.value = "new";
      isOpen.value = true;
    }
  } catch {
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const openAll = () => {
  mode.value = "all";
  isOpen.value = true;
  if (!info.value) check(false);
};

const close = () => {
  isOpen.value = false;
  if (info.value?.version) writeSeen(info.value.version);
  pending.value = [];
};

const init = () => {
  if (started) return;
  started = true;
  check();
  // Admin bisa merilis saat aplikasi sedang dipakai; cek lagi ketika user
  // kembali ke tab. Sudah dibaca = tidak muncul lagi.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
};

export function useWhatsNew() {
  const open = computed({
    get: () => isOpen.value,
    set: (v: boolean) => {
      if (v) isOpen.value = true;
      else close();
    },
  });

  return {
    version,
    date,
    buildVersion,
    isStaleBuild,
    entries,
    unreadVersions,
    open,
    isLoading,
    hasError,
    init,
    openAll,
    close,
  };
}
