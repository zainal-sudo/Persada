import api from "@/api/axios";

export interface TutupPeriode {
  bulan: number;
  tahun: number;
}

export const tutupPeriodeApi = {
  getLast: async (): Promise<TutupPeriode | null> => {
    const { data } = await api.get("/utility/tutup-periode/last");
    return data.data;
  },

  proses: async (payload: TutupPeriode) => {
    const { data } = await api.post("/utility/tutup-periode", payload);
    return data;
  },

  buka: async (payload: TutupPeriode) => {
    const { data } = await api.delete("/utility/tutup-periode", { data: payload });
    return data;
  },
};