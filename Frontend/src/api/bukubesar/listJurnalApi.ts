import api from "@/api/axios";

export interface ListJurnalRow {
  Bulan: number;
  Tahun: number;
  Tanggal: string;
  Nomor: string;
  Referensi: string;
  Account: string;
  AccountName: string;
  Keterangan: string;
  Debet: number;
  Kredit: number;
  Kelompok: string;
  CostCenter: string;
  Customer: string;
  nopol: string;
  ekspedisi: string;
}

export const listJurnalApi = {
  getListJurnal: async (startDate: string, endDate: string): Promise<ListJurnalRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJurnalRow[] }>(
      "/bukubesar/list-jurnal",
      { params: { startDate, endDate } }
    );
    return data.data;
  },
};