import api from "@/api/axios";

export interface TagihanEkspedisiDetail {
  no?: number;
  nomor: string;
  nama: string;
  tanggal: string;
  nilai: number;
  biaya: number;
  uoc: number;
  ste?: string;
}

export interface TagihanEkspedisiForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  tg1: string;
  tg2: string;
  namaEkspedisi: string;
  keterangan: string;
  detail: TagihanEkspedisiDetail[];
}

export const tagihanEkspedisiFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string): Promise<string> => {
    const { data } = await api.get("/persediaan/tagihan-ekspedisi/form/get-max-nomor", {
      params: { tanggal, cabang },
    });
    return data.data.nomor;
  },

  loadFP: async (startDate: string, endDate: string, mode: "fp" | "ste" = "fp") => {
    const { data } = await api.get("/persediaan/tagihan-ekspedisi/form/load-fp", {
      params: { startDate, endDate, mode },
    });
    return data.data as {
      nomor: string;
      nama: string;
      tanggal: string;
      nilai: number;
      ste: string;
    }[];
  },

  getDetailForm: async (nomor: string): Promise<TagihanEkspedisiForm> => {
    const { data } = await api.get(
      `/persediaan/tagihan-ekspedisi/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: TagihanEkspedisiForm) => {
    const { data } = await api.post("/persediaan/tagihan-ekspedisi/form/save", payload);
    return data;
  },
};