// api/pembelian/bpbApi.ts
import api from "@/api/axios";

export interface BPBRow {
  Nomor: string;
  Tanggal: string;
  PO: string;
  Memo: string;
  Supplier: string;
  Gudang: string;
  Total: number;
  Ppn: number;
  Status: string;
  User_create: string;
  date_create: string;
}

export interface BPBDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
  Expired: string;
  IdBatch: string;
}

export interface BPBPrintData {
  nomor: string;
  tanggal: string;
  po_nomor: string;
  memo: string;
  gudang: string;
  amount: number;
  taxamount: number;
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
    expired: string;
  }[];
}

export const bpbApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<BPBRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BPBRow[] }>(
      "/pembelian/bpb",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<BPBDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BPBDetailRow[] }>(
      `/pembelian/bpb/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getPrintData: async (nomor: string): Promise<BPBPrintData> => {
    const { data } = await api.get<{ success: boolean; data: BPBPrintData }>(
      `/pembelian/bpb/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/pembelian/bpb/${encodeURIComponent(nomor)}`);
  },

  getBarisSlip: async (nama: string = "BPB"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/pembelian/bpb/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};
