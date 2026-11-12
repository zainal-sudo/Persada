// api/pembelian/returBeliFormApi.ts
import api from "@/api/axios";

export interface ReturBeliDetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  idBatch: string;
  qty: number;
  satuan: string;
  harga: number;
  discPr: number;
  total: number;
  expired: string;
}

export interface ReturBeliForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  nomorInvoice: string;
  supKode: string;
  supNama: string;
  alamat: string;
  gdgKode: string;
  gdgNama: string;
  memo: string;
  isTax: number;
  discFakturPr: number;
  discFaktur: number;
  amount: number;
  taxAmount: number;
  locked?: number;
  detail: ReturBeliDetail[];
}

export const returBeliFormApi = {
  // GET /api/pembelian/retur-beli/form/get-nomor?tanggal=&isTax=
  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/pembelian/retur-beli/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  // GET /api/pembelian/retur-beli/form/search-invoice?search=
  searchInvoice: async (search: string) => {
    const { data } = await api.get("/pembelian/retur-beli/form/search-invoice", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/pembelian/retur-beli/form/get-invoice/:nomor?rfid=
  getInvoice: async (nomor: string, rfid: number = 0) => {
    const { data } = await api.get(
      `/pembelian/retur-beli/form/get-invoice/${encodeURIComponent(nomor)}`,
      { params: rfid ? { rfid } : {} }
    );
    return data.data;
  },

  // GET /api/pembelian/retur-beli/form/search-barang?nomorInvoice=&gdgKode=&search=
  searchBarang: async (nomorInvoice: string, gdgKode: string, search: string) => {
    const { data } = await api.get("/pembelian/retur-beli/form/search-barang", {
      params: { nomorInvoice, gdgKode, search },
    });
    return data.data;
  },

  // GET /api/pembelian/retur-beli/form/gudang
  getGudang: async () => {
    const { data } = await api.get("/pembelian/retur-beli/form/gudang");
    return data.data;
  },

  // GET /api/pembelian/retur-beli/form/:nomor
  getDetailForm: async (nomor: string): Promise<ReturBeliForm> => {
    const { data } = await api.get(
      `/pembelian/retur-beli/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/pembelian/retur-beli/form/save
  save: async (payload: ReturBeliForm) => {
    const { data } = await api.post("/pembelian/retur-beli/form/save", payload);
    return data;
  },
};
