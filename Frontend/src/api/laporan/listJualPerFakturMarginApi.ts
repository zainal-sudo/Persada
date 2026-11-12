// api/laporan/listJualPerFakturMarginApi.ts
import api from "@/api/axios";

export interface ListJualPerFakturMarginRow {
  Nomor: string;
  Bulan: number;
  Tahun: number;
  Tanggal: string;
  JthTempo: string;
  Salesman: string;
  Customer: string;
  Total: number;
  Kontrak: number;
  Biaya_Promosi: number;
  Riil: number;
  Net: number;
  Hpp: number;
  Margin: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listJualPerFakturMarginApi = {
  getBrowse: async (params: FilterParams): Promise<ListJualPerFakturMarginRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJualPerFakturMarginRow[] }>(
      "/laporan/list-jual-per-faktur-margin",
      { params }
    );
    return data.data;
  },
};