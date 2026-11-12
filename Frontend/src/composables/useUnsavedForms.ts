import { ref, watch, onMounted, onActivated, onDeactivated, onUnmounted, type Ref } from "vue";

// Daftar form yang punya isian belum tersimpan. Penjaga muat ulang (useAppReload)
// membaca daftar ini: reload otomatis hanya dijalankan saat daftarnya kosong.
const unsaved = ref<Set<string>>(new Set());

// Form yang sedang tampil di layar. Isian yang masuk lewat picker/dialog tidak
// terlihat pemantau DOM, jadi form yang terbuka tetap dianggap berisiko.
const openForms = ref<Set<string>>(new Set());
let seq = 0;

const add = (set: Ref<Set<string>>, key: string) => {
  if (set.value.has(key)) return;
  const next = new Set(set.value);
  next.add(key);
  set.value = next;
};

const remove = (set: Ref<Set<string>>, key: string) => {
  if (!set.value.has(key)) return;
  const next = new Set(set.value);
  next.delete(key);
  set.value = next;
};

export const markUnsaved = (key: string) => add(unsaved, key);
export const clearUnsaved = (key: string) => remove(unsaved, key);
export const hasUnsavedChanges = () => unsaved.value.size > 0;

export const markFormOpen = (key: string) => add(openForms, key);
export const clearFormOpen = (key: string) => remove(openForms, key);
export const hasOpenForm = () => openForms.value.size > 0;

/**
 * Tandai form ini punya isian begitu user menyentuh salah satu field di dalam
 * `roots`. Pemantauan lewat DOM supaya 35 form tidak perlu diubah satu per satu.
 *
 * Batasnya: field di picker/dialog yang di-teleport ke body tidak terjangkau,
 * dan form yang autosave-nya mengisi field tanpa event user tidak terdeteksi.
 * Keduanya condong ke "dianggap ada isian", arah yang aman untuk penjaga reload.
 * Form yang butuh sinyal eksplisit bisa memanggil markUnsaved sendiri.
 */
export function watchUnsavedInput(...roots: Ref<HTMLElement | null>[]) {
  const key = `form-${++seq}`;
  const mark = () => markUnsaved(key);

  // Nilai lama dari watch bisa undefined, jadi tipenya ikut menerima itu.
  const attach = (el?: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener("input", mark, true);
    el.addEventListener("change", mark, true);
  };
  const detach = (el?: HTMLElement | null) => {
    if (!el) return;
    el.removeEventListener("input", mark, true);
    el.removeEventListener("change", mark, true);
  };

  // Elemen field bisa belum ada saat setup (mis. form masih memuat data),
  // jadi listener mengikuti ref-nya, bukan hanya dipasang sekali di onMounted.
  roots.forEach((root) =>
    watch(
      root,
      (el, prev) => {
        detach(prev);
        attach(el);
      },
      { immediate: true },
    ),
  );

  // Form yang ter-mount berarti sedang tampil, atau setidaknya sudah dipakai
  // (di dalam KeepAlive tab, form yang di-deactivate dilepas dari daftar ini).
  onMounted(() => markFormOpen(key));
  onActivated(() => markFormOpen(key));
  onDeactivated(() => clearFormOpen(key));

  onUnmounted(() => {
    roots.forEach((root) => detach(root.value));
    clearUnsaved(key);
    clearFormOpen(key);
  });
}
