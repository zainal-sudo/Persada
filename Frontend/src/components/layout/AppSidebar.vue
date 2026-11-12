<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { useTabsStore } from "@/stores/tabsStore";
import { useLatency } from "@/composables/useLatency";
import { useWhatsNew } from "@/composables/useWhatsNew";
import MsIcon from "@/components/MsIcon.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const tabsStore = useTabsStore();
const { online } = useLatency();
const { version, openAll: openWhatsNew } = useWhatsNew();

const searchKeyword = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);

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
const resolveIcon = (name?: string | null): string | null =>
  (name && MENU_ICONS[name]) || null;

// ── Menu tree dari DB, difilter hak akses ────────────────────────────
const menuGroups = computed(() => {
  const tree = permissionStore.sidebarTree;
  if (!tree || tree.length === 0) return [];
  const groups: {
    title: string;
    icon: string | null;
    items: { label: string; icon: string | null; route: string; menu_id: number }[];
  }[] = [];
  tree.forEach((g: any) => {
    const items = (g.items || [])
      .filter((it: any) => it.to && permissionStore.canAccessRoute(it.to))
      .map((it: any) => ({
        label: it.label,
        icon: resolveIcon(it.icon),
        route: it.to,
        menu_id: Number(it.menu_id),
      }));
    if (items.length > 0) {
      groups.push({ title: g.label, icon: resolveIcon(g.icon), items });
    }
  });
  return groups;
});

// ── Cari modul ───────────────────────────────────────────────────────
const filteredMenuGroups = computed(() => {
  const q = searchKeyword.value.trim().toLowerCase();
  if (!q) return menuGroups.value;
  return menuGroups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0);
});

const isActive = (path: string) => route.path === path;

// Item menu grup "Penjualan" (urutan men_order sudah sesuai) — satu-satunya
// grup yang mendapat hotkey Alt+1..9. Pakai filteredMenuGroups agar nomor
// konsisten dengan item yang sedang dirender (termasuk saat pencarian aktif).
const penjualanItems = computed<{ label: string; route: string; menu_id: number }[]>(
  () => filteredMenuGroups.value.find((g) => g.title === "Penjualan")?.items ?? [],
);

const navigate = (item: { label: string; route: string }) => {
  tabsStore.openTab({ title: item.label, path: item.route, closable: item.route !== "/" });
  router.push(item.route);
};

// Alt+1..9 → menu grup Penjualan urutan ke-n (di luar jangkauan → diam).
const onAltNav = (e: Event) => {
  const n = (e as CustomEvent<number>).detail;
  const item = penjualanItems.value[n - 1];
  if (item) navigate(item);
};

const onSearchKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInputRef.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onSearchKeydown);
  document.addEventListener("erp:alt-nav", onAltNav as EventListener);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onSearchKeydown);
  document.removeEventListener("erp:alt-nav", onAltNav as EventListener);
});
</script>

<template>
  <aside class="app-sidebar">
    <!-- Top Section -->
    <div class="app-sidebar-top" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <!-- Brand Title Bar -->
      <div class="app-sidebar-brand">
        <div class="app-sidebar-brand-badge">krm</div>
        <div style="line-height: 1.15; min-width: 0">
          <div class="app-sidebar-brand-title">Kali Rejo Makmur</div>
          <button
            type="button"
            class="app-sidebar-brand-ver"
            title="Lihat catatan rilis"
            @click="openWhatsNew"
          >
            Distribusi Alkes {{ version ? `v${version}` : "" }}
          </button>
        </div>
      </div>

      <!-- Telemetry Cabang & Server -->
      <div class="app-sidebar-telemetry">
        <div class="app-sidebar-telemetry-row">
          <span class="app-sidebar-cabang-label">
            Cabang: <strong class="app-sidebar-cabang-val">{{ authStore.userCabang || "-" }}</strong>
          </span>
          <span class="app-sidebar-online">{{ online ? "[ONLINE]" : "[OFFLINE]" }}</span>
        </div>
      </div>

      <!-- Quick Search Modul (Ctrl+K) -->
      <div class="app-sidebar-search">
        <input
          ref="searchInputRef"
          v-model="searchKeyword"
          type="text"
          placeholder="Cari modul (Ctrl+K)..."
        />
        <kbd>^K</kbd>
      </div>

      <!-- Module Menu Tree -->
      <nav class="app-sidebar-nav">
        <div v-for="(group, gIdx) in filteredMenuGroups" :key="gIdx" style="margin-bottom: 8px">
          <div class="app-sidebar-group-title">{{ group.title }}</div>
          <div style="margin-top: 2px">
            <button
              v-for="(item, iIdx) in group.items"
              :key="item.route"
              class="app-sidebar-item"
              :class="{ active: isActive(item.route) }"
              @click="navigate(item)"
              :title="item.label"
            >
              <MsIcon v-if="item.icon" :name="item.icon" :size="15" />
              <span v-else class="app-sidebar-item-icon-spacer" aria-hidden="true" />
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ item.label }}</span>
              <span
                v-if="group.title === 'Penjualan' && penjualanItems.indexOf(item) < 9"
                class="app-sidebar-item-shortcut"
                >ALT+{{ penjualanItems.indexOf(item) + 1 }}</span
              >
            </button>
          </div>
        </div>
      </nav>
    </div>

    <!-- Bottom Operator Dock -->
    <div class="app-sidebar-footer">
      <div class="app-sidebar-footer-op">
        <span class="app-sidebar-footer-op-name" style="display: inline-flex; align-items: center; gap: 6px">
          <MsIcon name="person" :size="13" />
          {{ authStore.userName || "Operator" }}
        </span>
      </div>
      <div class="app-sidebar-footer-fkeys">
        <span><b>F1</b> Info</span>
        <span><b>F2</b> Cari</span>
        <span><b>F10</b> Simpan</span>
      </div>
    </div>
  </aside>
</template>