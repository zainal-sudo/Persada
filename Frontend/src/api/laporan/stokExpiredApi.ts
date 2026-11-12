// api/laporan/stokExpiredApi.ts
import api from "@/api/axios";

export interface StokExpiredRow {
  Kode: string;
  Nama: string;
  Expired: string;
  HargaBeli: number;
  Stok: number;
}

export interface FilterParams {
  startDate: string;
  gudang: string;
}

export const stokExpiredApi = {
  getBrowse: async (params: FilterParams): Promise<StokExpiredRow[]> => {
    const { data } = await api.get<{ success: boolean; data: StokExpiredRow[] }>(
      "/laporan/stok-expired",
      { params }
    );
    return data.data;
  },
};