// utils/menuResolver.ts
import { usePermissionStore } from "@/stores/permissionStore";

/**
 * Resolve menuId dari route path secara otomatis.
 * Mencari di menuItems yang sudah di-fetch dari database.
 */
export const resolveMenuId = (path: string): string => {
  const permissionStore = usePermissionStore();
  return permissionStore.getMenuIdByRoute(path) || "";
};

/**
 * Resolve menuId untuk route form.
 * Contoh: /transaksi/po/create → /transaksi/po → cari menuId
 */
export const resolveFormMenuId = (path: string): string => {
  // Buang segment terakhir (create/edit/print)
  const parts = path.split("/");
  const browsePath = parts.slice(0, -1).join("/");
  return resolveMenuId(browsePath);
};