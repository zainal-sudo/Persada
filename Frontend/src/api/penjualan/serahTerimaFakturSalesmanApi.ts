// api/penjualan/serahTerimaFakturSalesmanApi.ts
import api from "@/api/axios";

export interface SerahTerimaFakturSalesmanRow {
  Nomor: string;
  Tanggal: string;
  SlsKode: string;
  Note: string;
}

export interface SerahTerimaFakturSalesmanDetailRow {
  Nomor: string;
  Faktur: string;
  Tanggal: string;
  JthTempo: string;
  Nilai: number;
  Customer: string;
}

export const serahTerimaFakturSalesmanApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<SerahTerimaFakturSalesmanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SerahTerimaFakturSalesmanRow[] }>(
      "/penjualan/serah-terima-faktur-salesman",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SerahTerimaFakturSalesmanDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SerahTerimaFakturSalesmanDetailRow[] }>(
      `/penjualan/serah-terima-faktur-salesman/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/serah-terima-faktur-salesman/${encodeURIComponent(nomor)}`);
  },
};