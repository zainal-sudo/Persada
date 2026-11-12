import api from "@/api/axios";

export interface RekeningForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  kolId: number;
  isAktif: boolean;
}

export const rekeningFormApi = {
  getKelompok: async () => {
    const { data } = await api.get("/daftar/rekening/form/kelompok");
    return data.data as { kode: number; nama: string }[];
  },

  cekKode: async (kode: string) => {
    const { data } = await api.get("/daftar/rekening/form/cek-kode", {
      params: { kode },
    });
    return data.data.exists as boolean;
  },

  getDetailForm: async (kode: string): Promise<RekeningForm> => {
    const { data } = await api.get(
      `/daftar/rekening/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: RekeningForm) => {
    const { data } = await api.post("/daftar/rekening/form/save", payload);
    return data;
  },
};