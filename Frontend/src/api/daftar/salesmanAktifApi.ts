// api/daftar/salesmanAktifApi.ts
import api from "@/api/axios";

export interface SalesmanAktifRow {
  Kode: string;
  Nama: string;
  Aktif: string;
  TglMasuk: string;
  Formasi: string;
}

export const salesmanAktifApi = {
  getBrowse: async (): Promise<SalesmanAktifRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SalesmanAktifRow[] }>(
      "/daftar/salesman-aktif",
    );
    return data.data;
  },

  delete: async (kode: string) => {
    const { data } = await api.delete(
      `/daftar/salesman-aktif/${encodeURIComponent(kode)}`,
    );
    return data;
  },
};
