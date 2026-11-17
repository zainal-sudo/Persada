// api/penjualan/bayarCustomerFormApi.ts
import api from "@/api/axios";

export interface BayarCustomerDetail {
  no?: number;
  salesman: string;
  invoice: string;
  tanggal: string;
  jthTempo: string;
  ppn: number;
  nilai: number;
  terbayar: number;
  bayar: number;
  pay: number;
  net: number;
  memo: string;
  /** 1 = baris termin dari faktur angsur (tjatuhtempofp). 0 = faktur biasa. */
  angsur?: number;
}

export interface ReturJualRow {
  nomor: string;
  tanggal: string;
  invoice: string;
  amount: number;
  memo: string;
  checked?: number;
}

export interface BayarCustomerForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  memo: string;
  isTax: number;
  cash: number;
  /** Kode rekening — inilah yang disimpan ke byc_rek_* dan masuk jurnal. */
  rekCash: string;
  /** Nama rekening, hanya untuk ditampilkan. Kosong = kode tidak resolve. */
  rekCashNama: string;
  transfer: number;
  rekTransfer: string;
  rekTransferNama: string;
  potongan: number;
  rekPotongan: string;
  rekPotonganNama: string;
  giro: number;
  rekGiro: string;
  rekGiroNama: string;
  noGiro: string;
  tglCair: string;
  ppn: number;
  rekPPN: string;
  rekPPNNama: string;
  pph: number;
  rekPPH: string;
  rekPPHNama: string;
  ntpn: string;
  detail: BayarCustomerDetail[];
  retur: ReturJualRow[];
}

export const bayarCustomerFormApi = {
  // GET /api/penjualan/bayar-customer/form/get-nomor?tanggal=
  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/penjualan/bayar-customer/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-customer/form/customer?search=
  getCustomer: async (search: string) => {
    const { data } = await api.get("/penjualan/bayar-customer/form/customer", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-customer/form/rekening?jenis=
  getRekening: async (jenis: string) => {
    const { data } = await api.get("/penjualan/bayar-customer/form/rekening", {
      params: { jenis },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-customer/form/invoice?cusKode=&isTax=
  getInvoice: async (cusKode: string, isTax: number) => {
    const { data } = await api.get("/penjualan/bayar-customer/form/invoice", {
      params: { cusKode, isTax },
    });
    return data.data;
  },

  // GET /api/penjualan/bayar-customer/form/retur-by-customer?cusKode=&nomorByc=
  getReturByCustomer: async (cusKode: string, nomorByc: string = "") => {
    const { data } = await api.get(
      "/penjualan/bayar-customer/form/retur-by-customer",
      { params: { cusKode, nomorByc } }
    );
    return data.data as ReturJualRow[];
  },

  // GET /api/penjualan/bayar-customer/form/get-batas/:kode — tsetting set_tgl
  getBatas: async (kode: string = "CR") => {
    const { data } = await api.get(
      `/penjualan/bayar-customer/form/get-batas/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  // GET /api/penjualan/bayar-customer/form/:nomor
  getDetailForm: async (nomor: string): Promise<BayarCustomerForm> => {
    const { data } = await api.get(
      `/penjualan/bayar-customer/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/bayar-customer/form/save
  save: async (payload: BayarCustomerForm) => {
    const { data } = await api.post("/penjualan/bayar-customer/form/save", payload);
    return data;
  },
};