import api from "@/api/axios";

export interface GroupProdukFokusRow {
  Periode: string;
  Tahun: number;
  Kode: string;
  Nama: string;
  Grup: string;
  Het: number;
  Dept: string;
  HNA: number;
}

export const groupProdukFokusApi = {
  getBrowse: async (): Promise<GroupProdukFokusRow[]> => {
    const { data } = await api.get<{ success: boolean; data: GroupProdukFokusRow[] }>(
      "/daftar/group-produk-fokus"
    );
    return data.data;
  },
};