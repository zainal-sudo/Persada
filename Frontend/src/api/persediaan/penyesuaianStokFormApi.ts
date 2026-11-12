import api from "@/api/axios";

// Keep backend endpoints as-is (they use koreksi-stok), only rename frontend types/exports
export type PenyesuaianStokDetail = {
  no?: number;
  sku: string;
  namaBarang: string;
  idBatch: string;
  satuan: string;
  expired: string;
  fisik: number;
  system: number;
  qty: number;
  harga: number;
  nilai: number;
  price: number;
  nilaiPrice: number;
};

export type PenyesuaianStokForm = {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gudang: string;
  keterangan: string;
  detail: PenyesuaianStokDetail[];
};

// Aliases for backward compat
export type KoreksiStokDetail = PenyesuaianStokDetail;
export type KoreksiStokForm = PenyesuaianStokForm;

export const penyesuaianStokFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  getGudang: async () => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/gudang");
    return data.data as { kode: string; nama: string }[];
  },

  searchSKU: async (gudang: string, search: string) => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/search-sku", {
      params: { gudang, search },
    });
    return data.data as {
      sku: string;
      namaBarang: string;
      satuan: string;
      expired: string;
      stok: number;
      hargabeli: number;
      idbatch: string;
    }[];
  },

  getDetailSKU: async (gudang: string, sku: string, expired: string) => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/detail-sku", {
      params: { gudang, sku, expired },
    });
    return data.data as {
      sku: string;
      namaBarang: string;
      satuan: string;
      stok: number;
      hargabeli: number;
      idbatch: string;
    };
  },

  loadDataAll: async (gudang: string, tanggal: string) => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/load-all", {
      params: { gudang, tanggal },
    });
    return data.data as PenyesuaianStokDetail[];
  },

  fromHitungStok: async (gudang: string, tanggal: string) => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/from-hitung-stok", {
      params: { gudang, tanggal },
    });
    return data.data as PenyesuaianStokDetail[];
  },

  getDetailForm: async (nomor: string): Promise<PenyesuaianStokForm> => {
    const { data } = await api.get(
      `/persediaan/koreksi-stok/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PenyesuaianStokForm) => {
    const { data } = await api.post("/persediaan/koreksi-stok/form/save", payload);
    return data;
  },
};

// Backward compat alias
export const koreksiStokFormApi = penyesuaianStokFormApi;
