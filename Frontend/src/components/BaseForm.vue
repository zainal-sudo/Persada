<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
} from "vue";
import PageLayout from "@/components/PageLayout.vue";
import MsIcon from "@/components/MsIcon.vue";
import { watchUnsavedInput } from "@/composables/useUnsavedForms";

const props = defineProps<{
  title: string;
  menuId?: string;
  icon?: any;
  isLoading?: boolean;
  isSaving?: boolean;
  itemName?: string;
  showSavePrint?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "save-action", action: "new" | "close"): void;
  (e: "save-print"): void;
}>();

// Isian form ini dicatat supaya muat ulang otomatis tidak menghapusnya.
const formBody = ref<HTMLElement | null>(null);
watchUnsavedInput(formBody);

// ── Confirmation dialog ──
const confirmDialog = ref(false);
// Jenis simpan yang sedang dikonfirmasi. Dibedakan supaya dialog bisa
// menyebut aksi mana yang akan jalan. Sebelumnya print ditandai lewat
// callback, jadi jenisnya tersembunyi di closure dan dialog tak punya apa
// pun untuk ditampilkan selain "Yakin ingin menyimpan?".
const pendingKind = ref<"new" | "close" | "print">("new");

// Kunci single-flight: satu dialog hanya boleh memicu satu penyimpanan.
const saveDispatched = ref(false);

const openConfirm = (action: "new" | "close") => {
  // Idempoten: klik/hotkey ganda saat dialog sudah terbuka tidak boleh
  // menimpa aksi yang sedang dikonfirmasi.
  if (confirmDialog.value) return;
  pendingKind.value = action;
  saveDispatched.value = false;
  confirmDialog.value = true;
};

const openConfirmPrint = () => {
  if (confirmDialog.value) return;
  pendingKind.value = "print";
  saveDispatched.value = false;
  confirmDialog.value = true;
};

// Akibat setelah tersimpan, supaya beda Baru/Tutup/Cetak terlihat sebelum
// menekan konfirmasi, bukan setelahnya.
const confirmEffect = computed(() => {
  switch (pendingKind.value) {
    case "close":
      return "Setelah tersimpan, form ini ditutup.";
    case "print":
      return "Setelah tersimpan, dokumen disiapkan untuk dicetak.";
    default:
      return "Setelah tersimpan, form dikosongkan untuk entri berikutnya.";
  }
});

const doSave = () => {
  // Dua klik cepat pada "Ya, Simpan" tetap harus jadi satu penyimpanan.
  if (saveDispatched.value || props.isSaving) return;
  saveDispatched.value = true;
  confirmDialog.value = false;
  const kind = pendingKind.value;
  if (kind === "print") {
    emit("save-print");
  } else {
    emit("save-action", kind);
  }
};

// ── Hotkey global (F10/F11/F12) ─────────────────────────────────────
// Listener hanya terpasang saat form ini BENAR-BENAR tampil (activated);
// tab KeepAlive yang di-deactivate dicabut listener-nya, jadi form-form
// di tab lain tidak ikut mengeksekusi F10/F11/F12.
const onGlobalHotkey = (e: Event) => {
  const action = (e as CustomEvent<string>).detail;
  if (props.isSaving || props.disabled) return;

  switch (action) {
    case "saveNew":
      openConfirm("new");
      break;
    case "saveClose":
      openConfirm("close");
      break;
    case "print":
      if (props.showSavePrint) openConfirmPrint();
      break;
    default:
      break;
  }
};

// Esc = batal. Dialog sengaja `persistent` supaya klik backdrop tidak
// membatalkan penyimpanan tanpa sengaja, jadi Esc ditangani sendiri di sini.
const onCancelKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && confirmDialog.value) confirmDialog.value = false;
};

const bindKeyListeners = () => {
  document.addEventListener("erp:hotkey", onGlobalHotkey);
  document.addEventListener("keydown", onCancelKey);
};
const unbindKeyListeners = () => {
  document.removeEventListener("erp:hotkey", onGlobalHotkey);
  document.removeEventListener("keydown", onCancelKey);
};

