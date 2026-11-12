import api from "@/api/axios";

export interface TagihanEkspedisiRow {
  Nomor: string;
  Tanggal: string;
  Tgl1: string;
  Tgl2: string;
}

export interface TagihanEkspedisiDetailRow {
  Nomor: string;
  NomorFP: string;
  Customer: string;
  TanggalFP: string;
  Nilai: number;
  Biaya: number;
  UOC: number;
}

export const tagihanEkspedisiApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<TagihanEkspedisiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TagihanEkspedisiRow[] }>(
      "/persediaan/tagihan-ekspedisi",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<TagihanEkspedisiDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TagihanEkspedisiDetailRow[] }>(
      `/persediaan/tagihan-ekspedisi/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};