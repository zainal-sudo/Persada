// api/laporan/kartuStokApi.ts
import api from "@/api/axios";

export interface KartuStokRow {
  Kode: string;
  Nama: string;
  Kategori: string;
  Hbeli: number;
  _Awal: number;
  _In: number;
  _Out: number;
  _Akhir: number;
}

export interface KartuStokDetailRow {
  Kode: string;
  Nomor: string;
  Tanggal: string;
  Keterangan: string;
  Gudang: string;
  _IN: number;
  _OUT: number;
  Expired: string | null;
  Hargabeli: number;
  Customer: string | null;
  no_Faktur: string | null;
}

export interface KartuStokFilter {
  startDate: string;
  endDate: string;
  gudang: string;
}

export const kartuStokApi = {
  getBrowse: async (params: KartuStokFilter): Promise<KartuStokRow[]> => {
    const { data } = await api.get<{ success: boolean; data: KartuStokRow[] }>(
      "/laporan/kartu-stok",
      { params }
    );
    return data.data;
  },
  getDetail: async (
    kode: string,
    params: KartuStokFilter,
  ): Promise<KartuStokDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: KartuStokDetailRow[] }>(
      "/laporan/kartu-stok/detail",
      { params: { ...params, kode } }
    );
    return data.data;
  },
};