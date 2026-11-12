// api/laporan/listHistoryStokApi.ts
import api from "@/api/axios";

export interface ListHistoryStokRow {
  Kode: string;
  Nama: string;
  Kategori: string;
  HAwal: number;
  Awal: number;
  Qty_MTCIn: number;
  H_MTCIn: number;
  Qty_Ret: number;
  H_Ret: number;
  Qty_Kor: number;
  H_Kor: number;
  Qty_Mus: number;
  H_Mus: number;
  Qty_Jual: number;
  H_Jual: number;
  Qty_MTCOut_00: number;
  H_MTCOut_00: number;
  Qty_MTCOut_01: number;
  H_MTCOut_01: number;
  Qty_MTCOut_02: number;
  H_MTCOut_02: number;
  Akhir: number;
  HAkhir: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listHistoryStokApi = {
  getBrowse: async (params: FilterParams): Promise<ListHistoryStokRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListHistoryStokRow[] }>(
      "/laporan/list-history-stok",
      { params }
    );
    return data.data;
  },
};