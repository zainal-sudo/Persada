// api/laporan/transaksiHarianApi.ts
import api from "@/api/axios";

export interface TransaksiHarianRow {
  Tanggal: string;
  Nomor: string;
  Customer: string;
  Nama: string;
  Tax: number;
  Bruto: number;
  Disc: number;
  Dpp: number;
  Pajak: number;
  Total: number;
  Biaya_Promosi: number;
  Kontrak: number;
  Retur: number;
  Bayar_Cash: number;
  Bayar_Transfer: number;
  Giro: number;
  Bulan: number;
  Tahun: number;
}

export interface TransaksiHarianFilter {
  startDate: string;
  endDate: string;
  customer?: string;
}

export const transaksiHarianApi = {
  getBrowse: async (params: TransaksiHarianFilter): Promise<TransaksiHarianRow[]> => {
    const { data } = await api.get<{ success: boolean; data: TransaksiHarianRow[] }>(
      "/laporan/transaksi-harian",
      { params }
    );
    return data.data;
  },
};