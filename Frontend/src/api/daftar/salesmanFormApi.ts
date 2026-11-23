import api from "@/api/axios";

export interface SalesmanForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  alamat: string;
  kota: string;
  telp: string;
  tglMasuk: string;
  cabang: string;
  formasiId: number;
  formasiNama?: string;
}

export interface TargetBulanan {
  periode: number;
  nama: string;
  target: number;
}

export interface FormasiOption {
  id: number;
  nama: string;
}

export const salesmanFormApi = {
  getMaxKode: async (): Promise<string> => {
    const { data } = await api.get("/daftar/salesman/form/get-max-kode");
    return data.data.kode;
  },

  getFormasiOptions: async (search = ""): Promise<FormasiOption[]> => {
    const { data } = await api.get("/daftar/salesman/form/formasi-options", {
      params: { search },
    });
    return data.data as FormasiOption[];
  },

  getDetailForm: async (kode: string): Promise<SalesmanForm> => {
    const { data } = await api.get(
      `/daftar/salesman/form/detail/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  getTargetBulanan: async (kode: string, tahun: number) => {
    const { data } = await api.get("/daftar/salesman/form/target-bulanan", {
      params: { kode, tahun },
    });
    return data.data as TargetBulanan[];
  },

  save: async (payload: SalesmanForm) => {
    const { data } = await api.post("/daftar/salesman/form/save", payload);
    return data;
  },
};
