// api/laporan/inkasoBawahHetApi.ts
import api from "@/api/axios";

export interface InkasoBawahHetRow {
  Noreferensi: string;
  Salesman: string;
  Bayar: number;
  Tgl_Bayar: string;
  Tanggal_Faktur: string;
  SelisihHari: number;
  pengurang: number;
  Customer: string;
}

export interface InkasoBawahHetDetailRow {
  Noreferensi: string;
  brg_nama: string;
  qty: number;
  Net: number;
  HET: number;
}

export interface InkasoBawahHetFilter {
  bulan: number;
  tahun: number;
}

export const inkasoBawahHetApi = {
  getBrowse: async (params: InkasoBawahHetFilter): Promise<InkasoBawahHetRow[]> => {
    const { data } = await api.get<{ success: boolean; data: InkasoBawahHetRow[] }>(
      "/laporan/inkaso-bawah-het",
      { params },
    );
    return data.data;
  },

  getDetail: async (noreferensi: string): Promise<InkasoBawahHetDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: InkasoBawahHetDetailRow[] }>(
      "/laporan/inkaso-bawah-het/detail",
      { params: { noreferensi } },
    );
    return data.data;
  },
};
