import api from "@/api/axios";

export interface MutasiGudangDetail {
  no?: number;
  sku: string;
  namaBarang: string;
  satuan: string;
  qty: number;
  expired: string;
  keterangan: string;
  gudang: string;
  idBatch: string;
}

export interface MutasiGudangForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gudangAsal: string;
  gudangTujuan: string;
  keterangan: string;
  detail: MutasiGudangDetail[];
}

export const mutasiGudangFormApi = {
  getMaxNomor: async (tanggal: string): Promise<string> => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/get-max-nomor", {
      params: { tanggal },
    });
    return data.data.nomor;
  },

  getGudang: async () => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/gudang");
    return data.data as { kode: string; nama: string }[];
  },

  searchSKU: async (gudang: string, search: string) => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/search-sku", {
      params: { gudang, search },
    });
    return data.data as {
      sku: string;
      namaBarang: string;
      satuan: string;
      expired: string;
      idBatch: string;
      stok: number;
    }[];
  },

  getDetailSKU: async (gudang: string, sku: string, expired: string) => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/detail-sku", {
      params: { gudang, sku, expired },
    });
    return data.data as {
      sku: string;
      namaBarang: string;
      satuan: string;
      idBatch: string;
      stok: number;
    };
  },

  getStok: async (gudang: string, sku: string, expired: string): Promise<number> => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/get-stok", {
      params: { gudang, sku, expired },
    });
    return data.data.stok;
  },

  loadDataAll: async (gudang: string) => {
    const { data } = await api.get("/persediaan/mutasi-gudang/form/load-all", {
      params: { gudang },
    });
    return data.data as MutasiGudangDetail[];
  },

  getDetailForm: async (nomor: string): Promise<MutasiGudangForm> => {
    const { data } = await api.get(
      `/persediaan/mutasi-gudang/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: MutasiGudangForm) => {
    const { data } = await api.post("/persediaan/mutasi-gudang/form/save", payload);
    return data;
  },
};