onMounted(bindKeyListeners);
onActivated(bindKeyListeners);
onDeactivated(unbindKeyListeners);
onUnmounted(unbindKeyListeners);
</script>

<template>
  <PageLayout :title="title" :icon="icon" :menu-id="menuId" desktop-mode>
    <template #header-actions>
      <slot name="header-actions" />
      <v-btn
        size="small"
        class="tb-btn tb-btn-primary"
        @click="openConfirm('new')"
        :loading="isSaving"
        :disabled="isSaving || props.disabled"
      >
        <template #prepend><MsIcon name="save" :size="14" /></template>
        <span class="tb-fkey">[F10]</span> Simpan &amp; Baru
      </v-btn>
      <v-btn
        size="small"
        class="tb-btn tb-btn-edit"
        @click="openConfirm('close')"
        :loading="isSaving"
        :disabled="isSaving || props.disabled"
      >
        <template #prepend><MsIcon name="save" :size="14" /></template>
        <span class="tb-fkey">[F11]</span> Simpan &amp; Tutup
      </v-btn>
      <v-btn
        v-if="props.showSavePrint"
        size="small"
            class="tb-btn tb-btn-neutral"
            @click="openConfirmPrint()"
        :loading="isSaving"
        :disabled="isSaving"
      >
        <template #prepend><MsIcon name="print" :size="14" /></template>
        <span class="tb-fkey">[F12]</span> Simpan &amp; Cetak
      </v-btn>
    </template>

    <v-overlay
      :model-value="isLoading"
      class="align-center justify-center"
      persistent
      scroll-strategy="none"
    >
      <v-progress-circular indeterminate color="primary" size="56" />
    </v-overlay>

    <div
      v-if="!isLoading"
      ref="formBody"
      :class="[
        'form-grid-container',
        $slots['left-column'] &&
        $slots['center-column'] &&
        $slots['right-column']
          ? 'three-column'
          : $slots['left-column'] && $slots['right-column']
            ? 'two-column'
            : !$slots['left-column'] && $slots['right-column']
              ? 'single-column'
              : 'custom-layout',
      ]"
    >
      <template v-if="$slots['left-column'] || $slots['right-column']">
        <aside class="left-column" v-if="$slots['left-column']">
          <slot name="left-column" />
        </aside>
        <main class="center-column" v-if="$slots['center-column']">
          <slot name="center-column" />
        </main>
        <main class="right-column" v-if="$slots['right-column']">
          <slot name="right-column" />
        </main>
      </template>
      <template v-else>
        <main class="full-column"><slot /></main>
      </template>
    </div>

    <!-- Dialog Konfirmasi Simpan -->
    <v-dialog v-model="confirmDialog" max-width="420" persistent>
      <v-card rounded="false">
        <!-- Bar Steel Blue, bukan merah: menyimpan bukan aksi merusak. -->
        <div class="cs-title">
          <MsIcon name="save" :size="16" class="cs-title-icon" />
          <span class="cs-title-text">Konfirmasi Simpan</span>
          <button
            type="button"
            class="cs-close"
            title="Batal (Esc)"
            aria-label="Batal"
            @click="confirmDialog = false"
          >
            <MsIcon name="close" :size="16" />
          </button>
        </div>

        <div class="cs-body">
          <p class="cs-text">
            Yakin ingin menyimpan
            {{ itemName ? `data ${itemName}` : "data ini" }}?
            {{ confirmEffect }}
          </p>
          <div v-if="$slots['dialog-warning']" class="cs-warning">
            <slot name="dialog-warning" />
          </div>
        </div>

        <div class="cs-foot">
          <span class="cs-hint"><kbd>Esc</kbd> batal</span>
          <v-btn size="small" variant="text" @click="confirmDialog = false">
            Batal
          </v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            @click="doSave"
            :loading="isSaving"
            :disabled="isSaving"
          >
            Ya, Simpan
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
.form-grid-container :deep(*) {
  font-size: 11px !important;
}
.form-grid-container {
  padding: 12px;
  height: 100%;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 12px;
  background: var(--ds-bg, #E8ECF1);
}
.form-grid-container.three-column {
  grid-template-columns: 280px 1fr 200px;
}
.form-grid-container.single-column {
  grid-template-columns: 1fr;
}
.form-grid-container.custom-layout {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  overflow: hidden;
  /* Putih seperti DOFormView: form custom-layout membawa layout sendiri,
     jangan mewarisi abu window (#E8ECF1) varian grid. */
  background: #FDFDFE;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.right-column {
  flex-grow: 1;
  overflow: hidden;
  min-width: 0;
}
.center-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex-grow: 1;
}
.full-column {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* Section card di dalam form */
:deep(.desktop-form-section) {
  padding: 14px 16px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  background: white !important;
  margin-bottom: 12px;
  box-shadow: none !important;
  position: relative;
}
:deep(.section-title) {
  font-size: 12px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ds-primary-darker, #78350F) !important;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  padding-bottom: 6px;
  margin-bottom: 10px;
}
:deep(.header-section) {
  border-top: 3px solid var(--ds-primary, #D97706) !important;
}
.tb-fkey {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.85;
}

.form-left-col {
  overflow-y: auto;
  height: 100%;
  min-height: 0;
}

/* ── Responsif ── */
@media (max-width: 1280px) {
  .form-grid-container {
    grid-template-columns: 280px 1fr;
    gap: 12px;
    padding: 10px;
    height: 100%;
  }
  .form-grid-container.three-column {
    grid-template-columns: 240px 1fr 180px;
  }
}

@media (max-width: 1024px) {
  .form-grid-container {
    grid-template-columns: 1fr !important;
    grid-template-rows: auto;
    height: auto;
    min-height: 100%;
    overflow-y: auto;
    padding: 8px;
    gap: 10px;
  }
  .form-grid-container.three-column {
    grid-template-columns: 1fr !important;
  }
  .full-column {
    height: auto;
    min-height: 400px;
    overflow: visible;
  }
  .left-column {
    min-height: unset;
  }
  .right-column {
    min-width: unset;
  }
  :deep(.desktop-form-section) {
    padding: 10px 12px;
    margin-bottom: 8px;
  }
}

@media (max-width: 768px) {
  .form-grid-container {
    padding: 4px;
    gap: 6px;
  }
  .form-grid-container :deep(*) {
    font-size: 10px !important;
  }
  :deep(.desktop-form-section) {
    padding: 8px 10px;
    margin-bottom: 6px;
    border-radius: 6px;
  }
}

/* ── Dialog konfirmasi simpan ───────────────────────────────────────── */
/* Struktur mengikuti dialog konfirmasi hapus di BaseBrowse: bar judul padat,
   baris fakta, kalimat, lalu footer berisi petunjuk Esc. Warnanya Steel Blue,
   bukan merah, karena menyimpan bukan aksi merusak. */
.cs-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  background: var(--ds-primary, #D97706);
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
}
/* Kelas eksplisit, bukan `> span`: ikon Material Symbol juga elemen span,
   jadi pemilih `> span` akan ikut meregangkan ikonnya. */
.cs-title-icon {
  flex: 0 0 auto;
}
.cs-title-text {
  flex: 1 1 auto;
  min-width: 0;
}
.cs-close {
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
.cs-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Outline Steel Blue tak akan terlihat di atas bar biru. */
.cs-close:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}
.cs-body {
  padding: 14px;
}
.cs-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text, #78350F);
}
.cs-warning {
  margin-top: 10px;
}
.cs-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--ds-border-light, #C4CAD3);
  background: var(--ds-surface, #F0F3F8);
}
.cs-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 10.5px;
  color: var(--ds-text-secondary, #5A6A7E);
}
.cs-hint kbd {
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
