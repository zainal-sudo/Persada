// api/penjualan/returPenjualanApi.ts
import api from "@/api/axios";

export interface ReturPenjualanRow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Customer: string;
  Salesman: string;
  Total: number;
  Ppn: number;
  Retur_CN: number;
  Nomor_Faktur: string;
}

export interface ReturPenjualanDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
}

export const returPenjualanApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<ReturPenjualanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ReturPenjualanRow[] }>(
      "/penjualan/retur-penjualan",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<ReturPenjualanDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ReturPenjualanDetailRow[] }>(
      `/penjualan/retur-penjualan/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/retur-penjualan/${encodeURIComponent(nomor)}`);
  },

  getPrintData: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/retur-penjualan/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};