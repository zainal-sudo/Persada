// api/laporan/lapNeracaApi.ts
import api from "@/api/axios";

export interface LapNeracaRekening {
  kode: string;
  akun: string;
  nilai: number;
}

export interface LapNeracaData {
  aktiva: LapNeracaRekening[];
  pasiva: LapNeracaRekening[];
}

export interface LapNeracaFilter {
  tahun: number;
  bulan: number;
}

export async function getLapNeraca(params: LapNeracaFilter): Promise<LapNeracaData> {
  const { data } = await api.get<{ success: boolean; data: LapNeracaData }>(
    "/laporan/lap-neraca",
    { params: { tahun: params.tahun, bulan: params.bulan } },
  );
  return data.data;
}
