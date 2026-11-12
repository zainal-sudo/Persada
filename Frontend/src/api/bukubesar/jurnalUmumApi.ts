import api from "@/api/axios";

export interface JurnalUmumRow {
  Nomor: string;
  Tanggal: string;
  Keterangan: string;
  IsClosed: string;
  NilaiDebet: number;
  NilaiKredit: number;
}

export interface JurnalUmumDetailRow {
  Nomor: string;
  Account: string;
  AccountName: string;
  Debet: number;
  Kredit: number;
  CostCenter: string;
}

export interface JUPrintData {
  nomor: string;
  tanggal: string;
  keterangan: string;
  rekkredit: string;
  kredit: number;
  terbilang: string;
  perusahaan: {
    nama: string;
    alamat: string;
    kota: string;
    notelp: string;
  };
  detail: {
    account: string;
    accountName: string;
    debet: number;
    costCenter: string;
  }[];
}

export const jurnalUmumApi = {
  getBrowse: async (startDate: string, endDate: string): Promise<JurnalUmumRow[]> => {
    const { data } = await api.get<{ success: boolean; data: JurnalUmumRow[] }>(
      "/bukubesar/jurnal-umum",
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<JurnalUmumDetailRow[]> => {
    const { data } = await api.get<{ success: boolean; data: JurnalUmumDetailRow[] }>(
      `/bukubesar/jurnal-umum/detail/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`/bukubesar/jurnal-umum/${encodeURIComponent(nomor)}`);
  },

  // GET /bukubesar/jurnal-umum/print/:nomor — data cetak Jurnal Umum (browser print)
  getPrintData: async (nomor: string): Promise<JUPrintData> => {
    const { data } = await api.get<{ success: boolean; data: JUPrintData }>(
      `/bukubesar/jurnal-umum/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },
};