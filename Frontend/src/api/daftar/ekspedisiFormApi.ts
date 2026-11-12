import api from "@/api/axios";

export interface EkspedisiForm {
  isEdit: boolean;
  id: string;
  nama: string;
}

export const ekspedisiFormApi = {
  getDetailForm: async (id: string): Promise<EkspedisiForm> => {
    const { data } = await api.get(
      `/daftar/ekspedisi/form/${encodeURIComponent(id)}`
    );
    return data.data;
  },

  save: async (payload: EkspedisiForm) => {
    const { data } = await api.post("/daftar/ekspedisi/form/save", payload);
    return data;
  },
};