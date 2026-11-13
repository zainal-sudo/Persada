import api from "@/api/axios";

export interface SupplierRow {
  Kode: string;
  Nama: string;
  Alamat: string;
  Kota: string;
  Telp: string;
}

export const supplierApi = {
  getBrowse: async (): Promise<SupplierRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SupplierRow[] }>(
      "/daftar/supplier"
    );
    return data.data;
  },
};
