import api from "@/api/axios";

export interface GudangForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  penanggungjawab: string;
  keterangan: string;
}

export const gudangFormApi = {
  getMaxKode: async (): Promise<string> => {
    const { data } = await api.get("/persediaan/gudang/form/get-max-kode");
    return data.data.kode;
  },

  getDetailForm: async (kode: string): Promise<GudangForm> => {
    const { data } = await api.get(
      `/persediaan/gudang/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: GudangForm) => {
    const { data } = await api.post("/persediaan/gudang/form/save", payload);
    return data;
  },
};