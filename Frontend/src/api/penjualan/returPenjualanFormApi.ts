// api/penjualan/returPenjualanFormApi.ts
import api from "@/api/axios";

export interface ReturPenjualanDetail {
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
  cn: number;
  nilaiCN: number;
}

export interface ReturPenjualanForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  nomorFaktur: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  gdgKode: string;
  gdgNama: string;
  memo: string;
  isTax: number;
  discFakturPr: number;
  discFaktur: number;
  amount: number;
  taxAmount: number;
  cn: number;
  locked?: number;
  detail: ReturPenjualanDetail[];
}

export const returPenjualanFormApi = {
  // GET /api/penjualan/retur-penjualan/form/get-nomor?tanggal=&isTax=
  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/penjualan/retur-penjualan/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/search-fp?search=
  searchFP: async (search: string) => {
    const { data } = await api.get("/penjualan/retur-penjualan/form/search-fp", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/get-fp/:nomor?excludeNomor=
  getFP: async (nomor: string, excludeNomor: string = "") => {
    const { data } = await api.get(
      `/penjualan/retur-penjualan/form/get-fp/${encodeURIComponent(nomor)}`,
      { params: excludeNomor ? { excludeNomor } : {} }
    );
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/search-barang?nomorFaktur=&search=
  searchBarang: async (nomorFaktur: string, search: string) => {
    const { data } = await api.get("/penjualan/retur-penjualan/form/search-barang", {
      params: { nomorFaktur, search },
    });
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/gudang
  getGudang: async () => {
    const { data } = await api.get("/penjualan/retur-penjualan/form/gudang");
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/cn-faktur?cusKode=&tanggal=
  getCNFaktur: async (cusKode: string, tanggal: string) => {
    const { data } = await api.get("/penjualan/retur-penjualan/form/cn-faktur", {
      params: { cusKode, tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/sisa-piutang/:nomorFaktur
  getSisaPiutang: async (nomorFaktur: string) => {
    const { data } = await api.get(
      `/penjualan/retur-penjualan/form/sisa-piutang/${encodeURIComponent(nomorFaktur)}`
    );
    return data.data;
  },

  // GET /api/penjualan/retur-penjualan/form/:nomor
  getDetailForm: async (nomor: string): Promise<ReturPenjualanForm> => {
    const { data } = await api.get(
      `/penjualan/retur-penjualan/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/retur-penjualan/form/save
  save: async (payload: ReturPenjualanForm) => {
    const { data } = await api.post("/penjualan/retur-penjualan/form/save", payload);
    return data;
  },
};