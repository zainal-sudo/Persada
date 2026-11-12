import api from "@/api/axios";

export interface FeeMarketingDetail {
  no?: number;
  kode: string;
  nama: string;
  persen: number;
  rupiah: number;
}

export interface SettingFeeMarketingForm {
  isEdit: boolean;
  nomor: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  detail: FeeMarketingDetail[];
}

export const settingFeeMarketingFormApi = {
  getMaxNomor: async (): Promise<string> => {
    const { data } = await api.get("/daftar/setting-fee-marketing/form/get-max-nomor");
    return data.data.nomor;
  },

  getCustomer: async (search: string) => {
    const { data } = await api.get("/daftar/setting-fee-marketing/form/customer", {
      params: { search },
    });
    return data.data as { kode: string; customer: string; alamat: string; telp: string }[];
  },

  getBarang: async (search: string) => {
    const { data } = await api.get("/daftar/setting-fee-marketing/form/barang", {
      params: { search },
    });
    return data.data as { kode: string; nama: string; satuan: string }[];
  },

  getAllItem: async (cusKode: string) => {
    const { data } = await api.get("/daftar/setting-fee-marketing/form/all-item", {
      params: { cusKode },
    });
    return data.data as { kode: string; nama: string; satuan: string }[];
  },

  getDetailForm: async (nomor: string): Promise<SettingFeeMarketingForm> => {
    const { data } = await api.get(
      `/daftar/setting-fee-marketing/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: SettingFeeMarketingForm) => {
    const { data } = await api.post("/daftar/setting-fee-marketing/form/save", payload);
    return data;
  },
};