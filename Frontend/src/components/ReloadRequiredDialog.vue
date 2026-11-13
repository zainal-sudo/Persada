<script setup lang="ts">
import { computed } from "vue";
import {
  reloadBlockReason,
  dismissReloadNotice,
  reloadNow,
} from "@/composables/useAppReload";

const reason = computed(() => reloadBlockReason());

const isOpen = computed({
  get: () => reason.value !== null,
  set: (v: boolean) => {
    if (!v) dismissReloadNotice();
  },
});

const title = computed(() => {
  switch (reason.value) {
    case "dev":
      return "Mode Pengembangan";
    case "loop":
      return "Muat Ulang Gagal Berulang";
    default:
      return "Aplikasi Sudah Diperbarui";
  }
});

// Tiap alasan menyebut sebab dan langkah berikutnya, bukan satu pesan generik:
// user perlu tahu apakah isiannya sedang berisiko atau tidak.
const body = computed(() => {
  switch (reason.value) {
    case "unsaved":
      return "Halaman yang Anda tuju berasal dari versi aplikasi lama yang berkasnya sudah tidak ada di server, jadi tidak bisa dibuka. Isian Anda yang belum tersimpan masih aman di form ini. Simpan dulu, lalu muat ulang untuk memakai versi terbaru.";
    case "formOpen":
      return "Halaman yang Anda tuju berasal dari versi aplikasi lama yang berkasnya sudah tidak ada di server. Ada form yang sedang terbuka, jadi isian yang belum tersimpan bisa hilang kalau dimuat ulang sekarang. Periksa dulu form Anda, lalu muat ulang.";
    case "loop":
      return "Aplikasi sudah dicoba dimuat ulang sendiri, tetapi berkas versi barunya tetap tidak ditemukan. Hubungi admin lebih dulu, lalu muat ulang setelah servernya diperbaiki.";
    case "dev":
      return "Muat ulang otomatis dimatikan di mode pengembangan supaya isian form tidak terhapus saat Anda bekerja. Vite tetap memuat ulang sendiri kalau dependensinya berubah.";
    default:
      return "";
  }
});
</script>

<template>
  <v-dialog v-model="isOpen" max-width="460">
    <v-card rounded="false">
      <v-card-title class="rr-title">{{ title }}</v-card-title>

      <v-card-text class="rr-body">{{ body }}</v-card-text>

      <v-card-actions class="rr-actions">
        <v-btn variant="text" size="small" @click="dismissReloadNotice">Nanti</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" size="small" @click="reloadNow(true)">
          Muat ulang sekarang
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.rr-title {
  font-size: 14px;
  font-weight: 700;
  border-top: 3px solid var(--ds-primary, #0284c7);
  padding: 16px 16px 12px;
}
.rr-body {
  padding: 0 16px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ds-text, #0c4a6e);
}
.rr-actions {
  padding: 8px 16px 16px;
}
</style>
