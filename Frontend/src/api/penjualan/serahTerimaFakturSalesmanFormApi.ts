// api/penjualan/serahTerimaFakturSalesmanFormApi.ts
import api from "@/api/axios";

export interface SerahTerimaFakturSalesmanDetail {
  no?: number;
  customer: string;
  faktur: string;
  tanggal: string;
  ppn: number;
  nilai: number;
  jatuhTempo: string;
  overdue: string;
  rangeOverdue: string;
  check: number;
}

export interface SerahTerimaFakturSalesmanForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  slsKode: string;
  slsNama: string;
  memo: string;
  detail: SerahTerimaFakturSalesmanDetail[];
}

export const serahTerimaFakturSalesmanFormApi = {
  // GET /api/penjualan/serah-terima-faktur-salesman/form/get-nomor?tanggal=
  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/penjualan/serah-terima-faktur-salesman/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur-salesman/form/salesman
  getSalesman: async () => {
    const { data } = await api.get("/penjualan/serah-terima-faktur-salesman/form/salesman");
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur-salesman/form/invoice?slsKode=
  getInvoice: async (slsKode: string) => {
    const { data } = await api.get("/penjualan/serah-terima-faktur-salesman/form/invoice", {
      params: { slsKode },
    });
    return data.data;
  },

  // GET /api/penjualan/serah-terima-faktur-salesman/form/:nomor
  getDetailForm: async (nomor: string): Promise<SerahTerimaFakturSalesmanForm> => {
    const { data } = await api.get(
      `/penjualan/serah-terima-faktur-salesman/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/serah-terima-faktur-salesman/form/save
  save: async (payload: SerahTerimaFakturSalesmanForm) => {
    const { data } = await api.post("/penjualan/serah-terima-faktur-salesman/form/save", payload);
    return data;
  },
};