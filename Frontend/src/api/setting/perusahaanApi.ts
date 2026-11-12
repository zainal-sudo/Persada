// api/setting/perusahaanApi.ts
import api from "@/api/axios";

export interface Perusahaan {
  perush_nama: string;
  perush_alamat: string;
  perush_kota: string;
  perush_notelp: string;
  perush_nofax: string;
  perush_npwp: string;
  perush_nama_npwp: string;
  perush_alnpwp: string;
  perush_ktnpwp: string;
  perush_rekening: string;
}

export const perusahaanApi = {
  get: async (): Promise<Perusahaan | null> => {
    const { data } = await api.get<{ success: boolean; data: Perusahaan | null }>("/setting/perusahaan");
    return data.data;
  },
  update: async (payload: Perusahaan): Promise<void> => {
    await api.put("/setting/perusahaan", payload);
  },
};
