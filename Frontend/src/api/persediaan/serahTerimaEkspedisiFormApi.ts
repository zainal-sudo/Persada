// api/persediaan/serahTerimaEkspedisiFormApi.ts
import api from "@/api/axios";

export type SerahTerimaEkspedisiTipe = "FP" | "DO" | "MUTASI";

export interface SerahTerimaEkspedisiDetail {
  check: number;
  nomor: string;
  nama: string;
  tanggal: string;
  nilai: number;
  nilai2: number;
  berat: number;
  kubikasi: number;
  biaya: number;
  /** Biaya/Nilai*100, dihitung FE saat biaya berubah (bukan kolom DB). */
  uoc: number;
  otorisasi: number;
  /** Kode otorisasi (jenis STE) yang dipakai baris ini — untuk ref_nomor di totorisasi. */
  otorisasiKode?: string;
}

export interface SerahTerimaEkspedisiForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  tanggal1: string;
  tanggal2: string;
  namaEkspedisi: string;
  keterangan: string;
  tipe: SerahTerimaEkspedisiTipe;
  realisasi?: number;
  detail: SerahTerimaEkspedisiDetail[];
}

const BASE = "/persediaan/serah-terima-ekspedisi/form";

export const serahTerimaEkspedisiFormApi = {
  getNomor: async (tanggal: string): Promise<{ nomor: string }> => {
    const { data } = await api.get<{ success: boolean; data: { nomor: string } }>(
      `${BASE}/get-max-nomor`,
      { params: { tanggal } }
    );
    return data.data;
  },

  // Baris detail hanya bisa dari sini (paritas Delphi: tidak ada tombol
  // tambah baris, satu-satunya sumber baris adalah tombol Load).
  // Saat edit, excludeSte = nomor dokumen ini supaya barisnya sendiri tidak
  // tersaring oleh subquery NOT IN di server.
  load: async (
    startDate: string,
    endDate: string,
    tipe: SerahTerimaEkspedisiTipe,
    excludeSte?: string
  ): Promise<SerahTerimaEkspedisiDetail[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: SerahTerimaEkspedisiDetail[];
    }>(`${BASE}/load`, { params: { startDate, endDate, tipe, excludeSte } });
    // uoc dihitung FE, BE tidak mengirimnya.
    return (data.data || []).map((d) => ({ ...d, uoc: 0 }));
  },

  getDetailForm: async (nomor: string): Promise<SerahTerimaEkspedisiForm> => {
    const { data } = await api.get<{ success: boolean; data: SerahTerimaEkspedisiForm }>(
      `${BASE}/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: SerahTerimaEkspedisiForm) => {
    const { data } = await api.post(`${BASE}/save`, payload);
    return data;
  },
};
