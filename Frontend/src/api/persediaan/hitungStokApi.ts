import api from "@/api/axios";

export interface HitungStokRow {
  Nomor: string;
  Tanggal: string;
  Gudang: string;
  Lokasi: string;
}

export interface HitungStokDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Jumlah: number;
  Satuan: string;
  Expired: string;
}

export const hitungStokApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<HitungStokRow[]> => {
    const { data } = await api.get<{ success: boolean; data: HitungStokRow[] }>(
      "/persediaan/hitung-stok",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<HitungStokDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: HitungStokDetailRow[] }>(
      `/persediaan/hitung-stok/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/persediaan/hitung-stok/${encodeURIComponent(nomor)}`);
  },
};