import api from "@/api/axios";

export interface PermintaanBarangRow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Closed: string;
  User: string;
  date_create: string;
}

export interface PermintaanBarangDetailRow {
  Nomor: string;
  SKU: string;
  NamaBarang: string;
  Satuan: string;
  QTY: number;
  QtyTerima: number;
  StokNow: number;
  AvgSale: number;
}

export const permintaanBarangApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<PermintaanBarangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PermintaanBarangRow[] }>(
      "/persediaan/permintaan-barang",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<PermintaanBarangDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PermintaanBarangDetailRow[] }>(
      `/persediaan/permintaan-barang/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/persediaan/permintaan-barang/${encodeURIComponent(nomor)}`);
  },

  toggleClosed: async (nomor: string): Promise<{ closed: number }> => {
    const { data } = await api.put(`/persediaan/permintaan-barang/closed/${encodeURIComponent(nomor)}`);
    return data.data;
  },
};