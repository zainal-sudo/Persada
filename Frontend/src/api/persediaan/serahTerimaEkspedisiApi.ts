// api/persediaan/serahTerimaEkspedisiApi.ts
// Serah Terima Ekspedisi (browse + cetak + hapus). Bukan
// tagihanEkspedisiApi.ts — modul itu Pvt yang memanggil endpoint ini
// untuk form v2-nya.
import api from "@/api/axios";

export interface SerahTerimaEkspedisiRow {
  Nomor: string;
  Tanggal: string;
  Tanggal1: string;
  Tanggal2: string;
  Serah: string;
  NamaEkspedisi: string;
  Realisasi: string;
  Note: string;
  Tipe: string;
}

export interface SerahTerimaEkspedisiDetailRow {
  Nomor: string;
  NomorFP: string;
  Customer: string;
  TanggalFP: string;
  Nilai: number;
  Berat: number;
  Kubikasi: number;
  Biaya: number;
}

export interface SerahTerimaEkspedisiPrintHeader {
  nomor: string;
  tanggal: string;
  serah: string;
  terima: string;
  namaEkspedisi: string;
  keterangan: string;
  tipe: string;
}

export interface SerahTerimaEkspedisiPrintDetail {
  nomor: string;
  nama: string;
  tanggal?: string;
  tujuan?: string;
  satuan?: string;
  qty?: number | null;
  nilai?: number;
  berat: number;
  kubikasi: number;
}

export interface SerahTerimaEkspedisiPrintData {
  mode: "ste" | "ste2";
  header: SerahTerimaEkspedisiPrintHeader;
  detail: SerahTerimaEkspedisiPrintDetail[];
}

const BASE = "/persediaan/serah-terima-ekspedisi";

export const serahTerimaEkspedisiApi = {
  getBrowse: async (
    startDate: string,
    endDate: string
  ): Promise<SerahTerimaEkspedisiRow[]> => {
    const { data } = await api.get<{ success: boolean; data: SerahTerimaEkspedisiRow[] }>(
      BASE,
      { params: { startDate, endDate } }
    );
    return data.data;
  },

  getDetail: async (nomor: string): Promise<SerahTerimaEkspedisiDetailRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: SerahTerimaEkspedisiDetailRow[];
    }>(`${BASE}/detail/${encodeURIComponent(nomor)}`);
    return data.data;
  },

  // Meminta slip juga menandai ste_realisasi = 1 (paritas teslip/steslip3).
  getPrintData: async (nomor: string): Promise<SerahTerimaEkspedisiPrintData> => {
    const { data } = await api.get<{ success: boolean; data: SerahTerimaEkspedisiPrintData }>(
      `${BASE}/print/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  delete: async (nomor: string): Promise<void> => {
    await api.delete(`${BASE}/${encodeURIComponent(nomor)}`);
  },
};
