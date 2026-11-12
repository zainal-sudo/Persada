// composables/useDynamicRoutes.ts
import { ref } from "vue";
import type { Router } from "vue-router";
import { routeApi, type DynamicRoute } from "@/api/routeApi";
import { useAuthStore } from "@/stores/authStore";

// Map statis semua view di build time
const viewModules: Record<string, () => Promise<any>> =
  import.meta.glob("@/views/**/*.vue");

const loadedForKode = ref<string | null>(null);
const registeredNames = new Set<string>();
const isRoutesLoaded = ref(false);

export function useDynamicRoutes() {
  const authStore = useAuthStore();

  /**
   * Resolve component dari string path view.
   * Contoh: "transaksi/poBrowseView" → /src/views/transaksi/poBrowseView.vue
   */
  const resolveView = (view: string) => {
    // Normalisasi: buang .vue kalau ada, pastikan format benar
    const cleanView = view.replace(/\.vue$/, "");
    const key = `/src/views/${cleanView}.vue`;
    const loader = viewModules[key];
    if (!loader) {
      console.warn(`❌ View tidak ditemukan di glob: ${key}`);
      return null;
    }
    return loader;
  };

  /**
   * Daftarkan satu route ke router.
   * Return true kalau berhasil, false kalau skip (duplikat/view tidak ada).
   */
  const addRoute = (
    router: Router,
    path: string,
    name: string,
    view: string,
    meta: Record<string, any>,
  ): boolean => {
    const component = resolveView(view);
    if (!component) return false;

    if (registeredNames.has(name)) return false;

    router.addRoute({
      path,
      name,
      component,
      meta: {
        requiresAuth: true,
        layout: "DefaultLayout",
        ...meta,
      },
    });

    registeredNames.add(name);
    return true;
  };

  /**
   * Generate route form (create/edit/print) dari route browse.
   * Konvensi penamaan:
   *   browse: transaksi/poBrowseView → form: transaksi/poFormView
   *   browse: transaksi/poBrowseView → print: transaksi/poPrintView
   */
  const generateFormRoutes = (routes: DynamicRoute[], router: Router) => {
    let count = 0;

    for (const r of routes) {
      const basePath = r.path;
      const baseName = `menu-${r.menuId}`;
      const baseTitle = r.title;

      // ── Route Create ──────────────────────────────────────────────
      const formView = r.view.replace(/View$/, "FormView");
      if (formView !== r.view) {
        const created = addRoute(
          router,
          `${basePath}/create`,
          `${baseName}-create`,
          formView,
          {
            menuId: r.menuId,
            title: `Tambah ${baseTitle}`,
            browseRoute: baseName,
          },
        );
        if (created) count++;
      }

      // ── Route Edit ────────────────────────────────────────────────
      const editView = formView;
      if (editView !== r.view) {
        const created = addRoute(
          router,
          `${basePath}/edit/:nomor`,
          `${baseName}-edit`,
          editView,
          {
            menuId: r.menuId,
            title: `Ubah ${baseTitle}`,
            browseRoute: baseName,
          },
        );
        if (created) count++;
      }

      // ── Route Print ───────────────────────────────────────────────
      const printView = r.view.replace(/View$/, "PrintView");
      if (printView !== r.view) {
        const created = addRoute(
          router,
          `${basePath}/print/:nomor`,
          `${baseName}-print`,
          printView,
          {
            layout: "BlankLayout",
            requiresAuth: true,
            title: `Cetak ${baseTitle}`,
          },
        );
        if (created) count++;
      }
    }

    return count;
  };

  /**
   * Register semua dynamic routes dari database.
   */
  const registerRoutes = (routes: DynamicRoute[], router: Router) => {
    let browseCount = 0;
    let formCount = 0;

    // 1. Register route browse
    for (const r of routes) {
      const created = addRoute(
        router,
        r.path,
        `menu-${r.menuId}`,
        r.view,
        {
          menuId: r.menuId,
          title: r.title,
          icon: r.icon,
        },
      );
      if (created) browseCount++;
    }

    // 2. Generate route form & print
    formCount = generateFormRoutes(routes, router);

    console.log(
      `✅ Registered ${browseCount} browse routes + ${formCount} form/print routes`,
    );

    return browseCount + formCount;
  };

  /**
   * Load dynamic routes dari database untuk user saat ini.
   */
  const loadRoutes = async (router: Router) => {
    const kode = authStore.userKode;
    if (!kode) {
      console.warn("❌ User kode tidak ditemukan, skip load dynamic routes");
      return;
    }
    if (loadedForKode.value === kode && isRoutesLoaded.value) return;

    try {
      console.log("🔄 Loading dynamic routes for:", kode);
      const routes = await routeApi.getDynamicRoutes(kode);
      registerRoutes(routes, router);
      loadedForKode.value = kode;
      isRoutesLoaded.value = true;
      console.log(`✅ Loaded ${routes.length} dynamic routes`);
    } catch (e: any) {
      console.error("❌ Failed to load dynamic routes:", e);
    }
  };

  /**
   * Reset semua dynamic routes (saat logout).
   */
  const resetRoutes = (router: Router) => {
    for (const name of registeredNames) {
      router.removeRoute(name);
    }
    registeredNames.clear();
    loadedForKode.value = null;
    isRoutesLoaded.value = false;
  };

  return {
    isRoutesLoaded,
    loadRoutes,
    resetRoutes,
  };
}