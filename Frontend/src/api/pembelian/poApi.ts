// api/pembelian/poApi.ts
import api from "@/api/axios";

export interface PORow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Supplier: string;
  Pemesan: string;
  Closed: string;
  Total: number;
  Ppn: number;
  Dateline: string;
  User_create: string;
  date_create: string;
}

export interface PODetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Kurang: number;
  Harga: number;
  Disc: number;
  Nilai: number;
}

export interface POPrintData {
  nomor: string;
  tanggal: string;
  dateline: string;
  memo: string;
  pemesan: string;
  amount: number;
  taxamount: number;
  discFaktur: number;
  discFakturPr: number;
  sup_nama: string;
  sup_alamat: string;
  sup_telp: string;
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

export const poApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<PORow[]> => {
    const { data } = await api.get<{ success: boolean; data: PORow[] }>(
      "/pembelian/po",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<PODetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PODetailRow[] }>(
      `/pembelian/po/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getPrintData: async (nomor: string): Promise<POPrintData> => {
    const { data } = await api.get<{ success: boolean; data: POPrintData }>(
      `/pembelian/po/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/pembelian/po/${encodeURIComponent(nomor)}`);
  },

  toggleClose: async (nomor: string): Promise<{ closed: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { closed: boolean } }>(
      `/pembelian/po/close/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getBarisSlip: async (nama: string = "PO"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/pembelian/po/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};
