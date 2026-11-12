import api from "@/api/axios";

export interface ListPersediaanRow {
  Kode: string;
  Nama: string;
  Satuan: string;
  IdBatch: string;
  Expired: string;
  Gudang: string;
  Stok: number;
}

export const listPersediaanApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<ListPersediaanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListPersediaanRow[] }>(
      "/persediaan/list-persediaan",
      { params: { startDate, endDate } }
    );
    return data.data;
  },
};