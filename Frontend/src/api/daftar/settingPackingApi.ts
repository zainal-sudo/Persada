import api from "@/api/axios";

export interface SettingPackingRow {
  Nomor: string;
  Kode: string;
  Nama: string;
}

export interface SettingPackingDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Qty: number;
}

export const settingPackingApi = {
  getBrowse: async (): Promise<SettingPackingRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingPackingRow[] }>(
      "/daftar/setting-packing"
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SettingPackingDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SettingPackingDetailRow[] }>(
      `/daftar/setting-packing/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};