<template>
  <div class="app-tabbar" v-if="tabsStore.tabs.length > 0">
    <div
      class="app-tabbar-list"
      ref="tabsContainerRef"
      @wheel.prevent="onWheelScroll"
    >
      <div
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        class="app-tab"
        :class="{
          active: tabsStore.activeTabId === tab.id,
          pinned: !tab.closable,
        }"
        @click="onTabClick(tab)"
        @contextmenu.prevent="onContextMenu($event, tab)"
        @mousedown.middle.prevent="closeTab(tab)"
        :title="tab.title"
      >
        <MsIcon
          :name="tab.closable ? 'description' : 'lock'"
          :size="13"
          style="flex-shrink: 0; color: inherit; opacity: 0.9"
        />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
          {{ tab.title }}
        </span>
        <button
          v-if="tab.closable"
          class="app-tab-close"
          title="Tutup tab"
          @click.stop="closeTab(tab)"
        >
          &#10005;
        </button>
      </div>
    </div>

    <div class="app-tabbar-actions">
      <div class="app-tabbar-menu-wrap" style="position: relative">
        <v-menu location="bottom end" min-width="190">
          <template #activator="{ props }">
            <button class="app-tabbar-menu" v-bind="props" title="Opsi tab">
              &#8943;
            </button>
          </template>
          <v-list density="compact">
            <v-list-item
              :disabled="!tabsStore.activeTab"
              @click="tabsStore.closeOtherTabs(tabsStore.activeTabId)"
            >
              <template #prepend><MsIcon name="remove" :size="14" /></template>
              <v-list-item-title class="tab-menu-title">
                Tutup Tab Lain
              </v-list-item-title>
            </v-list-item>
            <v-list-item @click="tabsStore.closeAllTabs()">
              <template #prepend><MsIcon name="do_not_disturb_on" :size="14" /></template>
              <v-list-item-title class="tab-menu-title">
                Tutup Semua Tab
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Context menu (klik kanan) -->
    <div
      v-if="ctxVisible"
      class="tab-context-menu"
      :style="{ left: `${ctxX}px`, top: `${ctxY}px` }"
      @click.stop
    >
      <div v-if="ctxTab?.closable" class="ctx-item" @click="ctxCloseTab">
        <MsIcon name="close" :size="14" />
        <span>Tutup Tab</span>
      </div>
      <div class="ctx-item" @click="ctxCloseOther">
        <MsIcon name="remove" :size="14" />
        <span>Tutup Tab Lain</span>
      </div>
      <div class="ctx-item" @click="ctxCloseRight">
        <MsIcon name="arrow_forward" :size="14" />
        <span>Tutup Tab ke Kanan</span>
      </div>
      <div class="ctx-sep" />
      <div class="ctx-item" @click="ctxCloseAll">
        <MsIcon name="do_not_disturb_on" :size="14" />
        <span>Tutup Semua Tab</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useTabsStore, type TabItem } from "@/stores/tabsStore";
import MsIcon from "@/components/MsIcon.vue";

const tabsStore = useTabsStore();
const tabsContainerRef = ref<HTMLElement | null>(null);

// ── Context menu (klik kanan) ────────────────────────────────────────
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxTab = ref<TabItem | null>(null);
const ctxTabId = ref("");

let closeHandler: (() => void) | null = null;

const hideContextMenu = () => {
  ctxVisible.value = false;
  ctxTab.value = null;
  ctxTabId.value = "";
  detachCloseHandler();
};

const detachCloseHandler = () => {
  if (closeHandler) {
    window.removeEventListener("click", closeHandler);
    closeHandler = null;
  }
};

const attachCloseHandler = () => {
  detachCloseHandler();
  closeHandler = () => hideContextMenu();
  window.addEventListener("click", closeHandler);
};

const onContextMenu = (event: MouseEvent, tab: TabItem) => {
  tabsStore.setActiveTab(tab.id);
  ctxTab.value = tab;
  ctxTabId.value = tab.id;
  ctxX.value = Math.min(event.clientX, window.innerWidth - 220);
  ctxY.value = Math.min(event.clientY, window.innerHeight - 190);
  ctxVisible.value = true;
  attachCloseHandler();
};

const ctxCloseTab = () => {
  if (ctxTab.value) closeTab(ctxTab.value);
  hideContextMenu();
};
const ctxCloseOther = () => {
  tabsStore.closeOtherTabs(ctxTabId.value);
  hideContextMenu();
};
const ctxCloseRight = () => {
  tabsStore.closeTabsToRight(ctxTabId.value);
  hideContextMenu();
};
const ctxCloseAll = () => {
  tabsStore.closeAllTabs();
  hideContextMenu();
};

// ── Tab actions ──────────────────────────────────────────────────────
const onTabClick = (tab: TabItem) => {
  tabsStore.setActiveTab(tab.id);
};

const closeTab = (tab: TabItem) => {
  if (!tab.closable) return;
  if (tab.onClose) tab.onClose();
  tabsStore.closeTab(tab.id);
};

const onWheelScroll = (event: WheelEvent) => {
  if (ctxVisible.value) hideContextMenu();
  if (tabsContainerRef.value) {
    event.preventDefault();
    tabsContainerRef.value.scrollLeft += event.deltaY;
  }
};

// ── Scroll ke tab aktif ──────────────────────────────────────────────
const scrollToActiveTab = () => {
  nextTick(() => {
    if (!tabsContainerRef.value) return;
    const active = tabsContainerRef.value.querySelector(".tab-item.active");
    if (active) {
      active.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  });
};

watch(
  () => tabsStore.activeTabId,
  () => scrollToActiveTab(),
);

const onWindowKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") hideContextMenu();
};

// Ctrl+W (dari useHotkeys) → tutup tab aplikasi yang aktif
const onCloseTab = () => {
  const activeId = tabsStore.activeTabId;
  if (activeId) tabsStore.closeTab(activeId);
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
  document.addEventListener("erp:close-tab", onCloseTab);
  nextTick(() => scrollToActiveTab());
});

onUnmounted(() => {
  window.removeEventListener("keydown", onWindowKeydown);
  document.removeEventListener("erp:close-tab", onCloseTab);
  detachCloseHandler();
});
</script>

<style scoped>
.tab-menu-title {
  font-size: 12.5px !important;
}

/* ── Context menu ── */
.tab-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 200px;
  background: #ffffff;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 0;
  box-shadow: none;
  padding: 4px;
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 0;
  font-size: 12.5px;
  color: #374151;
  cursor: pointer;
}
.ctx-item:hover {
  background: #E8EDF5;
  color: var(--ds-primary-dark, #B45309);
}
.ctx-sep {
  height: 1px;
  background: var(--ds-border, #A0AAB8);
  margin: 4px 6px;
}
</style>
