// api/persediaan/titipFormApi.ts
import api from "@/api/axios";

export interface TitipDetail {
  no?: number;
  brgKode: number;
  brgNama: string;
  qty: number;
  satuan: string;
  expired: string;
  idBatch: string;
  isExpired?: number;
  isKonsinyasi?: number;
}

export interface TitipForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  gdgKode: string;
  gdgNama: string;
  memo: string;
  detail: TitipDetail[];
}

export const titipFormApi = {
  // GET /api/persediaan/titip/form/get-nomor?tanggal=
  getNomor: async (tanggal: string) => {
    const { data } = await api.get("/persediaan/titip/form/get-nomor", {
      params: { tanggal },
    });
    return data.data;
  },

  // GET /api/persediaan/titip/form/gudang?search= (hanya gudang konsinyasi)
  getGudang: async (search: string) => {
    const { data } = await api.get("/persediaan/titip/form/gudang", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/persediaan/titip/form/barang?search= (hanya barang konsinyasi)
  searchBarang: async (search: string) => {
    const { data } = await api.get("/persediaan/titip/form/barang", {
      params: { search },
    });
    return data.data;
  },

  // GET /api/persediaan/titip/form/:nomor
  getDetailForm: async (nomor: string): Promise<TitipForm> => {
    const { data } = await api.get(
      `/persediaan/titip/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  // POST /api/persediaan/titip/form/save
  save: async (payload: TitipForm) => {
    const { data } = await api.post("/persediaan/titip/form/save", payload);
    return data;
  },
};
