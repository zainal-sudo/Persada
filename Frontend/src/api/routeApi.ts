import api from "@/api/axios";

export interface DynamicRoute {
  path: string;
  view: string;
  menuId: string;
  title: string;
  icon?: string;
}

export const routeApi = {
  getDynamicRoutes: async (kode: string): Promise<DynamicRoute[]> => {
    const { data } = await api.get<{ success: boolean; data: DynamicRoute[] }>(
      `/menu/user/${encodeURIComponent(kode)}`,
    );
    return data.data;
  },
};
