import api from "@/api/axios";

export interface SupplierForm {
  isEdit: boolean;
  kode: string;
  nama: string;
  alamat: string;
  kota: string;
  telp: string;
  fax: string;
  cp: string;
  email: string;
  top: number;
  bank: string;
  rekening: string;
  atasnama: string;
  cabang: string;
}

export const supplierFormApi = {
  getDetailForm: async (kode: string): Promise<SupplierForm> => {
    const { data } = await api.get(
      `/daftar/supplier/form/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (payload: SupplierForm) => {
    const { data } = await api.post("/daftar/supplier/form/save", payload);
    return data;
  },
};
