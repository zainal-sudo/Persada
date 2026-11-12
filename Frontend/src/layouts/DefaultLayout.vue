<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import api from "@/api/axios";
import { useToast } from "vue-toastification";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { useTabsStore } from "@/stores/tabsStore";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import TabBar from "@/components/TabBar.vue";
import TabView from "@/components/TabView.vue";
import ChatWidget from "@/components/ChatWidget.vue";
import WhatsNewDialog from "@/components/WhatsNewDialog.vue";
import MsIcon from "@/components/MsIcon.vue";
import { useLatency } from "@/composables/useLatency";
import { useWhatsNew } from "@/composables/useWhatsNew";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const tabsStore = useTabsStore();
const toast = useToast();
const { latency, online, host, database } = useLatency();
const { init: initWhatsNew } = useWhatsNew();

const isMobile = ref(false);

// Sidebar tersembunyi/terbuka, simpan ke localStorage supaya pilihan user
// tidak hilang tiap reload. Key: null = belum pernah memilih → buka (desktop).
const SIDEBAR_KEY = "bsm_sidebar";
const sidebarOpen = ref(localStorage.getItem(SIDEBAR_KEY) !== "0");
// Klik user = pilihan yang disimpan. Penyesuaian karena pindah breakpoint
// hanya untuk tampilan sesi ini, jangan menimpa preferensi desktop.
const setSidebar = (v: boolean, persist = true) => {
  sidebarOpen.value = v;
  if (persist) localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
};
const toggleSidebar = () => setSidebar(!sidebarOpen.value);

const updateMobile = () => {
  const mobile = window.innerWidth <= 768;
  if (mobile !== isMobile.value) setSidebar(!mobile, false);
  isMobile.value = mobile;
};

// ── State Ganti Password ──────────────────────────────────────────────
const showPasswordDialog = ref(false);
const pwForm = ref({ oldPassword: "", newPassword: "", confirmPassword: "" });
const pwSaving = ref(false);
const pwError = ref("");

const userName = computed(() => authStore.userName);
const userCabang = computed(() => authStore.userCabang);

const openPasswordDialog = () => {
  pwForm.value = { oldPassword: "", newPassword: "", confirmPassword: "" };
  pwError.value = "";
  showPasswordDialog.value = true;
};

const submitChangePassword = async () => {
  pwError.value = "";
  if (!pwForm.value.oldPassword) {
    pwError.value = "Password lama wajib diisi.";
    return;
  }
  if (!pwForm.value.newPassword) {
    pwError.value = "Password baru wajib diisi.";
    return;
  }
  if (pwForm.value.newPassword !== pwForm.value.confirmPassword) {
    pwError.value = "Konfirmasi password tidak cocok.";
    return;
  }
  pwSaving.value = true;
  try {
    await api.post("/auth/change-password", pwForm.value);
    showPasswordDialog.value = false;
    toast.success("Password berhasil diganti.");
  } catch (e: any) {
    pwError.value = e.response?.data?.message || "Gagal mengganti password.";
  } finally {
    pwSaving.value = false;
  }
};

const logout = () => {
  tabsStore.resetTabs();
  authStore.logout();
  router.push("/login");
};

const goToSettingPrinter = () => {
  router.push({ name: "settingPrinter" });
};

// ── Menu grup (sidebar) untuk breadcrumb ─────────────────────────────
interface NavItem {
  title: string;
  icon: any;
  route?: string;
  children?: NavItem[];
}

const MENU_ICONS: Record<string, string> = {
  "pi pi-list": "format_list_bulleted",
  "pi pi-box": "inventory_2",
  "pi pi-shopping-cart": "shopping_cart",
  "pi pi-wallet": "account_balance_wallet",
  "pi pi-credit-card": "credit_card",
  "pi pi-file-plus": "note_add",
  "pi pi-cog": "settings",
  "pi pi-folder": "folder",
  "pi pi-chart-line": "monitoring",
  "pi pi-users": "group",
  "pi pi-user": "person",
  "pi pi-money-bill": "payments",
  "pi pi-truck": "local_shipping",
};
const fallbackIcon = "format_list_bulleted";
const resolveIcon = (name?: string | null) =>
  (name && MENU_ICONS[name]) || fallbackIcon;

