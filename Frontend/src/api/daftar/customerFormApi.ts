import api from "@/api/axios";

export interface CustomerForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  alamat: string;
  kota: string;
  telp: string;
  fax: string;
  email: string;
  top: number;
  jcKode: string;
  jcNama: string;
  cp: string;
  shipAddress: string;
  gcKode: string;
  gcNama: string;
  npwp: string;
  namaNpwp: string;
  alamatNpwp: string;
  kotaNpwp: string;
  marketing: string;
  namaMarketing: string;
  cabang: string;
}

export const customerFormApi = {
  getJenisCustomer: async () => {
    const { data } = await api.get("/daftar/customer/form/jenis-customer");
    return data.data as { kode: string; nama: string }[];
  },

  getGolonganCustomer: async () => {
    const { data } = await api.get("/daftar/customer/form/golongan-customer");
    return data.data as { kode: string; nama: string }[];
  },

  getMarketing: async (search: string) => {
    const { data } = await api.get("/daftar/customer/form/marketing", {
      params: { search },
    });
    return data.data as { kode: string; nama: string; alamat: string }[];
  },

  getDetailForm: async (kode: string): Promise<CustomerForm> => {
    const { data } = await api.get(
      `/daftar/customer/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: CustomerForm) => {
    const { data } = await api.post("/daftar/customer/form/save", payload);
    return data;
  },
};