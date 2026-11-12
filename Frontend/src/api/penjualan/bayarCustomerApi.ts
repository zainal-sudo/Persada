// api/penjualan/bayarCustomerApi.ts
import api from "@/api/axios";

export interface BayarCustomerRow {
  Nomor: string;
  Tanggal: string;
  Status: string;
  Kode_Cust: string;
  Customer: string;
  Salesman: string;
  Cash: number;
  Transfer: number;
  Potongan: number;
  Giro: number;
  GiroNumber: string;
  TglCair: string;
  Rekening_Cash: string;
  Rekening_Transfer: string;
  PPN: number;
  PPH: number;
  NTPN: string;
  Dtp: number;
  date_create: string;
  date_modified: string;
}

export interface BayarCustomerDetailRow {
  Nomor: string;
  Invoice: string;
  Tgl_Invoice: string;
  JthTempo: string;
  Nilai: number;
  Bayar: number;
}

export interface BYCPrintData {
  nomor: string;
  tanggal: string;
  noGiro: string;
  tglCair: string;
  cusNama: string;
  cusAlamat: string;
  // Nama rekening yang dipakai pada slip (dari join trekening).
  rekCash: string;
  rekTransfer: string;
  rekGiro: string;
  rekPotongan: string;
  rekPPN: string;
  rekPPH: string;
  nilaiTotal: number;
  terbilang: string;
  memo: string;
  perusahaan: {
    nama: string;
    alamat: string;
    kota: string;
    notelp: string;
    nofax: string;
  };
  detail: {
    no: number;
    fpNomor: string;
    fpTanggal: string;
    fpJthTempo: string;
    jumlah: number;
    terutang: number;
    bayar: number;
  }[];
  totalBayar: number;
}

export const bayarCustomerApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<BayarCustomerRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarCustomerRow[] }>(
      "/penjualan/bayar-customer",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<BayarCustomerDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarCustomerDetailRow[] }>(
      `/penjualan/bayar-customer/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /penjualan/bayar-customer/print/:nomor — data cetak PENERIMAAN CUSTOMER (browser print)
  getPrintData: async (nomor: string): Promise<BYCPrintData> => {
    const { data } = await api.get<{ success: boolean; data: BYCPrintData }>(
      `/penjualan/bayar-customer/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/bayar-customer/${encodeURIComponent(nomor)}`);
  },
};