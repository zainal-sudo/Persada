import api from "@/api/axios";

export interface SalesmanRow {
  Kode: string;
  Nama: string;
  Alamat: string;
  Kota: string;
  Telp: string;
  TglMasuk: string;
  Formasi: string;
}

export const salesmanApi = {
  getBrowse: async (cabang: string): Promise<SalesmanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SalesmanRow[] }>(
      "/daftar/salesman",
      { params: { cabang } }
    );
    return data.data;
  },
};