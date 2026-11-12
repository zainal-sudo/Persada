// api/laporan/doRealisasiApi.ts
import api from "@/api/axios";

export interface DoRealisasiRow {
  Nomor: string;
  Tanggal: string;
  Bulan: number;
  Tahun: number;
  Customer: string;
  Status: string;
  POD_Tanggal: string | null;
  Foto: string | null;
  Tampung: number;
}

export interface DoRealisasiFilter {
  startDate: string;
  endDate: string;
}

export const doRealisasiApi = {
  getBrowse: async (params: DoRealisasiFilter): Promise<DoRealisasiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: DoRealisasiRow[] }>(
      "/laporan/do-realisasi",
      { params }
    );
    return data.data;
  },
};