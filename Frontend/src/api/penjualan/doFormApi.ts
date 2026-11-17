// api/penjualan/doFormApi.ts
import api from "@/api/axios";

export interface DODetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  idBatch: string;
  qty: number;
  satuan: string;
  sudah: number;
  kurang: number;
  stok: number;
  expired: string;
  closed: number;
  gudang: string;
  gdgKons: string;
  isKonsinyasi?: number;
  isExpired?: number;
}

export interface DOForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  nomorSO: string;
  cusKode: string;
  cusNama: string;
  shipAddress: string;
  memo: string;
  gdgKode: string;
  gdgNama: string;
  driver: string;
  driverNama?: string;   // ← tampilan saja; do_driver tetap simpan kode
  isEcer: number;
  detail: DODetail[];
}

export const doFormApi = {
  // GET /api/penjualan/do/form/get-nomor?tanggal=&isTax=&divKode=
  getNomor: async (tanggal: string, isTax: number, divKode: string) => {
    const { data } = await api.get("/penjualan/do/form/get-nomor", {
      params: { tanggal, isTax, divKode },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/search-so?search=
  searchSO: async (search: string) => {
    const { data } = await api.get("/penjualan/do/form/search-so", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/load-so/:nomor
  loadSO: async (nomor: string) => {
    const { data } = await api.get(
      `/penjualan/do/form/load-so/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // GET /api/penjualan/do/form/gudang?search=
  getGudang: async (search: string) => {
    const { data } = await api.get("/penjualan/do/form/gudang", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/driver
  getDriver: async () => {
    const { data } = await api.get("/penjualan/do/form/driver");
    return data.data;
  },

  // GET /api/penjualan/do/form/search-stok?nomorSO=&gdgKode=&nomorDO=&search=
  searchStok: async (nomorSO: string, gdgKode: string, nomorDO: string, search = "") => {
    const { data } = await api.get("/penjualan/do/form/search-stok", {
      params: { nomorSO, gdgKode, nomorDO, search },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/search-stok-kons?nomorSO=&nomorDO=&search=
  // Stok barang konsinyasi di semua gudang konsinyasi (+ kolom gdgKons).
  searchStokKons: async (nomorSO: string, nomorDO: string, search = "") => {
    const { data } = await api.get("/penjualan/do/form/search-stok-kons", {
      params: { nomorSO, nomorDO, search },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/detail-stok?sku=&expired=&nomorSO=&gdgKode=&isEdit=&idBatch=
  getDetailStok: async (
    sku: number,
    expired: string,
    nomorSO: string,
    gdgKode: string,
    isEdit = false,
    idBatch = ""
  ) => {
    const { data } = await api.get("/penjualan/do/form/detail-stok", {
      params: { sku, expired, nomorSO, gdgKode, isEdit: isEdit ? 1 : 0, idBatch },
    });
    return data.data;
  },

  // GET /api/penjualan/do/form/stok?sku=&expired=&gdgKode=&nomorDO=&idBatch=
  getStok: async (sku: number, expired: string, gdgKode: string, nomorDO: string, idBatch = "") => {
    const { data } = await api.get<{ success: boolean; data: { stok: number } }>(
      "/penjualan/do/form/stok",
      { params: { sku, expired, gdgKode, nomorDO, idBatch } }
    );
    return data.data.stok;
  },

  // GET /api/penjualan/do/form/:nomor
  getDetailForm: async (nomor: string): Promise<DOForm> => {
    const { data } = await api.get(
      `/penjualan/do/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/penjualan/do/form/save
  save: async (payload: DOForm) => {
    const { data } = await api.post("/penjualan/do/form/save", payload);
    return data;
  },
};