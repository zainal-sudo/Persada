import api from "@/api/axios";

export interface KendaraanRow {
  kend_nopol: string;
  kend_merk: string;
  kend_tipe: string;
  kend_bagian: string;
  kend_pic: string;
  kend_cabang: string;
}

export const kendaraanApi = {
  getBrowse: async (): Promise<KendaraanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: KendaraanRow[] }>(
      "/daftar/kendaraan"
    );
    return data.data;
  },
};