const dbMenus = computed<NavItem[]>(() => {
  const tree = permissionStore.sidebarTree;
  if (!tree || tree.length === 0) return [];
  return tree
    .map((g: any) => ({
      title: g.label,
      icon: resolveIcon(g.icon),
      children: (g.items || [])
        .filter((it: any) => it.to)
        .map((it: any) => ({
          title: it.label,
          icon: resolveIcon(it.icon),
          route: it.to,
        })),
    }))
    .filter((g) => g.children.length > 0);
});

const filteredMenus = computed(() => {
  return dbMenus.value
    .map((menu) => ({
      ...menu,
      children: (menu.children || []).filter(
        (child) =>
          child.route && permissionStore.canAccessRoute(child.route),
      ),
    }))
    .filter((menu) => menu.children.length > 0);
});

// Grup sidebar yang berisi route aktif → dipakai breadcrumb
const activeBreadcrumbGroup = computed(() => {
  const g = filteredMenus.value.find((menu) =>
    (menu.children || []).some((c) => c.route === route.path),
  );
  return g?.title || "";
});

const activeTabTitle = computed(() => tabsStore.activeTab?.title || "");

// ── Menu Bar (toolbar dropdown) — grup mp_menubar = 1 ───────────────
const menuBarMenus = computed<NavItem[]>(() => {
  const tree = permissionStore.menuBarTree;
  if (!tree || tree.length === 0) return [];
  return tree
    .map((g: any) => ({
      title: g.label,
      icon: resolveIcon(g.icon),
      children: (g.items || [])
        .filter((it: any) => it.to)
        .map((it: any) => ({
          title: it.label,
          icon: resolveIcon(it.icon),
          route: it.to,
        })),
    }))
    .filter((g) => g.children.length > 0);
});

const filteredMenuBar = computed(() => {
  return menuBarMenus.value
    .map((menu) => ({
      ...menu,
      children: (menu.children || []).filter(
        (child) => child.route && permissionStore.canAccessRoute(child.route),
      ),
    }))
    .filter((menu) => menu.children.length > 0);
});

const isActive = (target: string) => route.path === target;

const openMenuBar = ref<string | null>(null);
const menuBarDropdown = ref<Record<string, string>>({});

const toggleMenuBar = (title: string, e: Event) => {
  const btn = e.currentTarget as HTMLElement;
  if (openMenuBar.value === title) {
    openMenuBar.value = null;
    return;
  }
  openMenuBar.value = title;
  const rect = btn.getBoundingClientRect();
  const dropdownWidth = 225;
  const padding = 12;
  let left = window.scrollX + rect.left;
  if (left + dropdownWidth > window.innerWidth - padding) {
    left = window.innerWidth - dropdownWidth - padding;
  }
  left = Math.max(padding, left);
  menuBarDropdown.value = {
    left: `${left}px`,
    top: `${window.scrollY + rect.bottom + 4}px`,
  };
};

const onMenuBarDocClick = (e: MouseEvent) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".menubar") && !t.closest(".menubar-dropdown"))
    openMenuBar.value = null;
};

const onMenuBarKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") openMenuBar.value = null;
};

onMounted(() => {
  updateMobile();
  window.addEventListener("resize", updateMobile);
  document.addEventListener("click", onMenuBarDocClick);
  window.addEventListener("keydown", onMenuBarKey);
  initWhatsNew();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateMobile);
  document.removeEventListener("click", onMenuBarDocClick);
  window.removeEventListener("keydown", onMenuBarKey);
});
</script>

