// api/penjualan/ttFakturApi.ts
import api from "@/api/axios";

export interface TTFakturRow {
  Nomor: string;
  Tanggal: string;
  Salesman: string;
  Customer: string;
  Total: number;
}

export interface TTFakturDetailRow {
  Nomor: string;
  No_Faktur: string;
  Tanggal: string;
  JT_Tempo: string;
  Nilai: number;
  Sisa_piutang: number;
}

export const ttFakturApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<TTFakturRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TTFakturRow[] }>(
      "/penjualan/tt-faktur",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<TTFakturDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TTFakturDetailRow[] }>(
      `/penjualan/tt-faktur/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/tt-faktur/${encodeURIComponent(nomor)}`);
  },

  getPrintData: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/tt-faktur/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};