// api/pembelian/bayarSupplierFormApi.ts
import api from "@/api/axios";

export interface InvoiceBayarRow {
  invoice: string;
  nobukti: string;
  nopajak: string;
  tanggal: string;
  jthTempo: string;
  nilai: number;
  terbayar: number;
  bayar: number;
  pay: number;
  bayarTampil?: string;
}

export interface BayarSupplierForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  supKode: string;
  supNama: string;
  rekKode: string;
  rekNama: string;
  memo: string;
  giro: string;
  tglCair: string;
  nilai: number;
  isTax: number;
  detail: InvoiceBayarRow[];
}

export const bayarSupplierFormApi = {
  getSupplier: async (search: string) => {
    const { data } = await api.get("/pembelian/bayar-supplier/form/supplier", {
      params: { search },
    });
    return data.data;
  },

  getRekening: async (search: string) => {
    const { data } = await api.get("/pembelian/bayar-supplier/form/rekening", {
      params: { search },
    });
    return data.data;
  },

  getInvoiceBySupplier: async (
    supKode: string,
    isTax: number,
    isEdit: boolean = false,
    nomorBys: string = ""
  ): Promise<InvoiceBayarRow[]> => {
    const { data } = await api.get(
      "/pembelian/bayar-supplier/form/invoice-by-supplier",
      { params: { supKode, isTax, isEdit, nomorBys } }
    );
    return data.data;
  },

  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/pembelian/bayar-supplier/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  getDetailForm: async (nomor: string): Promise<BayarSupplierForm> => {
    const { data } = await api.get(
      `/pembelian/bayar-supplier/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: BayarSupplierForm) => {
    const { data } = await api.post(
      "/pembelian/bayar-supplier/form/save",
      payload
    );
    return data;
  },
};
