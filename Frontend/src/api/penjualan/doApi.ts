// api/penjualan/doApi.ts
import api from "@/api/axios";

export interface DORow {
  Nomor: string;
  Tanggal: string;
  Nomor_SO: string;
  Salesman: string;
  Customer: string;
  Invoiced: string;
  Kembali: number;
}

export interface DODetailRow {
  Nomor: string;
  Kode: number;
  Nama: string;
  Satuan: string;
  Jumlah: number;
  Jumlah_Invoiced: number;
  Expired: string;
  Batch: string;
}

export interface DOprintData {
  nomor: string;
  tanggal: string;
  shipaddress: string;
  cus_nama: string;
  cus_alamat: string;
  cus_telp: string;
  cus_fax: string;
  salesman: string;
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
        gudang: string;
        tgl_expired: string | null;
        idBatch: string;
      }[];
}

export const doApi = {
  // GET /api/penjualan/do?startDate=&endDate=
  getBrowse: async (startDate: string, endDate: string): Promise<DORow[]> => {
    const { data } = await api.get<{ success: boolean; data: DORow[] }>(
      "/penjualan/do",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  // GET /api/penjualan/do/detail/:nomor
  getDetail: async (nomor: string): Promise<DODetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: DODetailRow[] }>(
      `/penjualan/do/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // DELETE /api/penjualan/do/:nomor
  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/penjualan/do/${encodeURIComponent(nomor)}`);
  },

  // Print data
  getPrintData: async (nomor: string): Promise<DOprintData> => {
    const { data } = await api.get<{ success: boolean; data: DOprintData }>(
      `/penjualan/do/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // PUT /api/penjualan/do/kembali/:nomor — toggle status Kembali
  toggleKembali: async (nomor: string): Promise<{ kembali: boolean }> => {
    const { data } = await api.put<{ success: boolean; data: { kembali: boolean } }>(
      `/penjualan/do/kembali/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getBarisSlip: async (nama: string = "DO"): Promise<number> => {
    const { data } = await api.get<{ success: boolean; data: { baris: number } }>(
      `/penjualan/do/baris-slip/${encodeURIComponent(nama)}`
    );
    return data.data.baris;
  },
};