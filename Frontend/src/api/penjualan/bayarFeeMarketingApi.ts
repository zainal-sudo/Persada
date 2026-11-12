// api/penjualan/bayarFeeMarketingApi.ts
import api from "@/api/axios";

export interface BayarFeeMarketingRow {
  Nomor: string;
  Tanggal: string;
  Customer: string;
  Salesman: string;
  Nilai: number;
  Rekening: string;
  Keterangan: string;
}

export interface BayarFeeMarketingDetailRow {
  Nomor: string;
  Invoice: string;
  Tgl_Invoice: string;
  JthTempo: string;
  Bayar: number;
}

export interface BYFPrintData {
  nomor: string;
  tanggal: string;
  cusNama: string;
  nilai: number;
  rekNama: string;
  terbilang: string;
  memo: string;
  perusahaan: {
    nama: string;
    alamat: string;
    notelp: string;
  };
  detail: {
    no: number;
    fpNomor: string;
    fpTanggal: string;
    fpJthTempo: string;
    bayar: number;
  }[];
  totalBayar: number;
}

export const bayarFeeMarketingApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<BayarFeeMarketingRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarFeeMarketingRow[] }>(
      "/penjualan/bayar-fee-marketing",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<BayarFeeMarketingDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarFeeMarketingDetailRow[] }>(
      `/penjualan/bayar-fee-marketing/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /penjualan/bayar-fee-marketing/print/:nomor — data cetak BUKTI PENERIMAAN KAS/BANK (browser print)
  getPrintData: async (nomor: string): Promise<BYFPrintData> => {
    const { data } = await api.get<{ success: boolean; data: BYFPrintData }>(
      `/penjualan/bayar-fee-marketing/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/bayar-fee-marketing/${encodeURIComponent(nomor)}`);
  },
};