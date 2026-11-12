// api/penjualan/fakturManualFormApi.ts
import api from "@/api/axios";

export interface FakturManualDetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  qty: number;
  satuan: string;
  idBatch: string;
  harga: number;
  discPr: number;
  total: number;
  expired: string;
  kurang: number;
  cn: number;
  nilaiCN: number;
  gudang: string;
}

export interface FakturManualForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  nomorSO: string;
  jthTempo: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  telp: string;
  memo: string;
  isTax: number;
  discFakturPr: number;
  discFaktur: number;
  freight: number;
  amount: number;
  taxAmount: number;
  dp: number;
  cn: number;
  top?: number;
  locked?: number;
  detail: FakturManualDetail[];
}

export const fakturManualFormApi = {
  // GET /api/penjualan/faktur-manual/form/search-so?search=
  searchSO: async (search: string) => {
    const { data } = await api.get("/penjualan/faktur-manual/form/search-so", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/load-so/:nomor
  loadSO: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/faktur-manual/form/load-so/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/search-barang?search=
  searchBarang: async (search: string) => {
    const { data } = await api.get("/penjualan/faktur-manual/form/search-barang", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/get-top?cusKode=
  getTop: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/faktur-manual/form/get-top", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/dp?nomorSO=&nomorFP=
  getDP: async (nomorSO: string, nomorFP: string = "") => {
    const { data } = await api.get("/penjualan/faktur-manual/form/dp", {
      params: { nomorSO, nomorFP },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/cn?cusKode=&tanggal=
  getCN: async (cusKode: string, tanggal: string) => {
    const { data } = await api.get("/penjualan/faktur-manual/form/cn", {
      params: { cusKode, tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/harga?brgKode=&cusKode=&nomorFP=
  getHargaHistori: async (brgKode: number, cusKode: string, nomorFP: string = "") => {
    const { data } = await api.get("/penjualan/faktur-manual/form/harga", {
      params: { brgKode, cusKode, nomorFP },
    });
    return data.data;
  },

  // GET /api/penjualan/faktur-manual/form/:nomor
  getDetailForm: async (nomor: string): Promise<FakturManualForm> => {
    const { data } = await api.get(
      `/penjualan/faktur-manual/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/faktur-manual/form/save
  save: async (payload: FakturManualForm) => {
    const { data } = await api.post("/penjualan/faktur-manual/form/save", payload);
    return data;
  },
};