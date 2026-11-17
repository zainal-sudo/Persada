import api from "@/api/axios";

export interface BarangRow {
  Kode: string;
  Nama: string;
  Satuan: string;
  Kategori: string;
  Tipe: string;
  HargaJual: number;
  Stok: number;
  Min: number;
  Disc_Salesman: number;
  Merk: string;
  Aktif: number;
  Product_Focus: string;
  Last_Sale: string | null;
  Stok_Baik: number;
  Avgs_Sales_per_Bulan: number;
  TOR: number;
  IN_Terakhir: string | null;
  Divisi: string;
  IsKonsinyasi: number;
}

export interface BarangDetailRow {
  Kode: string;
  KD_Gudang: string;
  Gudang: string;
  Expired: string;
  stok: number;
}

export const barangApi = {
  getBrowse: async (search: string): Promise<BarangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BarangRow[] }>(
      "/persediaan/barang",
      { params: { search } }
    );
    return data.data;
  },

  getDetail: async (kode: string): Promise<BarangDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BarangDetailRow[] }>(
      `/persediaan/barang/detail/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  toggleAktif: async (kode: string): Promise<{ aktif: boolean }> => {
    const { data } = await api.put(`/persediaan/barang/aktif/${encodeURIComponent(kode)}`);
    return data.data;
  },
};