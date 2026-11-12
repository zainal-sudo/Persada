import api from "@/api/axios";

export interface PemusnahanDetail {
  no?: number;
  sku: string;
  namaBarang: string;
  idBatch: string;
  satuan: string;
  expired: string;
  qty: number;
  harga: number;
  nilai: number;
}

export interface PemusnahanForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gudang: string;
  keterangan: string;
  detail: PemusnahanDetail[];
}

export const pemusnahanFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/persediaan/pemusnahan/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  getGudang: async () => {
    const { data } = await api.get("/persediaan/pemusnahan/form/gudang");
    return data.data as { kode: string; nama: string }[];
  },

  searchSKU: async (gudang: string, search: string) => {
    const { data } = await api.get("/persediaan/pemusnahan/form/search-sku", {
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
    const { data } = await api.get("/persediaan/pemusnahan/form/detail-sku", {
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

  getDetailForm: async (nomor: string): Promise<PemusnahanForm> => {
    const { data } = await api.get(
      `/persediaan/pemusnahan/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PemusnahanForm) => {
    const { data } = await api.post("/persediaan/pemusnahan/form/save", payload);
    return data;
  },
};