// api/daftar/salesmanAktifFormApi.ts
import api from "@/api/axios";

export interface SalesmanAktifForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  isaktif: boolean;
  tglMasuk: string;
  formasiId: number;
  formasiNama?: string;
}

export interface FormasiOption {
  id: number;
  nama: string;
}

export const salesmanAktifFormApi = {
  getFormasiOptions: async (search = ""): Promise<FormasiOption[]> => {
    const { data } = await api.get(
      "/daftar/salesman-aktif/form/formasi-options",
      { params: { search } },
    );
    return data.data as FormasiOption[];
  },

  getDetailForm: async (kode: string): Promise<SalesmanAktifForm> => {
    const { data } = await api.get(
      `/daftar/salesman-aktif/form/detail/${encodeURIComponent(kode)}`,
    );
    return data.data;
  },

  save: async (payload: SalesmanAktifForm) => {
    const { data } = await api.post("/daftar/salesman-aktif/form/save", payload);
    return data;
  },
};
