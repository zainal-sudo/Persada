import api from "@/api/axios";

export interface PemusnahanRow {
  Nomor: string;
  Tanggal: string;
  Gudang: string;
  Keterangan: string;
  Total: number;
}

export interface PemusnahanDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Expired: string;
  Satuan: string;
  QtyMusnah: number;
  Harga: number;
}

export const pemusnahanApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<PemusnahanRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PemusnahanRow[] }>(
      "/persediaan/pemusnahan",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<PemusnahanDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: PemusnahanDetailRow[] }>(
      `/persediaan/pemusnahan/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};