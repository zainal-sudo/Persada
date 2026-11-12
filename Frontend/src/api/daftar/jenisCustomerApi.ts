import api from "@/api/axios";

export interface JenisCustomerRow {
  Kode: number;
  Nama: string;
}

export const jenisCustomerApi = {
  getBrowse: async (): Promise<JenisCustomerRow[]> => {
    const { data } = await api.get<{ success: boolean; data: JenisCustomerRow[] }>(
      "/daftar/jenis-customer"
    );
    return data.data;
  },
};