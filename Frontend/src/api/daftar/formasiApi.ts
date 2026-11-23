// api/daftar/formasiApi.ts
import api from "@/api/axios";

export interface FormasiRow {
  id: number;
  Nama: string;
  Divisi: string;
  Type: string;
  Salesman: string;
  Atasan: string;
  JumlahArea: number;
  Area: string;
}

export const formasiApi = {
  getBrowse: async (search = ""): Promise<FormasiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FormasiRow[] }>(
      "/daftar/formasi",
      { params: { search } }
    );
    return data.data;
  },

  delete: async (id: number) => {
    const { data } = await api.delete(`/daftar/formasi/${id}`);
    return data;
  },
};
