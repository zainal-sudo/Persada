// api/penjualan/fakturPajakApi.ts
import api from "@/api/axios";

export interface FakturPajakRow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Salesman: string;
  Customer: string;
  Total: number;
  Ppn: number;
  Disc_Faktur: number;
  FakturPajak: string;
  TglPajak: string;
  Ismanual: string;
  date_create: string;
}

export interface FakturPajakDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
}

export const fakturPajakApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<FakturPajakRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FakturPajakRow[] }>(
      "/penjualan/faktur-pajak",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<FakturPajakDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FakturPajakDetailRow[] }>(
      `/penjualan/faktur-pajak/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/faktur-pajak/${encodeURIComponent(nomor)}`);
  },
};