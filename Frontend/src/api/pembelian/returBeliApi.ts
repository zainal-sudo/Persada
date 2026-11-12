// api/pembelian/returBeliApi.ts
import api from "@/api/axios";

export interface ReturBeliRow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Supplier: string;
  Total: number;
  Ppn: number;
  Invoice: string;
}

export interface ReturBeliDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
  IDBatch: string;
}

export const returBeliApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<ReturBeliRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ReturBeliRow[] }>(
      "/pembelian/retur-beli",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<ReturBeliDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ReturBeliDetailRow[] }>(
      `/pembelian/retur-beli/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/pembelian/retur-beli/${encodeURIComponent(nomor)}`);
  },

  getPrintData: async (nomor: string) => {
    const { data } = await api.get(
      `/pembelian/retur-beli/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};
