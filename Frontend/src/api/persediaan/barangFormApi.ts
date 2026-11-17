import api from "@/api/axios";

export interface HargaJualJenis {
  no?: number;
  kode: number;
  nama: string;
  hargajual: number;
}

export interface BarangForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  satuan: string;
  ktgKode: string;
  grKode: number;
  gdgDefault: string;
  supKode: string;
  isAktif: boolean;
  isStok: boolean;
  isExpired: boolean;
  isProductFocus: boolean;
  hargaBeli: number;
  hargaJual: number;
  minStok: number;
  maxStok: number;
  merk: string;
  discSales: number;
  het: number;
  divisi: string;
  iskonsinyasi: boolean | number;
  detail: HargaJualJenis[];
}

export const barangFormApi = {
  getMaxKode: async (): Promise<number> => {
    const { data } = await api.get("/persediaan/barang/form/get-max-kode");
    return data.data.kode;
  },

  getTipeBarang: async () => {
    const { data } = await api.get("/persediaan/barang/form/tipe-barang");
    return data.data as { kode: number; nama: string }[];
  },

  getKategori: async () => {
    const { data } = await api.get("/persediaan/barang/form/kategori");
    return data.data as { kode: string; nama: string }[];
  },

  getGudang: async () => {
    const { data } = await api.get("/persediaan/barang/form/gudang");
    return data.data as { kode: string; nama: string }[];
  },

  getSupplier: async () => {
    const { data } = await api.get("/persediaan/barang/form/supplier");
    return data.data as { kode: string; nama: string }[];
  },

  getDivisi: async () => {
    const { data } = await api.get("/persediaan/barang/form/divisi");
    return data.data as { kode: string; nama: string }[];
  },

  getHargaJualJenis: async (brgKode: string) => {
    const { data } = await api.get("/persediaan/barang/form/harga-jual-jenis", {
      params: { brgKode },
    });
    return data.data as HargaJualJenis[];
  },

  getDetailForm: async (kode: string): Promise<BarangForm> => {
    const { data } = await api.get(
      `/persediaan/barang/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: BarangForm) => {
    const { data } = await api.post("/persediaan/barang/form/save", payload);
    return data;
  },
};