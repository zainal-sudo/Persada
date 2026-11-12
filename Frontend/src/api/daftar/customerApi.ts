import api from "@/api/axios";

export interface CustomerRow {
  Kode: string;
  Nama: string;
  Alamat: string;
  Golongan: string;
  Kota: string;
  Telp: string;
  Fax: string;
  Contact: string;
  Piutang: number;
  Jenis_Customer: string;
  NPWP: string;
  NAMANPWP: string;
  ALAMATNPWP: string;
  last_paid: string | null;
  Top: number;
  Locked: string;
  Marketing: string;
}

export const customerApi = {
  getBrowse: async (cabang: string): Promise<CustomerRow[]> => {
    const { data } = await api.get<{ success: boolean; data: CustomerRow[] }>(
      "/daftar/customer",
      { params: { cabang } }
    );
    return data.data;
  },

  updateLocked: async (kode: string, locked: number): Promise<void> => {
    await api.put(`/daftar/customer/lock/${encodeURIComponent(kode)}`, { locked });
  },
};