import api from "@/api/axios";

export interface MutasiGudangRow {
  Nomor: string;
  Tanggal: string;
  Asal: string;
  Tujuan: string;
  Keterangan: string;
  Realisasi: string;
}

export interface MutasiGudangDetailRow {
  Nomor: string;
  Kode: string;
  Nama: string;
  Jumlah: number;
  Expired: string;
  Keterangan: string;
}

export const mutasiGudangApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<MutasiGudangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: MutasiGudangRow[] }>(
      "/persediaan/mutasi-gudang",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<MutasiGudangDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: MutasiGudangDetailRow[] }>(
      `/persediaan/mutasi-gudang/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  toggleRealisasi: async (nomor: string): Promise<{ realisasi: boolean }> => {
    const { data } = await api.put(`/persediaan/mutasi-gudang/realisasi/${encodeURIComponent(nomor)}`);
    return data.data;
  },
};