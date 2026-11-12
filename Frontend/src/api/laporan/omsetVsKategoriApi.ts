// api/laporan/omsetVsKategoriApi.ts
import api from "@/api/axios";

export interface OmsetKategoriRow {
  Outlet: string;
  Omset: number;
  [kategori: string]: string | number;
}

export interface OmsetKategoriFilter {
  startDate: string;
  endDate: string;
  kategori1?: string;
  kategori2?: string;
  kategori3?: string;
}

export const omsetVsKategoriApi = {
  getKategori: async (): Promise<{ kode: string; kategori: string }[]> => {
    const { data } = await api.get<{ success: boolean; data: { kode: string; kategori: string }[] }>(
      "/laporan/omset-vs-kategori/kategori",
    );
    return data.data;
  },

  getBrowse: async (params: OmsetKategoriFilter): Promise<OmsetKategoriRow[]> => {
    const { data } = await api.get<{ success: boolean; data: OmsetKategoriRow[] }>(
      "/laporan/omset-vs-kategori",
      { params },
    );
    return data.data;
  },
};
