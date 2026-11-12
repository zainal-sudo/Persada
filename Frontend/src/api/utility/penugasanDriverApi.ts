// api/utility/penugasanDriverApi.ts
// Penugasan Driver (Delphi: ufrmPenugasanDriver) — bulk reassign driver DO
import api from "@/api/axios";

export interface PenugasanDriverRow {
  nomor: string;
  faktur: string;
  tanggal: string;
  customer: string;
  alamat: string;
  cusKode: string;
  driver: string;
}

export interface PenugasanDriver {
  kode: string;
  nama: string;
}

export interface PenugasanAssignPayload {
  driver: string;
  user?: string;
  rows: { nomor: string }[];
}

export interface PenugasanAssignResult {
  jmlUpdate: number;
  driver: string;
  user: string;
}

export const penugasanDriverApi = {
  getDriver: async (): Promise<PenugasanDriver[]> => {
    const { data } = await api.get<{ success: boolean; data: PenugasanDriver[] }>(
      "/utility/penugasan-driver/driver"
    );
    return data.data;
  },

  getCustomers: async (): Promise<{ kode: string; nama: string }[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: { kode: string; nama: string }[];
    }>("/utility/penugasan-driver/customers");
    return data.data;
  },

  getDoList: async (
    startDate: string,
    endDate: string,
    driver?: string,
    customer?: string
  ): Promise<PenugasanDriverRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: PenugasanDriverRow[];
    }>("/utility/penugasan-driver/do-list", {
      params: { startDate, endDate, driver, customer },
    });
    return data.data;
  },

  assign: async (
    payload: PenugasanAssignPayload
  ): Promise<PenugasanAssignResult> => {
    const { data } = await api.post<{
      success: boolean;
      data: PenugasanAssignResult;
    }>("/utility/penugasan-driver/assign", payload);
    return data.data;
  },
};
