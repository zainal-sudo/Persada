import api from "@/api/axios";

export interface SubBarangForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  tingkat: number;
  parentKode: string;
}

export const subBarangFormApi = {
  getMaxKode: async (tingkat: number, parentKode: string): Promise<string> => {
    const { data } = await api.get("/persediaan/sub-barang/form/get-max-kode", {
      params: { tingkat, parentKode },
    });
    return data.data.kode;
  },

  getParent: async (tingkat: number) => {
    const { data } = await api.get("/persediaan/sub-barang/form/parent", {
      params: { tingkat },
    });
    return data.data as { kode: string; nama: string }[];
  },

  getDetailForm: async (kode: string): Promise<SubBarangForm> => {
    const { data } = await api.get(
      `/persediaan/sub-barang/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: SubBarangForm) => {
    const { data } = await api.post("/persediaan/sub-barang/form/save", payload);
    return data;
  },
};