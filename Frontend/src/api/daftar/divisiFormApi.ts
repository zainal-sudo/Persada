import api from "@/api/axios";

export interface DivisiForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  prefix: string;
}

export const divisiFormApi = {
  getDetailForm: async (kode: string): Promise<DivisiForm> => {
    const { data } = await api.get(
      `/daftar/divisi/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: DivisiForm) => {
    const { data } = await api.post("/daftar/divisi/form/save", payload);
    return data;
  },
};
