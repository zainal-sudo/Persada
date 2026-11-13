// api/penjualan/fpApi.ts
import api from "@/api/axios";

export interface FPRow {
  Nomor: string;
  DO_Nomor: string;
  Tanggal: string;
  JthTempo: string;
  Memo: string;
  Tax: string;
  Salesman: string;
  Kode_Cust: string;
  Customer: string;
  Total: number;
  Ppn: number;
  Retur: number;
  Disc_Faktur: number;
  Biaya_Promosi: number;
  Kontrak: number;
  Freight: number;
  Bayar: number;
  Status_Bayar: string;
  Kembali: number;
  Keterangan: string;
  Status_Faktur: string;
  Status_Cetak: string;
  Tipe: string;
  DTP: string;
  IsCatalog: string;
}

export interface FPDetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Harga: number;
  Disc: number;
  Nilai: number;
  Kontrak: number;
  ED: string | null;
  Batch: string;
}

export interface HistoryBayarRow {
  Nomor: string;
  Tanggal: string;
  NomorFP: string;
  Bayar: number;
}

export interface EditJtDetail {
  tanggaljt: string;
  total: number;
}

export interface EditJtData {
  nomor: string;
  tanggal: string;
  amount: number;
  jthTempo: string;
  cusNama: string;
  detail: EditJtDetail[];
}

export interface FPprintData {
  nomor: string;
  tanggal: string;
  jthtempo: string;
  memo: string;
  amount: number;
  taxamount: number;
  freight: number;
  dp: number;
  disc_faktur: number;
  disc_fakturpr: number;
  anilai: number;
  adiscfaktur: number;
  atotal: number;
  istax: number;
  cus_top: number;
  terbilang: string;
  cus_nama: string;
  cus_alamat: string;
  salesman: string;
  rekening: string;
  perusahaan: {
    nama: string;
    alamat: string;
    kota: string;
    notelp: string;
    npwp: string;
    pak: string;
    pj: string;
    pj_no: string;
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

export const fpApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<FPRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FPRow[] }>(
      "/penjualan/fp",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<FPDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: FPDetailRow[] }>(
      `/penjualan/fp/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/fp/${encodeURIComponent(nomor)}`);
  },

  // Print data
  getPrintData: async (nomor: string): Promise<FPprintData> => {
    const { data } = await api.get<{ success: boolean; data: FPprintData }>(
      `/penjualan/fp/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // PUT /api/penjualan/fp/cetak/:nomor — tandai FP sudah cetak; return wasPrinted utk konfirmasi re-cetak
  markPrinted: async (nomor: string): Promise<{ wasPrinted: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { wasPrinted: boolean } }>(
      `/penjualan/fp/cetak/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getBarisSlip: async (nama: string = "FP"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/penjualan/fp/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },

  // PUT /api/penjualan/fp/kembali/:nomor — toggle status Kembali
  toggleKembali: async (nomor: string): Promise<{ kembali: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { kembali: boolean } }>(
      `/penjualan/fp/kembali/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // PUT /api/penjualan/fp/bayar/:nomor — toggle status Bayar (FINANCE saja)
  toggleBayar: async (nomor: string): Promise<{ bayar: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { bayar: boolean } }>(
      `/penjualan/fp/bayar/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/fp/history-bayar/:nomor
  getHistoryBayar: async (nomor: string) => {
    const { data } = await api.get<{ success: boolean; data: HistoryBayarRow[] }>(
      `/penjualan/fp/history-bayar/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/fp/print-retur/:nomor — Cetak V RET (doslip4)
  getPrintDataRetur: async (nomor: string): Promise<FPprintData> => {
    const { data } = await api.get<{ success: boolean; data: FPprintData }>(
      `/penjualan/fp/print-retur/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/fp/edit-jt/:nomor — load angsuran jatuh tempo
  getEditJt: async (nomor: string): Promise<EditJtData> => {
    const { data } = await api.get<{ success: boolean; data: EditJtData }>(
      `/penjualan/fp/edit-jt/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/fp/edit-jt/save
  saveEditJt: async (nomor: string, detail: EditJtDetail[]): Promise<void> => {
    await api.post("/penjualan/fp/edit-jt/save", { nomor, detail });
  },
};