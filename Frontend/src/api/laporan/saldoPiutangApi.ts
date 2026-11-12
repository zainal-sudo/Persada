// api/laporan/saldoPiutangApi.ts
import api from "@/api/axios";

export interface SaldoPiutangRow {
  Customer: string;
  Nama: string;
  Tax: number;
  Saldo_Awal: number;
  Total: number;
  Retur: number;
  Bayar_cash: number;
  Bayar_transfer: number;
  Giro: number;
  Potongan: number;
  Deposit: number;
  Koreksi_LR: number;
  Hutang_Internal: number;
  UM_Penjualan: number;
  PPN_Keluaran: number;
  PPh_22: number;
  Saldo_Akhir: number;
}

export interface SaldoPiutangFilter {
  startDate: string;
  endDate: string;
}

export const saldoPiutangApi = {
  getBrowse: async (params: SaldoPiutangFilter): Promise<SaldoPiutangRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SaldoPiutangRow[] }>(
      "/laporan/saldo-piutang",
      { params }
    );
    return data.data;
  },
};