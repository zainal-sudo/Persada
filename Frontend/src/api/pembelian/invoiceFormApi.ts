// api/pembelian/invoiceFormApi.ts
import api from "@/api/axios";

export interface InvoiceDetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  satuan: string;
  qty: number;
  harga: number;
  discPr: number;
  total: number;
  otorisasi: number;
  expired: string;
  idBatch: string;
}

export interface InvoiceForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  jthtempo: string;
  bpbNomor: string;
  nobukti: string;
  tglBukti: string;
  memo: string;
  supKode: string;
  supNama: string;
  discFaktur: number;
  discFakturPr: number;
  amount: number;
  taxAmount: number;
  isTax: number;
  freight: number;
  isBayar: number;
  bayar: number;
  isPajak: number;
  nopajak: string;
  top: number;
  detail: InvoiceDetail[];
}

export interface OpenBPBRow {
  nomor: string;
  tanggal: string;
  supplier: string;
  supKode: string;
  isTax: number;
  poDiscFaktur: number;
  poDiscFakturPr: number;
  top: number;
}

export const invoiceFormApi = {
  getSupplier: async (search: string) => {
    const { data } = await api.get("/pembelian/invoice/form/supplier", {
      params: { search },
    });
    return data.data;
  },

  getOpenBPB: async (search: string): Promise<OpenBPBRow[]> => {
    const { data } = await api.get("/pembelian/invoice/form/open-bpb", {
      params: { search },
    });
    return data.data;
  },

  getDetailByBPB: async (nomor: string) => {
    const { data } = await api.get(
      `/pembelian/invoice/form/detail-bpb/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  getTop: async (supKode: string): Promise<number> => {
    const { data } = await api.get("/pembelian/invoice/form/top", {
      params: { supKode },
    });
    return data.data.top;
  },

  getNomor: async (tanggal: string, isTax: number) => {
    const { data } = await api.get("/pembelian/invoice/form/get-nomor", {
      params: { tanggal, isTax },
    });
    return data.data;
  },

  checkNoBukti: async (nobukti: string, excludeNomor: string = "") => {
    const { data } = await api.get("/pembelian/invoice/form/check-no-bukti", {
      params: { nobukti, excludeNomor },
    });
    return data.data;
  },

  getToleransiHbl: async (): Promise<number> => {
    const { data } = await api.get("/pembelian/invoice/form/toleransi-hbl");
    return data.data.toleransi;
  },

  cekLastCost: async (brgKode: number, nilai: number) => {
    const { data } = await api.get("/pembelian/invoice/form/cek-lastcost", {
      params: { brgKode, nilai },
    });
    return data.data;
  },

  getDetailForm: async (nomor: string): Promise<InvoiceForm> => {
    const { data } = await api.get(
      `/pembelian/invoice/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: InvoiceForm) => {
    const { data } = await api.post("/pembelian/invoice/form/save", payload);
    return data;
  },
};
