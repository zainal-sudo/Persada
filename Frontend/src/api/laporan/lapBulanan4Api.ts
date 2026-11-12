// api/laporan/lapBulanan4Api.ts
import api from "@/api/axios";

export interface LapBulanan4Row {
  rayon: string;
  salesman: string | null;
  targetbulanini: number;
  targetsdbulanini: number;
  riilbulanini: number;
  persenbulanini: number;
  riilsdbulanini: number;
  persensdbulanini: number;
  riilbulaninilalu: number;
  growth: number;
  riilsdbulaninilalu: number;
  growth2: number;
  targettahunan: number;
  ratio: number;
  targetpiutang: number;
  targetallpiutang: number;
  realisasipiutang: number;
  returpiutang: number;
  returallpiutang: number;
  ratiopiutang: number;
  pf: number;
  pfratio: number;
  realisasiall: number;
  allratio: number;
  newcustomer: number;
  rsklinik: number;
  riilbulanininonn3: number;
  persenbulanininonn3: number;
  riilsdbulanininonn3: number;
  persensdbulanininonn3: number;
  riilbulaninilalunonn3: number;
  growthnonn3: number;
  riilsdbulaninilalunonn3: number;
  growth2nonn3: number;
}

export interface LapBulanan4Filter {
  bulan: number;
  tahun: number;
}

export const lapBulanan4Api = {
  getBrowse: async (params: LapBulanan4Filter): Promise<LapBulanan4Row[]> => {
    const { data } = await api.get<{ success: boolean; data: LapBulanan4Row[] }>(
      "/laporan/lap-bulanan4",
      { params, timeout: 120000 }
    );
    return data.data;
  },
};