import api from "@/api/axios";

export interface PermintaanBarangDetail {
  no?: number;
  sku: string;
  namaBarang: string;
  satuan: string;
  mingguLalu: number;
  realisasiIn: number;
  sisa: number;
  qty: number;
  stokNow: number;
  avgSale: number;
  keterangan: string;
}

export interface PermintaanBarangForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  memo: string;
  detail: PermintaanBarangDetail[];
}

export const permintaanBarangFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/persediaan/permintaan-barang/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  searchSKU: async (search: string, pbNomor: string) => {
    const { data } = await api.get("/persediaan/permintaan-barang/form/search-sku", {
      params: { search, pbNomor },
    });
    return data.data as { sku: string; namaBarang: string; satuan: string }[];
  },

  getDetailSKU: async (sku: string, pbNomor: string) => {
    const { data } = await api.get("/persediaan/permintaan-barang/form/detail-sku", {
      params: { sku, pbNomor },
    });
    return data.data as {
      sku: string;
      namaBarang: string;
      satuan: string;
      qtyPending: number;
      realisasiIn: number;
      sisa: number;
      stokNow: number;
      avgSale: number;
      keterangan: string;
    };
  },

  searchPB: async (tanggal: string) => {
    const { data } = await api.get("/persediaan/permintaan-barang/form/search-pb", {
      params: { tanggal },
    });
    return data.data as { nomor: string; tanggal: string }[];
  },

  loadPB: async (pbNomor: string) => {
    const { data } = await api.get("/persediaan/permintaan-barang/form/load-pb", {
      params: { pbNomor },
    });
    return data.data as PermintaanBarangDetail[];
  },

  getDetailForm: async (nomor: string): Promise<PermintaanBarangForm> => {
    const { data } = await api.get(
      `/persediaan/permintaan-barang/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PermintaanBarangForm) => {
    const { data } = await api.post("/persediaan/permintaan-barang/form/save", payload);
    return data;
  },
};