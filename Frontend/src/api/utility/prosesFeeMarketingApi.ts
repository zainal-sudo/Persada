import api from "@/api/axios";

export interface PratinjauFeeMarketing {
  bulan: number;
  tahun: number;
  jmlSetting: number;
  jmlFaktur: number;
  jmlFakturTerkaitFee: number;
}

export interface HasilProsesFeeMarketing {
  bulan: number;
  tahun: number;
  detailTersalin: number;
  fakturDiperbarui: number;
  user: string;
}

export const prosesFeeMarketingApi = {
  pratinjau: async (bulan: number, tahun: number): Promise<PratinjauFeeMarketing | null> => {
    try {
      const { data } = await api.get("/utility/proses-fee-marketing/pratinjau", {
        params: { bulan, tahun },
      });
      return data?.data ?? null;
    } catch {
      // Pratinjau bersifat informatif; kegagalan tidak boleh memblokir proses.
      return null;
    }
  },

  proses: async (payload: { bulan: number; tahun: number }): Promise<HasilProsesFeeMarketing> => {
    const { data } = await api.post("/utility/proses-fee-marketing/proses", payload);
    return data?.data;
  },
};
