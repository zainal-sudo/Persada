import apiClient from "./axios";

export interface DashboardPenjualan {
  omzet: number;
  omzetPpn: number;
  faktur: number;
  omzetPrev: number;
  fakturPrev: number;
  deltaPct: number | null;
  onDate: { omzet: number; faktur: number };
}

export interface DashboardSummary {
  cabang: string;
  asOfDate: string;
  penjualan: DashboardPenjualan;
  series6: { bulan: string; omzet: number; omzetPpn: number; faktur: number }[];
  piutang: {
    totalSisa: number;
    buckets: {
      belum: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      d91_120: number;
      gt120: number;
    };
    gt120: { count: number; total: number };
    topOverdue: { customer: string; sisa: number } | null;
  };
  inkaso: { total: number; count: number };
  retur: { total: number; count: number };
  topCustomer: { nama: string; qty: number; nilai: number; margin?: number }[];
  topItem: { nama: string; qty: number; nilai: number; margin?: number }[];
  kategori: { nama: string; nilai: number }[];
  area: { nama: string; nilai: number }[];
  salesman: { nama: string; nilai: number }[];
  stok: {
    nilaiPersediaan: number;
    kritisCount: number;
    negatifCount: number;
    kritisTop: { nama: string; stok: number; min: number }[];
  };
}

export interface CabangOption {
  kode: string;
  nama: string;
  dbase: string;
  reachable: boolean;
}

export const dashboardApi = {
  getSummary: async (db?: string, tanggal?: string): Promise<DashboardSummary> => {
    const { data } = await apiClient.get("/dashboard/summary", {
      params: { ...(db ? { db } : {}), ...(tanggal ? { tanggal } : {}) },
      timeout: 120_000, // lintas cabang bisa berat
    });
    return data.data;
  },
  getCabang: async (): Promise<CabangOption[]> => {
    const { data } = await apiClient.get("/dashboard/cabang");
    return data.data;
  },
};
