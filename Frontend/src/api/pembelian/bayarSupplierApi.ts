// api/pembelian/bayarSupplierApi.ts
import api from "@/api/axios";

export interface BayarSupplierRow {
  Nomor: string;
  Tanggal: string;
  Memo: string;
  Tax: string;
  Kode: string;
  Supplier: string;
  Total: number;
  Giro: string;
  TglCair: string;
  Rekening: string;
}

export interface BayarSupplierDetailRow {
  Nomor: string;
  Invoice: string;
  Nobukti: string;
  Tgl_Invoice: string;
  JthTempo: string;
  Nilai: number;
  Retur: number;
  Bayar: number;
}

export interface BayarSupplierPrintData {
  nomor: string;
  tanggal: string;
  memo: string;
  nogiro: string;
  tglcair: string;
  bys_nilai: number;
  sup_nama: string;
  sup_alamat: string;
  rek_nama: string;
  terbilang: string;
  perusahaan: {
    nama: string;
    alamat: string;
    kota: string;
    notelp: string;
  };
  detail: {
    invoice: string;
    nobukti: string;
    tanggal: string;
    bayar: number;
  }[];
}

export const bayarSupplierApi = {
  getBrowse: async (
    startDate: string,
    endDate: string
  ): Promise<BayarSupplierRow[]> => {
    const { data } = await api.get<{ success: boolean; data: BayarSupplierRow[] }>(
      "/pembelian/bayar-supplier",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<BayarSupplierDetailRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: BayarSupplierDetailRow[];
    }>(`/pembelian/bayar-supplier/detail/${encodeURIComponent(nomor)}`);
    return data.data;
  },

  getPrintData: async (nomor: string): Promise<BayarSupplierPrintData> => {
    const { data } = await api.get<{
      success: boolean;
      data: BayarSupplierPrintData;
    }>(`/pembelian/bayar-supplier/print/${encodeURIComponent(nomor)}`);
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/pembelian/bayar-supplier/${encodeURIComponent(nomor)}`);
  },

  getBarisSlip: async (nama: string = "VP"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/pembelian/bayar-supplier/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};
