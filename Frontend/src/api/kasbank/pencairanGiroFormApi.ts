import api from "@/api/axios";

export interface PencairanGiroForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  nogiro: string;
  tanggalCair: string;
  nilai: number;
  rekBank: string;
}

export const pencairanGiroFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/kasbank/pencairan-giro/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  searchGiro: async (search: string) => {
    const { data } = await api.get("/kasbank/pencairan-giro/form/search-giro", {
      params: { search },
    });
    return data.data as { nogiro: string; nilai: number; tanggal: string; kode: string; nama: string }[];
  },

  getRekening: async () => {
    const { data } = await api.get("/kasbank/pencairan-giro/form/rekening");
    return data.data as { kode: string; nama: string }[];
  },

  getDetailForm: async (nomor: string): Promise<PencairanGiroForm> => {
    const { data } = await api.get(
      `/kasbank/pencairan-giro/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PencairanGiroForm) => {
    const { data } = await api.post("/kasbank/pencairan-giro/form/save", payload);
    return data;
  },
};