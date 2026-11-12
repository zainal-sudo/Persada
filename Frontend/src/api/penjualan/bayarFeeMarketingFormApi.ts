// api/penjualan/bayarFeeMarketingFormApi.ts
import api from "@/api/axios";

export interface BayarFeeMarketingDetail {
  no?: number;
  invoice: string;
  tanggal: string;
  jthTempo: string;
  feeMarketing: number;
  bayar: number;
  pay: number;
  status: string;
}

export interface BayarFeeMarketingForm {
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
  detail: BayarFeeMarketingDetail[];
}

export const bayarFeeMarketingFormApi = {
  // GET /api/penjualan/bayar-fee-marketing/form/get-nomor?tanggal=
  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/penjualan/bayar-fee-marketing/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-fee-marketing/form/customer?search=
  getCustomer: async (search: string) => {
    const { data } = await api.get("/penjualan/bayar-fee-marketing/form/customer", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-fee-marketing/form/rekening
  getRekening: async () => {
    const { data } = await api.get("/penjualan/bayar-fee-marketing/form/rekening");
    return data.data;
  },

  // GET /api/penjualan/bayar-fee-marketing/form/invoice?cusKode=
  getInvoice: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/bayar-fee-marketing/form/invoice", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-fee-marketing/form/:nomor
  getDetailForm: async (nomor: string): Promise<BayarFeeMarketingForm> => {
    const { data } = await api.get(
      `/penjualan/bayar-fee-marketing/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/bayar-fee-marketing/form/save
  save: async (payload: BayarFeeMarketingForm) => {
    const { data } = await api.post("/penjualan/bayar-fee-marketing/form/save", payload);
    return data;
  },
};