<template>
  <v-app class="app-shell">
    <div class="app-shell-body">
      <!-- 1. Sidebar Kiri 220px -->
      <AppSidebar :class="{ 'is-collapsed': !sidebarOpen }" />

      <!-- 2. Area Kerja Kanan -->
      <div class="app-shell-work">
        <!-- Top Toolbar 34px -->
        <header class="app-topbar">
          <div class="app-topbar-crumb">
            <button
              class="app-topbar-btn"
              @click="toggleSidebar"
              style="padding: 2px 6px"
              :title="sidebarOpen ? 'Sembunyikan menu' : 'Tampilkan menu'"
              :aria-label="sidebarOpen ? 'Sembunyikan menu' : 'Tampilkan menu'"
              :aria-expanded="sidebarOpen"
            >
              <MsIcon :name="sidebarOpen ? 'menu_open' : 'menu'" :size="15" />
            </button>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ activeBreadcrumbGroup || "Aplikasi" }}
            </span>
            <span v-if="activeBreadcrumbGroup" class="app-topbar-crumb-sep">/</span>
            <strong class="app-topbar-crumb-strong" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ activeTabTitle || "Dashboard" }}
            </strong>
          </div>

          <div class="app-topbar-actions">
            <!-- Menu Bar (toolbar dropdown) — grup mp_menubar = 1 -->
            <div v-if="filteredMenuBar.length > 0" class="menubar">
              <template v-for="menu in filteredMenuBar" :key="menu.title">
                <button
                  class="menubar-btn"
                  :class="{ 'is-open': openMenuBar === menu.title }"
                  @click.prevent="toggleMenuBar(menu.title, $event)"
                  :title="menu.title"
                >
                  <MsIcon :name="menu.icon" :size="14" class="menubar-ico" />
                  <span>{{ menu.title }}</span>
                  <MsIcon name="expand_more" :size="12" class="menubar-caret" />
                </button>
              </template>
            </div>

            <!-- Dropdown custom (flat, classic) — Teleport ke body -->
            <Teleport to="body">
              <div
                v-if="openMenuBar"
                class="menubar-dropdown"
                :style="menuBarDropdown"
              >
                <template v-for="menu in filteredMenuBar" :key="menu.title">
                  <div v-if="openMenuBar === menu.title" class="menubar-dropdown-card">
                    <span class="menubar-dropdown-head">{{ menu.title }}</span>
                    <div class="menubar-dropdown-list">
                      <router-link
                        v-for="child in menu.children"
                        :key="child.title"
                        class="menubar-dropdown-item"
                        :class="{ 'is-active': isActive(child.route || '') }"
                        :to="child.route || ''"
                        @click="openMenuBar = null"
                      >
                        <MsIcon :name="child.icon" :size="13" class="menubar-item-ico" />
                        <span>{{ child.title }}</span>
                      </router-link>
                    </div>
                  </div>
                </template>
              </div>
            </Teleport>

            <div class="app-topbar-sep" />

            <!-- User menu -->
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <div class="app-topbar-user" v-bind="props" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 2px 4px;">
                  <div class="app-topbar-avatar">
                    {{ userName.charAt(0).toUpperCase() }}
                  </div>
                  <div style="line-height: 1.15; display: none" class="app-topbar-userinfo">
                    <div style="font-size: 11px; font-weight: 600; color: var(--ds-primary-darker)">{{ userName }}</div>
                    <div style="font-size: 10px; color: var(--ds-text-secondary)">{{ userCabang }}</div>
                  </div>
                </div>
              </template>
              <v-list density="compact" class="user-menu">
                <v-list-item @click="openPasswordDialog">
                  <template #prepend>
                    <MsIcon name="lock" :size="15" class="mr-2" style="color: #D97706" />
                  </template>
                  <v-list-item-title style="font-size: 13px">Ganti Password</v-list-item-title>
                </v-list-item>
                <v-list-item @click="goToSettingPrinter">
                  <template #prepend>
                    <MsIcon name="print" :size="15" class="mr-2" style="color: #D97706" />
                  </template>
                  <v-list-item-title style="font-size: 13px">Setting Printer</v-list-item-title>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item @click="logout">
                  <template #prepend>
                    <MsIcon name="logout" :size="15" class="mr-2" style="color: #c62828" />
                  </template>
                  <v-list-item-title style="font-size: 13px; color: #c62828">Keluar</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </header>

        <!-- Tab Bar 34px -->
        <TabBar v-if="tabsStore.isReady && tabsStore.tabs.length > 0" />

        <!-- Main Content -->
        <main class="app-main">
          <TabView />
        </main>

        <!-- Footer Status Bar 24px -->
        <footer class="app-footer">
          <div class="app-footer-left">
            <span><kbd class="app-footer-kbd">UP/DOWN</kbd> Navigasi</span>
            <span><kbd class="app-footer-kbd">ENTER</kbd> Buka Data</span>
            <span><kbd class="app-footer-kbd">ALT+1..5</kbd> Pindah Tab</span>
            <span><kbd class="app-footer-kbd">CTRL+W</kbd> Tutup Tab</span>
          </div>
          <div class="app-footer-right">
            <span
              :style="{ color: online ? '#059669' : '#DC2626', fontWeight: 700 }"
            >
              &#9679; {{ online ? `Server: ${host} · ${database}` : "Server offline" }}
            </span>
            <span class="app-footer-latency">
              DB Latency: <b>{{ online ? `${latency ?? "--"}ms` : "-" }}</b>
            </span>
          </div>
        </footer>
      </div>
    </div>

    <ChatWidget v-if="authStore.isAiUser" />
  </v-app>

  <WhatsNewDialog />

  <!-- Dialog Ganti Password -->
  <v-dialog v-model="showPasswordDialog" max-width="380" persistent>
    <v-card rounded="false">
      <v-card-title class="pw-dialog-title">
        <MsIcon name="lock" :size="18" style="color: #2E5090" />
        Ganti Password
      </v-card-title>
      <v-card-text class="pa-4 pt-2">
        <div class="pw-field">
          <label class="pw-lbl">Password Lama</label>
          <input
            v-model="pwForm.oldPassword"
            type="password"
            class="pw-inp"
            placeholder="Masukkan password lama"
            autocomplete="current-password"
          />
        </div>
        <div class="pw-field">
          <label class="pw-lbl">Password Baru</label>
          <input
            v-model="pwForm.newPassword"
            type="password"
            class="pw-inp"
            placeholder="Masukkan password baru"
            autocomplete="new-password"
          />
        </div>
        <div class="pw-field">
          <label class="pw-lbl">Ulangi Password Baru</label>
          <input
            v-model="pwForm.confirmPassword"
            type="password"
            class="pw-inp"
            placeholder="Ketik ulang password baru"
            autocomplete="new-password"
            @keydown.enter="submitChangePassword"
          />
        </div>
        <div v-if="pwError" class="pw-error">{{ pwError }}</div>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn variant="text" size="small" @click="showPasswordDialog = false">Batal</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="pwSaving"
          @click="submitChangePassword"
        >
          Simpan
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Shell penuh 1:1 — tanpa zoom global (space kosong bawah hilang) */

