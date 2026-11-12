import api from "@/api/axios";

export interface PencairanGiroRow {
  Nomor: string;
  Tanggal: string;
  GiroNumber: string;
  TglCair: string;
  Nilai: number;
  Bank: string;
}

export const pencairanGiroApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<PencairanGiroRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PencairanGiroRow[] }>(
      "/kasbank/pencairan-giro",
      { params: { startDate, endDate } }
    );
    return data.data;
  },
};