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
  target: TargetBulanan[];
}

export interface TargetBulanan {
  periode: number;
  nama: string;
  target: number;
}

export const salesmanFormApi = {
  getMaxKode: async (): Promise<string> => {
    const { data } = await api.get("/daftar/salesman/form/get-max-kode");
    return data.data.kode;
  },

  getDetailForm: async (kode: string): Promise<SalesmanForm> => {
    const { data } = await api.get(
      `/daftar/salesman/form/${encodeURIComponent(kode)}`
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