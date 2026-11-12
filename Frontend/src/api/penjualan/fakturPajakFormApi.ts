// api/penjualan/fakturPajakFormApi.ts
import api from "@/api/axios";

export interface FakturPajakFormDetail {
  no?: number;
  salesman: string;
  customer: string;
  kodeCust: string;
  doNomor: string;
  invoice: string;
  tanggal: string;
  ppn: number;
  nilai: number;
  status: number;
  negri: number;
  ismanual: number;
  noPajak: string;
  tanggalPajak: string;
  isDTP: number;
  adaRetur: number;
}

export interface FakturPajakForm {
  tanggal: string;
  tanggal2: string;
  nomorPajak: string;
  tanggalPajak: string;
  isManual: number;
  detail: FakturPajakFormDetail[];
}

export const fakturPajakFormApi = {
  // GET /api/penjualan/faktur-pajak/form/refresh?startDate=&endDate=&isManual=
  refresh: async (startDate: string, endDate: string, isManual: number) => {
    const { data } = await api.get("/penjualan/faktur-pajak/form/refresh", {
      params: { startDate, endDate, isManual },
    });
    return data.data;
  },

  // POST /api/penjualan/faktur-pajak/form/save
  save: async (payload: FakturPajakForm) => {
    const { data } = await api.post("/penjualan/faktur-pajak/form/save", payload);
    return data;
  },
};