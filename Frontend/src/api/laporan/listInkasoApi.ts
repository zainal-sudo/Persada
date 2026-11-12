// api/laporan/listInkasoApi.ts
import api from "@/api/axios";

export interface ListInkasoRow {
  Nomor: string;
  Tanggal: string;
  Customer: string;
  Tax: number;
  Salesman: string;
  Terbayar: number;
  Ppn: number;
  BiayaPromosi: number;
  Kontrak: number;
  TglBayar: string;
  Bulan: number;
  Tahun: number;
  Selisih_Hari: number;
  Range_Hari: string;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listInkasoApi = {
  getBrowse: async (params: FilterParams): Promise<ListInkasoRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListInkasoRow[] }>(
      "/laporan/list-inkaso",
      { params }
    );
    return data.data;
  },
};