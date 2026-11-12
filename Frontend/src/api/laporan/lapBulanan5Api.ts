// api/laporan/lapBulanan5Api.ts
import api from "@/api/axios";

export interface LapBulanan5Row {
  Departemen: string;
  ktg_kode: string;
  /** false = departemen ini tidak punya target sales sama sekali. */
  hasTarget: boolean;
  /** null ketika hasTarget false: "tidak ada target" ≠ "punya target, tidak tercapai". */
  TargetBulanini: number | null;
  Targetsdbulanini: number | null;
  riilbulanini: number;
  persenbulanini: number | null;
  riilsdbulanini: number;
  persensdbulanini: number | null;
  riilbulaninilalu: number;
  growth: number;
  riilsdbulaniniLalu: number;
  growth2: number;
  targettahunan: number | null;
  ratio: number | null;
}

export interface LapBulanan5Filter {
  bulan: number;
  tahun: number;
  onlySalesman: boolean;
}

export async function getLapBulanan5(params: LapBulanan5Filter): Promise<LapBulanan5Row[]> {
  const { data } = await api.get<{ success: boolean; data: LapBulanan5Row[] }>(
    "/laporan/lap-bulanan5",
    {
      params: {
        bulan: params.bulan,
        tahun: params.tahun,
        onlySalesman: params.onlySalesman ? "1" : "0",
      },
      timeout: 300000,
    }
  );
  return data.data;
}