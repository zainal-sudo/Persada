import api from "@/api/axios";

export interface HitungStokDetail {
  no?: number;
  sku: string;
  qty: number;
  satuan: string;
  expired: string;
  namaBarang?: string;
}

export interface HitungStokForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gudang: string;
  lokasi: string;
  detail: HitungStokDetail[];
}

export const hitungStokFormApi = {
  getMaxNomor: async (tanggal: string): Promise<string> => {
    const { data } = await api.get("/persediaan/hitung-stok/form/get-max-nomor", {
      params: { tanggal },
    });
    return data.data.nomor;
  },

  getGudang: async () => {
    const { data } = await api.get("/persediaan/hitung-stok/form/gudang");
    return data.data as { kode: string; nama: string }[];
  },

  getBarang: async (search: string) => {
    const { data } = await api.get("/persediaan/hitung-stok/form/barang", {
      params: { search },
    });
    return data.data as { sku: string; namaBarang: string; satuan: string }[];
  },

  getDetailForm: async (nomor: string): Promise<HitungStokForm> => {
    const { data } = await api.get(
      `/persediaan/hitung-stok/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: HitungStokForm) => {
    const { data } = await api.post("/persediaan/hitung-stok/form/save", payload);
    return data;
  },
};