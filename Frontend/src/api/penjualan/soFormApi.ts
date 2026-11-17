// api/penjualan/soFormApi.ts
import api from "@/api/axios";

export interface SODetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  satuan: string;
  qty: number;
  harga: number;
  discPr: number;
  total: number;
  keterangan: string;
}

export interface SOForm {
  isEdit: boolean;
  nomor: string;
  nomorSosales: string;   // ← nomor SO sumber dari DB tertentu (Ambil SO)
  tanggal: string;
  memo: string;
  cusKode: string;
  cusNama: string;
  alamat: string;
  shipAddress: string;
  slsKode: string;
  slsNama: string;      // ← BARU: nama rayon
  slaKode: string;
  slaNama: string;
  discFaktur: number;
  discFakturPr: number;
  amount: number;
  taxAmount: number;
  dp: number;
  rekDp: string;
  rekNama: string;
  isTax: number;
  isEcer: number;
  isProforma: number;
  divKode: string;
  detail: SODetail[];
}

export const soFormApi = {
  // GET /api/penjualan/so/form/customer?search=
  getCustomer: async (search: string) => {
    const { data } = await api.get("/penjualan/so/form/customer", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/salesman-aktif
  getSalesmanAktif: async () => {
    const { data } = await api.get("/penjualan/so/form/salesman-aktif");
    return data.data;
  },

  // GET /api/penjualan/so/form/salesman
  getSalesman: async () => {
    const { data } = await api.get("/penjualan/so/form/salesman");
    return data.data;
  },

  // GET /api/penjualan/so/form/rekening?search=
  getRekening: async (search: string) => {
    const { data } = await api.get("/penjualan/so/form/rekening", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/barang?search=&jenisCustomer=&divKode=
  getBarang: async (search: string, jenisCustomer: string, divKode: string) => {
    const { data } = await api.get("/penjualan/so/form/barang", {
      params: { search, jenisCustomer, divKode },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/get-nomor?tanggal=&isTax=&divKode=
  getNomor: async (tanggal: string, isTax: number, divKode: string) => {
    const { data } = await api.get("/penjualan/so/form/get-nomor", {
      params: { tanggal, isTax, divKode },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/check-locked?cusKode=
  checkCustomerLocked: async (cusKode: string) => {
    const { data } = await api.get("/penjualan/so/form/check-locked", {
      params: { cusKode },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/disc-sales?brgKode=
  getDiscSales: async (brgKode: number) => {
    const { data } = await api.get("/penjualan/so/form/disc-sales", {
      params: { brgKode },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/lastcost?brgKode=
  getLastCost: async (brgKode: number) => {
    const { data } = await api.get("/penjualan/so/form/lastcost", {
      params: { brgKode },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/ambil-so?cabang=
  getAmbilSO: async (cabang: string) => {
    const { data } = await api.get("/penjualan/so/form/ambil-so", {
      params: { cabang },
    });
    return data.data;
  },

  // GET /api/penjualan/so/form/detail-so/:nomor
  getDetailAmbilSO: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/so/form/detail-so/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/so/form/:nomor
  getDetailForm: async (nomor: string): Promise<SOForm> => {
    const { data } = await api.get(
      `/penjualan/so/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/so/form/save
  save: async (payload: SOForm) => {
    const { data } = await api.post("/penjualan/so/form/save", payload);
    return data;
  },

  // GET /api/penjualan/so/form/riwayat-harga?brgKode=&cusKode=&excludeNomor=
  getRiwayatHarga: async (brgKode: number, cusKode: string, excludeNomor: string = "") => {
    const { data } = await api.get("/penjualan/so/form/riwayat-harga", {
      params: { brgKode, cusKode, excludeNomor },
    });
    return data.data;
  },
};