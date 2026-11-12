import api from "@/api/axios";

export interface JurnalUmumDetail {
  no?: number;
  account: string;
  accountName: string;
  debet: number;
  kredit: number;
  memo: string;
  costCenter: string;
}

export interface JurnalUmumForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  keterangan: string;
  locked?: number;
  detail: JurnalUmumDetail[];
}

export const jurnalUmumFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/bukubesar/jurnal-umum/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  searchAccount: async (search: string) => {
    const { data } = await api.get("/bukubesar/jurnal-umum/form/search-account", {
      params: { search },
    });
    return data.data as { kode: string; nama: string }[];
  },

  searchCostCenter: async () => {
    const { data } = await api.get("/bukubesar/jurnal-umum/form/cost-center");
    return data.data as { kode: string; nama: string }[];
  },

  cekPeriode: async (tanggal: string): Promise<boolean> => {
    const { data } = await api.get("/bukubesar/jurnal-umum/form/cek-periode", {
      params: { tanggal },
    });
    return data.data.closed;
  },

  getDetailForm: async (nomor: string): Promise<JurnalUmumForm> => {
    const { data } = await api.get(
      `/bukubesar/jurnal-umum/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: JurnalUmumForm) => {
    const { data } = await api.post("/bukubesar/jurnal-umum/form/save", payload);
    return data;
  },
};