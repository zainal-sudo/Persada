// api/laporan/estimasiSalesApi.ts
import api from "@/api/axios";

export interface EstimasiSalesRow {
  no: number;
  kode_salesman: string;
  salesman: string;
  marketing: string;
  kode: string;
  nama: string;
  pf: number;
  targetsales: number;
  estimasisales: number;
  avgsales: number;
  realisasisales: number;
  ratiosales: number;
  targetinkaso: number;
  estimasiinkaso: number;
  realisasiinkaso: number;
  ratioinkaso: number;
}

export interface EstimasiSalesFilter {
  bulan: number;
  tahun: number;
}

export const estimasiSalesApi = {
  getBrowse: async (params: EstimasiSalesFilter): Promise<EstimasiSalesRow[]> => {
    const { data } = await api.get<{ success: boolean; data: EstimasiSalesRow[] }>(
      "/laporan/estimasi-sales",
      { params },
    );
    return data.data;
  },
};
