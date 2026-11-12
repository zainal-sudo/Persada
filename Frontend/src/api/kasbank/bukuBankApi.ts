import api from "@/api/axios";

export interface BukuBankRow {
  Nomor: string;
  Tanggal: string;
  Keterangan: string;
  Rekening: string;
  Debet: number;
  Kredit: number;
  Saldo: number;
  Memo: string;
}

export const bukuBankApi = {
  getRekening: async () => {
    const { data } = await api.get("/kasbank/buku-bank/rekening");
    return data.data as { kode: string; nama: string }[];
  },

  getBukuBank: async (rekkode: string, startDate: string, endDate: string): Promise<BukuBankRow[]> => {
    const { data } = await api.get("/kasbank/buku-bank", {
      params: { rekkode, startDate, endDate },
    });
    return data.data;
  },
};