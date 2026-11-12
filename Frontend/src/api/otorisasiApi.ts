// api/otorisasiApi.ts
import api from "@/api/axios";

export interface OtorisasiDetailLine {
  brgKode: number;
  expired: string;
  qty: number;
  satuan: string;
  harga: number;
  discPr: number;
  promosiRp: number;
  promosiPr: number;
  feeRp: number;
  feePr: number;
  cn: number;
}

export interface OtorisasiKonteks {
  jenis: string;
  variant: 1 | 2;
  form: {
    nomorSO?: string;
    cusKode?: string;
    steNomor?: string;
    fpNomor?: string;
    tipe?: string;
    cusNama?: string;
  };
  detail: OtorisasiDetailLine[];
}

export const otorisasiApi = {
  // POST /api/otorisasi/request — buat kode (server time) + catat konteks
  request: async (payload: OtorisasiKonteks): Promise<{ kode: string }> => {
    const { data } = await api.post("/otorisasi/request", payload);
    return data.data;
  },

  // POST /api/otorisasi/:kode/verify — kasir ketik password di dialog
  verify: async (kode: string, password: string): Promise<{ approved: boolean }> => {
    const { data } = await api.post(`/otorisasi/${encodeURIComponent(kode)}/verify`, {
      password,
    });
    return data.data;
  },
};