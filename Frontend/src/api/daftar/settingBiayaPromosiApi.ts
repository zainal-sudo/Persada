import api from "@/api/axios";

export interface SettingBiayaPromosiRow {
  Nomor: string;
  Kode: string;
  Customer: string;
}

export interface SettingBiayaPromosiDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Kategori: string;
  Persen: number;
  Rupiah: number;
}

export const settingBiayaPromosiApi = {
  getBrowse: async (): Promise<SettingBiayaPromosiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingBiayaPromosiRow[] }>(
      "/daftar/setting-biaya-promosi"
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SettingBiayaPromosiDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingBiayaPromosiDetailRow[] }>(
      `/daftar/setting-biaya-promosi/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};