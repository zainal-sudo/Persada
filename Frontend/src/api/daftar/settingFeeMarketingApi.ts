import api from "@/api/axios";

export interface SettingFeeMarketingRow {
  Nomor: string;
  Kode: string;
  Customer: string;
}

export interface SettingFeeMarketingDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Kategori: string;
  Persen: number;
  Rupiah: number;
}

export const settingFeeMarketingApi = {
  getBrowse: async (): Promise<SettingFeeMarketingRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingFeeMarketingRow[] }>(
      "/daftar/setting-fee-marketing"
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SettingFeeMarketingDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingFeeMarketingDetailRow[] }>(
      `/daftar/setting-fee-marketing/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};