.app-shell {
  background: var(--ds-bg, #E8ECF1) !important;
}

.app-shell-body {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-shell-work {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-main {
  flex: 1;
  min-height: 0;
}
.app-main :deep(.tab-view) {
  height: 100%;
}
.app-main :deep(.desktop-mode) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* ── Menu Bar (toolbar dropdown) ── */
.menubar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  margin-left: 6px;
  overflow: hidden;
  border-left: 1px solid var(--ds-border, #C4CAD3);
  padding-left: 6px;
}
.menubar-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.menubar-btn.is-open,
.menubar-btn:hover {
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #D97706);
}
.menubar-ico { color: var(--ds-primary, #D97706); }
.menubar-caret { color: #8494a7; }
.menubar-item-ico { color: var(--ds-primary, #D97706); }

.menubar-dropdown {
  position: absolute;
  z-index: 2200;
  width: 225px;
}
.menubar-dropdown-card {
  background: #ffffff;
  border: 1px solid var(--ds-border, #A0AAB8);
}
.menubar-dropdown-list {
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.menubar-dropdown-head {
  display: block;
  padding: 6px 10px 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: var(--ds-text-muted, #8494A7);
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
}
.menubar-dropdown-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  font-size: 11.5px;
  color: #2b3747;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.menubar-dropdown-item:hover {
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #D97706);
}
.menubar-dropdown-item.is-active {
  border-left-color: var(--ds-primary, #D97706);
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #D97706);
  font-weight: 600;
}

/* ── User menu ── */
.user-menu {
  min-width: 170px !important;
}

/* ── Password dialog ── */
.pw-dialog-title {
  font-size: 14px !important;
  font-weight: 700 !important;
  border-top: 3px solid #D97706;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 12px;
}
.pw-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.pw-field:last-of-type { margin-bottom: 0; }
.pw-lbl { font-size: 12px; font-weight: 600; color: #4b5563; }
.pw-inp {
  height: 36px;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  padding: 0 10px;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.pw-inp:focus { border-color: var(--ds-primary, #D97706); }
.pw-error {
  font-size: 12px;
  color: #c62828;
  font-weight: 600;
  background: #ffebee;
  border-radius: 0;
  padding: 8px 10px;
  margin-top: 10px;
}

/* ── Responsif ── */
@media (max-width: 768px) {
  .app-topbar-userinfo { display: none; }
  .menubar { display: none; }
}
</style>