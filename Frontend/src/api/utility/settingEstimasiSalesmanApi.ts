import api from "@/api/axios";

export interface BarisEstimasiSalesman {
  kode: string;
  nama: string;
  targetsales: number;
  estimasisales: number;
  avgsales: number;
  realisasisales: number;
  targetinkaso: number;
  estimasiinkaso: number;
  realisasiinkaso: number;
}

export interface DataLoadEstimasi {
  bulan: number;
  tahun: number;
  salesman: string;
  targetSalesman: number;
  flagEdit: boolean;
  lock: boolean;
  rows: BarisEstimasiSalesman[];
}

export interface HasilSimpanEstimasi {
  bulan: number;
  tahun: number;
  salesman: string;
  eshId: number;
  jmlBaris: number;
  user: string;
}

export const settingEstimasiSalesmanApi = {
  // Lookup salesman (Delphi: frmbantuan)
  getSalesman: async (): Promise<{ kode: string; nama: string }[]> => {
    const { data } = await api.get("/utility/setting-estimasi-salesman/salesman");
    return data?.data ?? [];
  },

  // Load grid form (Delphi: loaddata)
  load: async (params: {
    bulan: number;
    tahun: number;
    salesman: string;
  }): Promise<DataLoadEstimasi | null> => {
    try {
      const { data } = await api.get("/utility/setting-estimasi-salesman/load", {
        params,
      });
      return data?.data ?? null;
    } catch {
      return null;
    }
  },

  // Simpan (Delphi: simpandata)
  save: async (payload: {
    bulan: number;
    tahun: number;
    salesman: string;
    isEdit: boolean;
    rows: BarisEstimasiSalesman[];
  }): Promise<HasilSimpanEstimasi> => {
    const { data } = await api.post("/utility/setting-estimasi-salesman/save", payload);
    return data?.data;
  },
};
