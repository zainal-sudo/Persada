// api/penjualan/bayarBiayaPromosiApi.ts
import api from "@/api/axios";

export interface BayarBiayaPromosiRow {
  Nomor: string;
  Tanggal: string;
  Customer: string;
  Salesman: string;
  Nilai: number;
  Rekening: string;
  Keterangan: string;
}

export interface BayarBiayaPromosiDetailRow {
  Nomor: string;
  Invoice: string;
  Tgl_Invoice: string;
  JthTempo: string;
  Bayar: number;
}

export interface BYBPrintData {
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

export const bayarBiayaPromosiApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<BayarBiayaPromosiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarBiayaPromosiRow[] }>(
      "/penjualan/bayar-biaya-promosi",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<BayarBiayaPromosiDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarBiayaPromosiDetailRow[] }>(
      `/penjualan/bayar-biaya-promosi/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /penjualan/bayar-biaya-promosi/print/:nomor — data cetak BUKTI PENERIMAAN KAS/BANK (browser print)
  getPrintData: async (nomor: string): Promise<BYBPrintData> => {
    const { data } = await api.get<{ success: boolean; data: BYBPrintData }>(
      `/penjualan/bayar-biaya-promosi/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/bayar-biaya-promosi/${encodeURIComponent(nomor)}`);
  },
};