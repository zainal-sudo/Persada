// api/persediaan/titipApi.ts
import api from "@/api/axios";

export interface TitipRow {
  Nomor: string;
  Tanggal: string;
  Gudang: string;
  Nama_Gudang: string;
  User: string;
}

export interface TitipDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Expired: string;
  Batch: string;
}

export const titipApi = {
  // GET /api/persediaan/titip?startDate=&endDate=
  getBrowse: async (startDate: string, endDate: string): Promise<TitipRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TitipRow[] }>(
      "/persediaan/titip",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  // GET /api/persediaan/titip/detail/:nomor
  getDetail: async (nomor: string): Promise<TitipDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TitipDetailRow[] }>(
      `/persediaan/titip/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // DELETE /api/persediaan/titip/:nomor
  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/persediaan/titip/${encodeURIComponent(nomor)}`);
  },
};
