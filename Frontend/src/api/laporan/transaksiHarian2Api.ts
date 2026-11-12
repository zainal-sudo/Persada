// api/laporan/transaksiHarian2Api.ts
import api from "@/api/axios";

export interface TransaksiHarian2Row {
  Tanggal: string;
  Salesman: string;
  Customer: string;
  Nama: string;
  Tax: number;
  Bruto: number;
  Disc: number;
  Dpp: number;
  Pajak: number;
  Total: number;
  Freight: number;
  Biaya_Promosi: number;
  Kontrak: number;
  Retur: number;
  Bayar_Cash: number;
  Bayar_Transfer: number;
  Giro: number;
  Deposit: number;
  Hutang_Internal: number;
  Koreksi_LR: number;
  UM_Penjualan: number;
  PPn_Keluaran: number;
  PPh_22: number;
  Potongan: number;
  Bulan: number;
}

export interface TransaksiHarian2Filter {
  startDate: string;
  endDate: string;
  customer?: string;
}

export const transaksiHarian2Api = {
  getBrowse: async (params: TransaksiHarian2Filter): Promise<TransaksiHarian2Row[]> => {
    const { data } = await api.get<{ success: boolean; data: TransaksiHarian2Row[] }>(
      "/laporan/transaksi-harian2",
      { params }
    );
    return data.data;
  },
};