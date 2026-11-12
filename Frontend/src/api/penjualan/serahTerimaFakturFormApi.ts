// api/penjualan/serahTerimaFakturFormApi.ts
import api from "@/api/axios";

export interface SerahTerimaFakturInvoice {
  salesman: string;
  faktur: string;
  tanggal: string;
  ppn: number;
  nilai: number;
  customer: string;
  check: number;
}

export interface SerahTerimaFakturPihak {
  kode: string;
  nama: string;
}

export interface SerahTerimaFakturForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  serah: string;
  serahNama: string;
  terima: string;
  terimaNama: string;
  memo: string;
  detail: SerahTerimaFakturInvoice[];
}

export const serahTerimaFakturFormApi = {
  // GET /api/penjualan/serah-terima-faktur/form/get-nomor?tanggal=
  getNomor: async (tanggal: string): Promise<{ nomor: string }> => {
    const { data } = await api.get(
      "/penjualan/serah-terima-faktur/form/get-nomor",
      { params: { tanggal } }
    );
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur/form/users
  // Penyerah dan Penerima sama-sama dari tuser yang user_faktur = 1.
  getUsers: async (): Promise<SerahTerimaFakturPihak[]> => {
    const { data } = await api.get(
      "/penjualan/serah-terima-faktur/form/users"
    );
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur/form/invoice?penyerah=
  getInvoice: async (
    penyerah: string
  ): Promise<SerahTerimaFakturInvoice[]> => {
    const { data } = await api.get(
      "/penjualan/serah-terima-faktur/form/invoice",
      { params: { penyerah } }
    );
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur/form/:nomor
  getDetailForm: async (nomor: string): Promise<SerahTerimaFakturForm> => {
    const { data } = await api.get(
      `/penjualan/serah-terima-faktur/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/serah-terima-faktur/form/save
  save: async (payload: SerahTerimaFakturForm) => {
    const { data } = await api.post(
      "/penjualan/serah-terima-faktur/form/save",
      payload
    );
    return data;
  },
};
