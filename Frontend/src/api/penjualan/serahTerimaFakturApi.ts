// api/penjualan/serahTerimaFakturApi.ts
// Serah Terima Faktur (varian tabel tanpa suffix "2"). Bukan
// serahTerimaFakturSalesmanApi.ts, yang memakai tabel ..._hdr2/_dtl2.
import api from "@/api/axios";

export interface SerahTerimaFakturRow {
  Nomor: string;
  Tanggal: string;
  Serah: string;
  Terima: string;
  Realisasi: string;
  Note: string;
}

export interface SerahTerimaFakturDetailRow {
  Nomor: string;
  Faktur: string;
  Tanggal: string;
  JthTempo: string;
  Nilai: number;
  Customer: string;
}

export interface SerahTerimaFakturPrintHeader {
  nomor: string;
  tanggal: string;
  memo: string;
  serah: string;
  terima: string;
  realisasi: number;
}

export interface SerahTerimaFakturPrintDetail {
  faktur: string;
  customer: string;
  tanggal: string;
  nilai: number;
  salesman: string;
}

export interface SerahTerimaFakturPrintData {
  header: SerahTerimaFakturPrintHeader;
  detail: SerahTerimaFakturPrintDetail[];
}

export const serahTerimaFakturApi = {
  getBrowse: async (
    startDate: string,
    endDate: string
  ): Promise<SerahTerimaFakturRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: SerahTerimaFakturRow[];
    }>("/penjualan/serah-terima-faktur", { params: { startDate, endDate } });
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SerahTerimaFakturDetailRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: SerahTerimaFakturDetailRow[];
    }>(
      `/penjualan/serah-terima-faktur/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  realisasi: async (nomor: string): Promise<void> => {
    await api.put(
      `/penjualan/serah-terima-faktur/${encodeURIComponent(nomor)}/realisasi`
    );
  },

  getPrintData: async (nomor: string): Promise<SerahTerimaFakturPrintData> => {
    const { data } = await api.get<{
      success: boolean;
      data: SerahTerimaFakturPrintData;
    }>(`/penjualan/serah-terima-faktur/print/${encodeURIComponent(nomor)}`);
    return data.data;
  },
};
