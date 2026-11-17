import api from "@/api/axios";

export interface DivisiRow {
  div_kode: string;
  div_nama: string;
  div_prefix: string;
}

export const divisiApi = {
  getBrowse: async (): Promise<DivisiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: DivisiRow[] }>(
      "/daftar/divisi"
    );
    return data.data;
  },
};
