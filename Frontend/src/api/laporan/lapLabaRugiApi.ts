// api/laporan/lapLabaRugiApi.ts
import api from "@/api/axios";

export interface LapLabaRugiMonth {
  bulan: number;
  label: string;
}

export interface LapLabaRugiRow {
  keterangan: string;
  isTotal: boolean;
  /** nilai per nomor bulan, mis. { 1: 1000, 2: 2500 } */
  nilai: Record<number, number>;
  total: number;
}

export interface LapLabaRugiData {
  months: LapLabaRugiMonth[];
  rows: LapLabaRugiRow[];
}

export interface LapLabaRugiFilter {
  tahun: number;
  bulan1: number;
  bulan2: number;
}

export async function getLapLabaRugi(params: LapLabaRugiFilter): Promise<LapLabaRugiData> {
  const { data } = await api.get<{ success: boolean; data: LapLabaRugiData }>(
    "/laporan/lap-laba-rugi",
    { params: { tahun: params.tahun, bulan1: params.bulan1, bulan2: params.bulan2 } },
  );
  return data.data;
}
