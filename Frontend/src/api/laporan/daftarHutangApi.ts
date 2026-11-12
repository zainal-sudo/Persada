import api from "@/api/axios";

export interface DaftarHutangRow {
  Nomor: string;
  Tanggal: string;
  JatuhTempo: string;
  SupKode: string;
  Nama: string;
  Total: number;
  Voucher: number;
  Bayar: number;
  [key: string]: any;
}

export interface DaftarHutangDetail {
  Nomor: string;
  No: number;
  KodeBarang: string;
  NamaBarang: string;
  Qty: number;
  Harga: number;
  Total: number;
  [key: string]: any;
}

export const daftarHutangApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<DaftarHutangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: DaftarHutangRow[] }>(
      "/laporan/daftar-hutang",
      { params: { startDate, endDate } }
    );
    return data.data;
  },
  getDetail: async (nomor: string): Promise<DaftarHutangDetail[]> => {
    const { data } = await api.get<{ success: boolean; data: DaftarHutangDetail[] }>(
      `/laporan/daftar-hutang/${encodeURIComponent(nomor)}/detail`
    );
    return data.data;
  },
};
