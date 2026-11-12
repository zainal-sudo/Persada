import api from "@/api/axios";

export interface EkspedisiRow {
  ekspedisi_id: string;
  ekspedisi_nama: string;
}

export const ekspedisiApi = {
  getBrowse: async (): Promise<EkspedisiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: EkspedisiRow[] }>(
      "/daftar/ekspedisi"
    );
    return data.data;
  },
};