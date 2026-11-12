// api/penjualan/listJualPerOutletApi.ts
import api from "@/api/axios";

export interface ListJualPerOutletRow {
  Salesman: string;
  Customer: string;
  Golongan: string;
  Bulan: number;
  Tahun: number;
  Total: number;
  Retur: number;
  Kontrak: number;
  Biaya_promosi: number;
  Riil: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listJualPerOutletApi = {
  getBrowse: async (params: FilterParams): Promise<ListJualPerOutletRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJualPerOutletRow[] }>(
      "/penjualan/list-jual-per-outlet",
      { params }
    );
    return data.data;
  },
};
