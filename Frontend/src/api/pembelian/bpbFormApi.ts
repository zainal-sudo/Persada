// api/pembelian/bpbFormApi.ts
import api from "@/api/axios";

export interface BPBDetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  satuan: string;
  qty: number;
  harga: number;
  discPr: number;
  total: number;
  sudah: number;
  kurang: number;
  closed: string;
  expired: string;
  idBatch: string;
}

export interface BPBForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  poNomor: string;
  memo: string;
  gdgKode: string;
  detail: BPBDetail[];
}

export interface OpenPORow {
  nomor: string;
  tanggal: string;
  supplier: string;
  supKode: string;
  isTax: number;
  total: number;
}

export const bpbFormApi = {
  getSupplier: async (search: string) => {
    const { data } = await api.get("/pembelian/bpb/form/supplier", {
      params: { search },
    });
    return data.data;
  },

  getGudang: async () => {
    const { data } = await api.get("/pembelian/bpb/form/gudang");
    return data.data;
  },

  getOpenPO: async (search: string): Promise<OpenPORow[]> => {
    const { data } = await api.get("/pembelian/bpb/form/open-po", {
      params: { search },
    });
    return data.data;
  },

  getDetailByPO: async (nomor: string): Promise<BPBDetail[]> => {
    const { data } = await api.get(
      `/pembelian/bpb/form/detail-po/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/pembelian/bpb/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  getDetailForm: async (nomor: string): Promise<BPBForm> => {
    const { data } = await api.get(
      `/pembelian/bpb/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: BPBForm) => {
    const { data } = await api.post("/pembelian/bpb/form/save", payload);
    return data;
  },
};
