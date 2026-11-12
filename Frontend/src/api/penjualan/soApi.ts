// api/transaksi/soApi.ts
import api from "@/api/axios";

export interface SORow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Customer: string;
  Closed: string;
  Total: number;
  Ppn: number;
  Salesman: string;
  Kirim: string;
  Eceran: string;
  User_create: string;
  date_create: string;
}

export interface SODetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
  Terkirim: number;
}

export interface SOprintData {
  nomor: string;
  tanggal: string;
  memo: string;
  shipaddress: string;
  amount: number;
  taxamount: number;
  dp: number;
  discFaktur: number;
  nilai: number;
  total: number;
  cus_nama: string;
  cus_alamat: string;
  cus_telp: string;
  cus_fax: string;
  salesman: string;
  terbilang: string;
  perusahaan: {
    nama: string;
    alamat: string;
    kota: string;
    notelp: string;
  };
  detail: {
    nourut: number;
    kode: string;
    nama: string;
    satuan: string;
    qty: number;
    harga: number;
    discpr: number;
  }[];
}

export const soApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<SORow[]> => {
    const { data } = await api.get<{ success: boolean; data: SORow[] }>(
      "/penjualan/so",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SODetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SODetailRow[] }>(
      `/penjualan/so/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // Print data
  getPrintData: async (nomor: string): Promise<SOprintData> => {
    const { data } = await api.get<{ success: boolean; data: SOprintData }>(
      `/penjualan/so/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // BARU: delete
  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/so/${encodeURIComponent(nomor)}`);
  },

  // Toggle Closed
  toggleClose: async (nomor: string): Promise<{ closed: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { closed: boolean } }>(
      `/penjualan/so/close/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // Ambil jumlah baris per halaman dari barisslip
  getBarisSlip: async (nama: string = "SO"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/penjualan/so/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};