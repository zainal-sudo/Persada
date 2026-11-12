// api/komisi/komisiSalesmanApi.ts
import api from "@/api/axios";

export interface Grid1Row {
  rayon: string;
  salesman: string;
  kode: string;
  target_jual: number;
  realisasi_jual: number;
  persentase_jual: number;
  target_other: number;
  realisasi_other: number;
  persentase_other: number;
  realisasi_pf: number;
  ratio_pf: number;
  target_piutang: number;
  realisasi_tempo: number;
  realisasi_all: number;
  persentase_piutang: number;
  persentase_tempo: number;
}

export interface Grid2Row {
  no: number;
  salesman: string;
  riil: number;
  girolalu: number;
  biaya_promosi: number;
  fee_marketing: number;
  kontrak: number;
  batas: number;
  pengali: number;
  pengali2: number;
  pengali3: number;
  pengali4: number;
  komisi_jual: number;
  persen: number; nilai: number;
  persen2: number; nilai2: number;
  persen3: number; nilai3: number;
  persen4: number; nilai4: number;
  komisipf: number;
  komisiothers: number;
  total: number;
}

export interface KomisiData {
  grid1: Grid1Row[];
  grid2: Grid2Row[];
}

export const komisiSalesmanApi = {
  get: async (bulan: number, tahun: number): Promise<KomisiData> => {
    const { data } = await api.get<{ success: boolean; data: KomisiData }>("/komisi/salesman", {
      params: { bulan, tahun },
    });
    return data.data;
  },
};
