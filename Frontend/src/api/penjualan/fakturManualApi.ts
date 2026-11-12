// api/penjualan/fakturManualApi.ts
import api from "@/api/axios";

export interface FakturManualRow {
  Nomor: string;
  Tanggal: string;
  JthTempo: string;
  Memo: string;
  Salesman: string;
  Customer: string;
  Total: number;
  Ppn: number;
  Disc_Faktur: number;
  CN: number;
  Freight: number;
  Bayar: number;
  Status_Bayar: string;
}

export interface FakturManualDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
}

export const fakturManualApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<FakturManualRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FakturManualRow[] }>(
      "/penjualan/faktur-manual",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<FakturManualDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FakturManualDetailRow[] }>(
      `/penjualan/faktur-manual/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/faktur-manual/${encodeURIComponent(nomor)}`);
  },

  getPrintData: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/faktur-manual/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};