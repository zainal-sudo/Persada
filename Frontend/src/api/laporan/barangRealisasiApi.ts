// api/laporan/barangRealisasiApi.ts
import api from "@/api/axios";

export interface BarangRealisasiRow {
  SKU: string;
  NamaBarang: string;
  Minta: number;
  Terima: number;
  Kurang: number;
}

export interface BarangRealisasiDetailRow {
  Nomor: string;
  Minta: number;
  Terima: number;
  Kurang: number;
  SKU: string;
}

export const barangRealisasiApi = {
  getBrowse: async (): Promise<BarangRealisasiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BarangRealisasiRow[] }>(
      "/laporan/barang-realisasi"
    );
    return data.data;
  },
  getDetail: async (kode: string): Promise<BarangRealisasiDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BarangRealisasiDetailRow[] }>(
      "/laporan/barang-realisasi/detail",
      { params: { kode } }
    );
    return data.data;
  },
};