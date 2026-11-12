// api/laporan/listMutasiStokApi.ts
import api from "@/api/axios";

export interface ListMutasiStokRow {
  Kode: string;
  Nama: string;
  Kategori: string;
  _Awal: number;
  V_Awal: number;
  _In: number;
  V_In: number;
  _Out: number;
  V_Out: number;
  _Akhir: number;
  V_Akhir: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
  gudang: string;
}

export const listMutasiStokApi = {
  getBrowse: async (params: FilterParams): Promise<ListMutasiStokRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListMutasiStokRow[] }>(
      "/laporan/list-mutasi-stok",
      { params }
    );
    return data.data;
  },
};