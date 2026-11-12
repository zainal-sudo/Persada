// api/penjualan/listJualPerItemAkumulatifApi.ts
import api from "@/api/axios";

export interface ListJualPerItemAkumulatifRow {
  Bulan: number;
  Tahun: number;
  Kode: string;
  Nama: string;
  Satuan: string;
  Kategori: string;
  Qty: number;
  Nilai: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
}

export const listJualPerItemAkumulatifApi = {
  getBrowse: async (params: FilterParams): Promise<ListJualPerItemAkumulatifRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJualPerItemAkumulatifRow[] }>(
      "/penjualan/list-jual-per-item-akumulatif",
      { params }
    );
    return data.data;
  },
};