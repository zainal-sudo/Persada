// api/laporan/listFakturOutstandingApi.ts
import api from "@/api/axios";

export interface ListFakturOutstandingRow {
  Bulan: number;
  Tahun: number;
  Nomor: string;
  Tanggal: string;
  JthTempo: string;
  Rayon: string;
  Salesman: string;
  Tax: string;
  Customer: string;
  Total: number;
  Biaya_Promosi: number;
  Kontrak: number;
  DP: number;
  Bayar: number;
  Retur: number;
  Sisa_piutang: number;
  Overdue: number;
  Range_overdue: string;
  Tipe: string;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listFakturOutstandingApi = {
  getBrowse: async (params: FilterParams): Promise<ListFakturOutstandingRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListFakturOutstandingRow[] }>(
      "/laporan/list-faktur-outstanding",
      { params }
    );
    return data.data;
  },
};