// api/laporan/lapYTDsApi.ts
import api from "@/api/axios";

export interface LapYtdRow {
  Tahun: number;
  Bulan: string;
  Target: number;
  Pencapaian: number;
  presentase: number;
  PencapaianLalu: number;
  growth: number;
}

export interface LapYtdFilter {
  bulan: number;
  tahun: number;
}

export async function getLapYtd(params: LapYtdFilter): Promise<LapYtdRow[]> {
  const { data } = await api.get<{ success: boolean; data: LapYtdRow[] }>("/laporan/lap-ytd", {
    params: { bulan: params.bulan, tahun: params.tahun },
  });
  return data.data;
}