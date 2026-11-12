// api/pembelian/poFormApi.ts
import api from "@/api/axios";

export interface PODetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  satuan: string;
  qty: number;
  harga: number;
  discPr: number;
  total: number;
}

export interface POForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  dateline: string;
  memo: string;
  pemesan: string;
  supKode: string;
  supNama: string;
  discFaktur: number;
  discFakturPr: number;
  amount: number;
  taxAmount: number;
  isTax: number;
  detail: PODetail[];
}

export const poFormApi = {
  getSupplier: async (search: string) => {
    const { data } = await api.get("/pembelian/po/form/supplier", {
      params: { search },
    });
    return data.data;
  },

  getBarang: async (search: string) => {
    const { data } = await api.get("/pembelian/po/form/barang", {
      params: { search },
    });
    return data.data;
  },

  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/pembelian/po/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  getRiwayatHarga: async (
    brgKode: number,
    supKode: string,
    excludeNomor: string = ""
  ) => {
    const { data } = await api.get("/pembelian/po/form/riwayat-harga", {
      params: { brgKode, supKode, excludeNomor },
    });
    return data.data;
  },

  getDetailForm: async (nomor: string): Promise<POForm> => {
    const { data } = await api.get(
      `/pembelian/po/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: POForm) => {
    const { data } = await api.post("/pembelian/po/form/save", payload);
    return data;
  },
};
