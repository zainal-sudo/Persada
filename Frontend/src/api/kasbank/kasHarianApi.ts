import api from "@/api/axios";

export interface KasHarianRow {
  Keterangan: string;
  Debet: number;
  Kredit: number;
  Saldo: number;
}

export const kasHarianApi = {
  getRekening: async () => {
    const { data } = await api.get("/kasbank/kas-harian/rekening");
    return data.data as { kode: string; nama: string }[];
  },

  getKasHarian: async (rekkode: string, tanggal: string): Promise<KasHarianRow[]> => {
    const { data } = await api.get("/kasbank/kas-harian", {
      params: { rekkode, tanggal },
    });
    return data.data;
  },
};