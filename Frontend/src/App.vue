<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import BlankLayout from "@/layouts/BlankLayout.vue";
import { IconLock } from "@tabler/icons-vue";
import ReloadRequiredDialog from "@/components/ReloadRequiredDialog.vue";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { useTabsStore } from "@/stores/tabsStore";
import { clearAllViewSessions, isPageRefresh } from "@/utils/viewSession";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const tabsStore = useTabsStore();

const layout = computed(() => {
  const l = route.meta?.layout as string | undefined;
  if (l === "BlankLayout") return BlankLayout;
  return DefaultLayout;
});

// ── Session expired ───────────────────────────────────────────────────
const showExpiredDialog = ref(false);

const onAuthExpired = () => {
  console.log("auth:expired received, showing dialog");
  showExpiredDialog.value = true;
};

onMounted(() => {
  // 0. Jika refresh (F5/Ctrl+R), bersihkan semua state view agar reset ke awal
  if (isPageRefresh()) {
    clearAllViewSessions();
  }

  // 0. Muat ulang menu & hak akses saat halaman di-refresh (restore session)
  if (authStore.isAuthenticated && !permissionStore.loaded) {
    permissionStore.fetchAll();
  }

  window.addEventListener("auth:expired", onAuthExpired);
});
onUnmounted(() => {
  window.removeEventListener("auth:expired", onAuthExpired);
});

const goToLogin = () => {
  showExpiredDialog.value = false;
  tabsStore.resetTabs(); // ← kosongkan tab bar
  authStore.logout(); // ← hapus token + user dari store dan localStorage
  router.push("/login");
};
</script>

<template>
  <component :is="layout" />

  <!-- ── Dialog Session Expired ── -->
  <v-dialog v-model="showExpiredDialog" max-width="380" persistent>
    <v-card rounded="false">
      <v-card-item>
        <template #prepend>
          <v-avatar color="warning" variant="tonal" size="42">
            <IconLock :size="22" :stroke-width="1.8" color="#f57c00" />
          </v-avatar>
        </template>
        <v-card-title class="text-body-1 font-weight-bold">
          Sesi Berakhir
        </v-card-title>
      </v-card-item>
      <v-card-text class="text-body-2 pb-1">
        Token login Anda sudah <strong>expired</strong> atau tidak valid.<br />
        Silakan login kembali untuk melanjutkan.
      </v-card-text>
      <v-card-actions class="pa-4 pt-2">
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="goToLogin">
          Login Kembali
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Dialog "aplikasi sudah diperbarui" ── -->
  <ReloadRequiredDialog />
</template>
