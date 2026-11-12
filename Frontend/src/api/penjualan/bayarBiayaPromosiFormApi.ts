// api/penjualan/bayarBiayaPromosiFormApi.ts
import api from "@/api/axios";

export interface BayarBiayaPromosiDetail {
  no?: number;
  invoice: string;
  tanggal: string;
  jthTempo: string;
  biayaPromosi: number;
  bayar: number;
  pay: number;
  status: string;
}

export interface BayarBiayaPromosiForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  rekKode: string;
  rekNama: string;
  nilai: number;
  keterangan: string;
  detail: BayarBiayaPromosiDetail[];
}

export const bayarBiayaPromosiFormApi = {
  // GET /api/penjualan/bayar-biaya-promosi/form/get-nomor?tanggal=
  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/penjualan/bayar-biaya-promosi/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-biaya-promosi/form/customer?search=
  getCustomer: async (search: string) => {
    const { data } = await api.get("/penjualan/bayar-biaya-promosi/form/customer", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-biaya-promosi/form/rekening
  getRekening: async () => {
    const { data } = await api.get("/penjualan/bayar-biaya-promosi/form/rekening");
    return data.data;
  },

  // GET /api/penjualan/bayar-biaya-promosi/form/invoice?cusKode=
  getInvoice: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/bayar-biaya-promosi/form/invoice", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-biaya-promosi/form/:nomor
  getDetailForm: async (nomor: string): Promise<BayarBiayaPromosiForm> => {
    const { data } = await api.get(
      `/penjualan/bayar-biaya-promosi/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/bayar-biaya-promosi/form/save
  save: async (payload: BayarBiayaPromosiForm) => {
    const { data } = await api.post("/penjualan/bayar-biaya-promosi/form/save", payload);
    return data;
  },
};