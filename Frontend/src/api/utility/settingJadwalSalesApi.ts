// api/utility/settingJadwalSalesApi.ts
// Setting Jadwal Sales (Delphi: ufrmBrowseSetingJadwalSales + ufrmSetingJadwalSales)
import api from "@/api/axios";

export interface JadwalSalesRow {
  jd_sls_kode: string;
  salesman: string;
  jd_cus_kode: string;
  customer: string;
  Nama: string;
}

export interface JadwalSalesLoadRow {
  slsKode: string;
  kode: string;
  nama: string;
}

export interface JadwalSalesSavePayload {
  salesman: string;
  namaJadwal: string;
  isEdit: boolean;
  rows: { kode: string }[];
}

export interface JadwalSalesSaveResult {
  salesman: string;
  namaJadwal: string;
  jmlBaris: number;
  jmlInsert: number;
  jmlUpdate: number;
  jmlDelete: number;
  user: string;
}

export interface JadwalSalesHapusResult {
  salesman: string;
  jmlHapus: number;
  user: string;
}

export const settingJadwalSalesApi = {
  getBrowse: async (): Promise<JadwalSalesRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: JadwalSalesRow[];
    }>("/utility/setting-jadwal-sales");
    return data.data;
  },

  load: async (salesman: string): Promise<JadwalSalesLoadRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: JadwalSalesLoadRow[];
    }>("/utility/setting-jadwal-sales/load", {
      params: { salesman },
    });
    return data.data;
  },

  getSalesman: async (): Promise<{ kode: string; nama: string }[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: { kode: string; nama: string }[];
    }>("/utility/setting-jadwal-sales/salesman");
    return data.data;
  },

  getCustomers: async (): Promise<{ kode: string; nama: string }[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: { kode: string; nama: string }[];
    }>("/utility/setting-jadwal-sales/customers");
    return data.data;
  },

  save: async (payload: JadwalSalesSavePayload): Promise<JadwalSalesSaveResult> => {
    const { data } = await api.post<{
      success: boolean;
      data: JadwalSalesSaveResult;
    }>("/utility/setting-jadwal-sales/save", payload);
    return data.data;
  },

  hapus: async (salesman: string): Promise<JadwalSalesHapusResult> => {
    const { data } = await api.post<{
      success: boolean;
      data: JadwalSalesHapusResult;
    }>("/utility/setting-jadwal-sales/hapus", { salesman });
    return data.data;
  },
};
