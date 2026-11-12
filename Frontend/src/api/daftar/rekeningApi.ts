import api from "@/api/axios";

export interface RekeningRow {
  Kode: string;
  Nama: string;
  Kelompok: string;
  Status: string;
  Saldo_Akhir: number;
}

export const rekeningApi = {
  getBrowse: async (): Promise<RekeningRow[]> => {
    const { data } = await api.get<{ success: boolean; data: RekeningRow[] }>(
      "/daftar/rekening"
    );
    return data.data;
  },
};