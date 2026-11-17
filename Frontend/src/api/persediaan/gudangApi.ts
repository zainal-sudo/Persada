import api from "@/api/axios";

export interface GudangRow {
  Kode: string;
  Nama: string;
  Penanggungjawab: string;
  Keterangan: string;
  IsKonsinyasi: number;
}

export const gudangApi = {
  getBrowse: async (): Promise<GudangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: GudangRow[] }>(
      "/persediaan/gudang"
    );
    return data.data;
  },
};
