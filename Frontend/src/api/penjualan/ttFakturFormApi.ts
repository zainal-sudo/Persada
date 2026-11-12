// api/penjualan/ttFakturFormApi.ts
import api from "@/api/axios";

export interface TTFakturDetail {
  no?: number;
  nomorFaktur: string;
  tanggal: string;
  nilai: number;
  check: boolean;
  nilai2: number;
}

export interface TTFakturForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  slsKode: string;
  slsNama: string;
  cusKode: string;
  cusNama: string;
  detail: TTFakturDetail[];
}

export const ttFakturFormApi = {
  // GET /api/penjualan/tt-faktur/form/salesman
  getSalesman: async () => {
    const { data } = await api.get("/penjualan/tt-faktur/form/salesman");
    return data.data;
  },

  // GET /api/penjualan/tt-faktur/form/customer?search=
  getCustomer: async (search: string) => {
    const { data } = await api.get("/penjualan/tt-faktur/form/customer", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/tt-faktur/form/invoice?cusKode=
  getInvoice: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/tt-faktur/form/invoice", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/tt-faktur/form/get-nomor?slsKode=
  getNomor: async (slsKode: string) => {
    const { data } = await api.get("/penjualan/tt-faktur/form/get-nomor", {
      params: { slsKode },
    });
    return data.data;
  },

  // GET /api/penjualan/tt-faktur/form/:nomor
  getDetailForm: async (nomor: string): Promise<TTFakturForm> => {
    const { data } = await api.get(
      `/penjualan/tt-faktur/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/tt-faktur/form/save
  save: async (payload: TTFakturForm) => {
    const { data } = await api.post("/penjualan/tt-faktur/form/save", payload);
    return data;
  },
};