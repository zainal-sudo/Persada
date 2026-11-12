import api from "@/api/axios";

export interface PenyesuaianStokRow {
  Nomor: string;
  Tanggal: string;
  Gudang: string;
  Keterangan: string;
  Total: number;
  Total_Price: number;
}

export interface PenyesuaianStokDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Expired: string;
  Satuan: string;
  QtyKorksi: number;
  Nilai: number;
  Nilai_Price: number;
}

export const penyesuaianStokApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<PenyesuaianStokRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PenyesuaianStokRow[] }>(
      "/persediaan/penyesuaian-stok",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<PenyesuaianStokDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PenyesuaianStokDetailRow[] }>(
      `/persediaan/penyesuaian-stok/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};