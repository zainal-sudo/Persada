import api from "@/api/axios";

export interface PratinjauBiayaPromosi {
  bulan: number;
  tahun: number;
  jmlSetting: number;
  jmlFaktur: number;
  jmlFakturTerkaitPromosi: number;
}

export interface HasilProsesBiayaPromosi {
  bulan: number;
  tahun: number;
  detailTersalin: number;
  fakturDiperbarui: number;
  user: string;
}

export const prosesBiayaPromosiApi = {
  pratinjau: async (bulan: number, tahun: number): Promise<PratinjauBiayaPromosi | null> => {
    try {
      const { data } = await api.get("/utility/proses-biaya-promosi/pratinjau", {
        params: { bulan, tahun },
      });
      return data?.data ?? null;
    } catch {
      // Pratinjau bersifat informatif; kegagalan tidak boleh memblokir proses.
      return null;
    }
  },

  proses: async (payload: { bulan: number; tahun: number }): Promise<HasilProsesBiayaPromosi> => {
    const { data } = await api.post("/utility/proses-biaya-promosi/proses", payload);
    return data?.data;
  },
};
