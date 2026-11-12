import api from "@/api/axios";

export interface KoreksiStokDetail {
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
}

export interface KoreksiStokForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gudang: string;
  keterangan: string;
  detail: KoreksiStokDetail[];
}

export const koreksiStokFormApi = {
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
    return data.data as KoreksiStokDetail[];
  },

  fromHitungStok: async (gudang: string, tanggal: string) => {
    const { data } = await api.get("/persediaan/koreksi-stok/form/from-hitung-stok", {
      params: { gudang, tanggal },
    });
    return data.data as KoreksiStokDetail[];
  },

  getDetailForm: async (nomor: string): Promise<KoreksiStokForm> => {
    const { data } = await api.get(
      `/persediaan/koreksi-stok/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: KoreksiStokForm) => {
    const { data } = await api.post("/persediaan/koreksi-stok/form/save", payload);
    return data;
  },
};