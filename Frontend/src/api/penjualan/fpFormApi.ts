// api/penjualan/fpFormApi.ts
import api from "@/api/axios";

export interface FPDetail {
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
  kurang: number;
  cn: number;
  nilaiCN: number;
  gudang: string;
  hrgMin: number;
  net: number;
  otorisasi: number;
  otorisasiKode?: string | null;
  promosiRp: number;
  promosiPr: number;
  feeRp: number;
  feePr: number;
}

export interface FPForm {
  isEdit: boolean;
  nomor: string;
  nomorSO: string;
  tanggal: string;
  jthTempo: string;
  memo: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  telp: string;
  salesman: string;
  top?: number;
  isTax: number;
  isEcer: number;
  isCatalog: number;
  tipecash: number;
  isDTP: number;
  discFakturPr: number;
  discFaktur: number;
  biayaPr: number;
  biayaRp: number;
  freight: number;
  amount: number;
  taxAmount: number;
  dp: number;
  cn: number;
  totalSetelahRetur: number;
  detail: FPDetail[];
}

export const fpFormApi = {
  // GET /api/penjualan/fp/form/get-nomor?tanggal=&isTax=
  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/penjualan/fp/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/search-so?search=
  searchSO: async (search: string) => {
    const { data } = await api.get("/penjualan/fp/form/search-so", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/load-so/:nomor
  loadSO: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/fp/form/load-so/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/fp/form/get-cn?brgKode=&cusKode=&tanggal=
  getDiscCN: async (brgKode: number, cusKode: string, tanggal: string) => {
    const { data } = await api.get("/penjualan/fp/form/get-cn", {
      params: { brgKode, cusKode, tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/get-top?cusKode=
  getTop: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/fp/form/get-top", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/get-retur?nomor=
  getNilaiRetur: async (nomor: string) => {
    const { data } = await api.get("/penjualan/fp/form/get-retur", {
      params: { nomor },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/get-dp?nomorSO=&excludeNomor=
  getDP: async (nomorSO: string, excludeNomor: string = "") => {
    const { data } = await api.get("/penjualan/fp/form/get-dp", {
      params: { nomorSO, excludeNomor },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/get-cn-faktur?cusKode=&tanggal= — cn_potong_invoice
  getCNFaktur: async (cusKode: string, tanggal: string) => {
    const { data } = await api.get("/penjualan/fp/form/get-cn-faktur", {
      params: { cusKode, tanggal },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/margin-data?brgKode=&expired=&nomorSO=&cusKode=
  getMarginData: async (
    brgKode: number,
    expired: string,
    nomorSO: string,
    cusKode: string
  ): Promise<{
    lastcost: number;
    hET: number;
    minMargin: number | null;
    isSample: boolean;
    mtciLastcost: number;
  }> => {
    const { data } = await api.get("/penjualan/fp/form/margin-data", {
      params: { brgKode, expired, nomorSO, cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/disc-sales?brgKode=
  getDiscSales: async (brgKode: number) => {
    const { data } = await api.get("/penjualan/fp/form/disc-sales", {
      params: { brgKode },
    });
    return data.data;
  },

  // GET /api/penjualan/fp/form/:nomor
  getDetailForm: async (nomor: string): Promise<FPForm> => {
    const { data } = await api.get(
      `/penjualan/fp/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/fp/form/riwayat-harga?brgKode=&cusKode=&excludeNomor=
  getRiwayatHarga: async (brgKode: number, cusKode: string, excludeNomor: string = "") => {
    const { data } = await api.get("/penjualan/fp/form/riwayat-harga", {
      params: { brgKode, cusKode, excludeNomor },
    });
    return data.data;
  },

  // POST /api/penjualan/fp/form/save
  save: async (payload: FPForm) => {
    const { data } = await api.post("/penjualan/fp/form/save", payload);
    return data;
  },
};