// api/pembelian/invoiceApi.ts
import api from "@/api/axios";

export interface InvoiceRow {
  Nomor: string;
  Nobukti: string;
  Tanggal: string;
  Jthtempo: string;
  Memo: string;
  Supplier: string;
  NoPajak: string;
  Total: number;
  Retur: number;
  Ppn: number;
  Dpp: number;
  Bayar: number;
  StatusBayar: string;
  Pajak: string;
}

export interface InvoiceDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
}

export interface InvoicePrintData {
  nomor: string;
  nobukti: string;
  tanggal: string;
  jthtempo: string;
  memo: string;
  amount: number;
  taxamount: number;
  freight: number;
  discFaktur: number;
  discFakturPr: number;
  nopajak: string;
  sup_nama: string;
  sup_alamat: string;
  sup_telp: string;
  bpb_nomor: string;
  po_nomor: string;
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

export const invoiceApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<InvoiceRow[]> => {
    const { data } = await api.get<{ success: boolean; data: InvoiceRow[] }>(
      "/pembelian/invoice",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<InvoiceDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: InvoiceDetailRow[] }>(
      `/pembelian/invoice/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getPrintData: async (nomor: string): Promise<InvoicePrintData> => {
    const { data } = await api.get<{ success: boolean; data: InvoicePrintData }>(
      `/pembelian/invoice/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/pembelian/invoice/${encodeURIComponent(nomor)}`);
  },

  togglePajak: async (nomor: string): Promise<{ pajak: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { pajak: boolean } }>(
      `/pembelian/invoice/toggle-pajak/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  setNoPajak: async (nomor: string, nopajak: string) => {
    const { data } = await api.put(
      `/pembelian/invoice/set-no-pajak/${encodeURIComponent(nomor)}`,
      { nopajak }
    );
    return data;
  },

  getHistoryPembayaran: async (nomor: string) => {
    const { data } = await api.get(
      `/pembelian/invoice/history-pembayaran/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getBarisSlip: async (nama: string = "INV"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/pembelian/invoice/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};
