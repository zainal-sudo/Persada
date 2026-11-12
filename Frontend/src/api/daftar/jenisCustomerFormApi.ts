import api from "@/api/axios";

export interface JenisCustomerForm {
  isEdit: boolean;
  kode: string;
  nama: string;
}

export const jenisCustomerFormApi = {
  getMaxKode: async (): Promise<string> => {
    const { data } = await api.get("/daftar/jenis-customer/form/get-max-kode");
    return data.data.kode;
  },

  getDetailForm: async (kode: string): Promise<JenisCustomerForm> => {
    const { data } = await api.get(
      `/daftar/jenis-customer/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: JenisCustomerForm) => {
    const { data } = await api.post("/daftar/jenis-customer/form/save", payload);
    return data;
  },
};