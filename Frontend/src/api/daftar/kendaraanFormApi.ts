import api from "@/api/axios";

export interface KendaraanForm {
  isEdit: boolean;
  nopol: string;
  merk: string;
  tipe: string;
  bagian: string;
  pic: string;
  cabang: string;
}

export const kendaraanFormApi = {
  getDetailForm: async (nopol: string): Promise<KendaraanForm> => {
    const { data } = await api.get(
      `/daftar/kendaraan/form/${encodeURIComponent(nopol)}`
    );
    return data.data;
  },

  save: async (payload: KendaraanForm) => {
    const { data } = await api.post("/daftar/kendaraan/form/save", payload);
    return data;
  },
};