// api/laporan/itemMarginMinusApi.ts
import api from "@/api/axios";

export interface ItemMarginMinusRow {
  Kode: string;
  Nama: string;
  Nomor_DO: string;
  Nomor: string;
  Tanggal: string;
  Customer: string;
  hpp: number;
  net: number;
  Lastcost: number;
}

export interface ItemMarginMinusFilter {
  startDate: string;
  endDate: string;
}

export const itemMarginMinusApi = {
  getBrowse: async (params: ItemMarginMinusFilter): Promise<ItemMarginMinusRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ItemMarginMinusRow[] }>(
      "/laporan/item-margin-minus",
      { params }
    );
    return data.data;
  },
};