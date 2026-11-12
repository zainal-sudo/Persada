import api from "@/api/axios";

export interface SubBarangRow {
  Kode: string;
  Nama: string;
}

export const subBarangApi = {
  getBrowse: async (tingkat: number): Promise<SubBarangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SubBarangRow[] }>(
      "/persediaan/sub-barang",
      { params: { tingkat } }
    );
    return data.data;
  },

  delete: async (kode: string) => {
    const { data } = await api.delete(`/persediaan/sub-barang/${encodeURIComponent(kode)}`);
    return data;
  },
};