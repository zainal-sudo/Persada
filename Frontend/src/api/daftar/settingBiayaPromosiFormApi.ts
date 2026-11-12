import api from "@/api/axios";

export interface BiayaPromosiDetail {
  no?: number;
  kode: string;
  nama: string;
  persen: number;
  rupiah: number;
}

export interface SettingBiayaPromosiForm {
  isEdit: boolean;
  nomor: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  detail: BiayaPromosiDetail[];
}

export const settingBiayaPromosiFormApi = {
  getMaxNomor: async (): Promise<string> => {
    const { data } = await api.get("/daftar/setting-biaya-promosi/form/get-max-nomor");
    return data.data.nomor;
  },

  getCustomer: async (search: string) => {
    const { data } = await api.get("/daftar/setting-biaya-promosi/form/customer", {
      params: { search },
    });
    return data.data as { kode: string; customer: string; alamat: string; telp: string }[];
  },

  getBarang: async (search: string) => {
    const { data } = await api.get("/daftar/setting-biaya-promosi/form/barang", {
      params: { search },
    });
    return data.data as { kode: string; nama: string; satuan: string }[];
  },

  getAllItem: async (cusKode: string) => {
    const { data } = await api.get("/daftar/setting-biaya-promosi/form/all-item", {
      params: { cusKode },
    });
    return data.data as { kode: string; nama: string; satuan: string }[];
  },

  getDetailForm: async (nomor: string): Promise<SettingBiayaPromosiForm> => {
    const { data } = await api.get(
      `/daftar/setting-biaya-promosi/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: SettingBiayaPromosiForm) => {
    const { data } = await api.post("/daftar/setting-biaya-promosi/form/save", payload);
    return data;
  },
};