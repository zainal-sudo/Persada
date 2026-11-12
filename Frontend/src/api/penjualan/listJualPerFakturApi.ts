// api/penjualan/listJualPerFakturApi.ts
import api from "@/api/axios";

export interface ListJualPerFakturRow {
  Nomor: string;
  Bulan: number;
  Tahun: number;
  Tanggal: string;
  JthTempo: string;
  Salesman: string;
  Customer: string;
  Total: number;
  Biaya_Promosi: number;
  Retur: number;
  Kontrak: number;
  Riil: number;
  Tax: string;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listJualPerFakturApi = {
  getBrowse: async (params: FilterParams): Promise<ListJualPerFakturRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJualPerFakturRow[] }>(
      "/penjualan/list-jual-per-faktur",
      { params }
    );
    return data.data;
  },
};
