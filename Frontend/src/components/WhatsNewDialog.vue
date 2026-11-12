<script setup lang="ts">
import { computed, ref } from "vue";
import { useWhatsNew } from "@/composables/useWhatsNew";
import { reloadNow } from "@/composables/useAppReload";
import { visibleReleases } from "@/utils/changelog";

const {
  entries,
  unreadVersions,
  open,
  version,
  isLoading,
  hasError,
  isStaleBuild,
  buildVersion,
  close,
} = useWhatsNew();

// Arsip rilis lama disembunyikan secara default; user membukanya kalau perlu.
const showArchive = ref(false);

const releases = computed(() => visibleReleases(entries.value, unreadVersions.value, showArchive.value));

// Rilis teratas mengisi ringkasan di bawah judul, dan sekaligus penanda apakah
// ada isi yang bisa ditampilkan (mode "new" bisa kosong tanpa error).
const lead = computed(() => releases.value.visible[0] ?? null);

const isUnread = (v: string) => unreadVersions.value.includes(v);

const showMoreBtn = computed(() =>
  showArchive.value ? entries.value.length > 1 : releases.value.hiddenCount > 0,
);
const moreLabel = computed(() =>
  showArchive.value
    ? "Sembunyikan riwayat lama"
    : `Lihat ${releases.value.hiddenCount} versi sebelumnya`,
);

// Tombol muat ulang ikut syarat petunjuknya: hanya saat data versi sudah terbaca.
const canReload = computed(() => isStaleBuild.value && !hasError.value && !isLoading.value);

// "2026-08-24" -> "24 Agustus 2026"
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card rounded="false">
      <v-card-title class="wn-title">Apa yang Baru</v-card-title>

      <div v-if="lead && !isLoading && !hasError" class="wn-summary">
        <span class="wn-summary-ver ds-data ds-data-bold">v{{ lead.version }}</span>
        <span v-if="lead.date" class="wn-summary-date">{{ formatDate(lead.date) }}</span>
        <span class="wn-summary-count">{{ releases.noteCount }} perubahan</span>
      </div>

      <v-card-text class="wn-body">
        <p v-if="isLoading" class="wn-state">
          <span class="wn-spinner" aria-hidden="true" />
          Memuat catatan rilis...
        </p>

        <p v-else-if="hasError" class="wn-state wn-state-error">
          Catatan rilis gagal dimuat. Periksa koneksi ke server, lalu buka panel ini lagi.
        </p>

        <p v-else-if="!lead" class="wn-state">Belum ada catatan rilis.</p>

        <template v-else>
          <section
            v-for="entry in releases.visible"
            :key="entry.version"
            class="wn-release ds-panel"
          >
            <div class="wn-header ds-panel-header" :class="{ 'wn-header-read': !isUnread(entry.version) }">
              <span class="wn-release-ver">Versi {{ entry.version }}</span>
              <span v-if="isUnread(entry.version)" class="ds-badge blue">belum dibaca</span>
              <span v-if="entry.date" class="wn-release-date">{{ formatDate(entry.date) }}</span>
            </div>
            <div class="ds-panel-body">
              <ul class="wn-notes">
                <li v-for="(note, i) in entry.notes" :key="i">{{ note }}</li>
              </ul>
            </div>
          </section>

          <v-btn v-if="showMoreBtn" class="tb-btn wn-more" block @click="showArchive = !showArchive">
            <svg class="wn-chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path
                v-if="showArchive"
                d="M2 8l4-4 4 4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path v-else d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
            {{ moreLabel }}
          </v-btn>

          <p v-if="canReload" class="wn-notice">
            Browser ini masih memakai versi {{ buildVersion }}. Muat ulang untuk memakai versi
            {{ version || "terbaru" }}.
          </p>
        </template>
      </v-card-text>

      <v-card-actions class="wn-actions">
        <v-btn v-if="canReload" variant="text" size="small" @click="reloadNow()">Muat ulang</v-btn>
        <v-spacer />
        <v-btn class="tb-btn tb-btn-primary" size="small" @click="close">Mengerti</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.wn-title {
  font-size: 14px;
  font-weight: 700;
  border-top: 3px solid var(--ds-primary, #D97706);
  padding: 14px 16px 10px;
}

/* Ringkasan versi teratas. Letaknya di luar area gulir, jadi tetap terlihat
   sementara daftar rilis di bawahnya digulir. */
.wn-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px 8px;
  padding: 7px 16px;
  background: var(--ds-surface, #f0f3f8);
  border-top: 1px solid var(--ds-border-light, #c4cad3);
  border-bottom: 1px solid var(--ds-border-light, #c4cad3);
  font-size: 11px;
  color: var(--ds-text-secondary, #5a6a7e);
}
.wn-summary-ver {
  font-size: 12px;
}
.wn-summary-count {
  margin-left: auto;
}

/* Ukuran huruf tidak diatur di sini: dialog Vuetify memakai `inherit`, jadi
   teks panel ikut basis 11px aplikasi seperti halaman lain. */
.wn-body {
  padding: 12px 16px;
}

.wn-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ds-text-secondary, #5a6a7e);
}
.wn-state-error {
  color: var(--ds-error, #dc2626);
  font-weight: 600;
}

/* Satu blok per rilis: memakai panel milik design system, bukan gaya baru. */
.wn-release {
  margin-bottom: 10px;
}
.wn-release:last-of-type {
  margin-bottom: 0;
}
/* Rilis yang sudah dibaca turun prioritas: header netral, bukan Steel Blue. */
.wn-header-read {
  background: var(--ds-surface, #f0f3f8);
  border-bottom-color: var(--ds-border, #a0aab8);
  color: var(--ds-text, #78350F);
}
.wn-header {
  /* Judul + tanggal boleh turun baris di layar sempit, bukan melimpah. */
  flex-wrap: wrap;
}
.wn-release-ver {
  font-family: var(--ds-font-mono);
}
/* Header panel uppercase; tanggal & badge tetap huruf aslinya. Warna tanggal
   ditulis per varian header supaya kontrasnya pasti, bukan hasil transparansi. */
.wn-release-date {
  margin-left: auto;
  text-transform: none;
  font-weight: 500;
  color: var(--ds-primary-50, #e8edf5);
}
.wn-header-read .wn-release-date {
  color: var(--ds-text-secondary, #5a6a7e);
}
.wn-release :deep(.ds-badge) {
  text-transform: none;
  font-weight: 600;
}

.wn-notes {
  margin: 0;
  padding-left: 16px;
  line-height: 1.55;
  color: var(--ds-text, #78350F);
  overflow-wrap: anywhere;
}
.wn-notes li + li {
  margin-top: 4px;
}

.wn-more {
  margin-top: 10px;
}
.wn-chevron {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

.wn-notice {
  margin: 10px 0 0;
  padding: 7px 9px;
  background: var(--ds-primary-50, #e8edf5);
  border-left: 3px solid var(--ds-primary, #D97706);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ds-text, #78350F);
}

.wn-actions {
  padding: 8px 16px 14px;
  border-top: 1px solid var(--ds-border-light, #c4cad3);
}

/* Satu-satunya gerak di panel ini: penanda proses memuat. */
.wn-spinner {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border: 2px solid var(--ds-border-light, #c4cad3);
  border-top-color: var(--ds-primary, #D97706);
  border-radius: 50%;
  animation: wn-spin 0.7s linear infinite;
}
@keyframes wn-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wn-spinner {
    animation-duration: 1.6s;
  }
}
</style>
