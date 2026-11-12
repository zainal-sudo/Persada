import api from "@/api/axios";

export interface PackingDetail {
  no?: number;
  kode: string;
  nama: string;
  qty: number;
}

export interface SettingPackingForm {
  isEdit: boolean;
  nomor: string;
  kode: string;
  nama: string;
  detail: PackingDetail[];
}

export const settingPackingFormApi = {
  getMaxNomor: async (): Promise<string> => {
    const { data } = await api.get("/daftar/setting-packing/form/get-max-nomor");
    return data.data.nomor;
  },

  getBarang: async (search: string) => {
    const { data } = await api.get("/daftar/setting-packing/form/barang", {
      params: { search },
    });
    return data.data as { kode: string; nama: string; satuan: string }[];
  },

  getDetailForm: async (nomor: string): Promise<SettingPackingForm> => {
    const { data } = await api.get(
      `/daftar/setting-packing/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: SettingPackingForm) => {
    const { data } = await api.post("/daftar/setting-packing/form/save", payload);
    return data;
  },
};