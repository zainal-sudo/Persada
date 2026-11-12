// api/laporan/historyHargaJualApi.ts
import api from "@/api/axios";

export interface HistoryHargaJualRow {
  Kode: string;
  Nama: string;
  Satuan: string;
  Kategori: string;
  Merk: string;
}

export interface HistoryHargaJualDetailRow {
  Kode: string;
  Customer: string;
  Harga: number;
  Disc: number;
  Kontrak: number;
  HargaNet: number;
  Salesman: string;
  Status: string;
}

export interface HistoryHargaJualFilter {
  bulan: number;
  tahun: number;
}

export const historyHargaJualApi = {
  getBrowse: async (params: HistoryHargaJualFilter): Promise<HistoryHargaJualRow[]> => {
    const { data } = await api.get<{ success: boolean; data: HistoryHargaJualRow[] }>(
      "/laporan/history-harga-jual",
      { params: { bulan: params.bulan, tahun: params.tahun } }
    );
    return data.data;
  },
  getDetail: async (kode: string, params: HistoryHargaJualFilter): Promise<HistoryHargaJualDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: HistoryHargaJualDetailRow[] }>(
      "/laporan/history-harga-jual/detail",
      { params: { kode, bulan: params.bulan, tahun: params.tahun } }
    );
    return data.data;
  },
};