import api from "@/api/axios";

export interface PratinjauJurnalBulananRow {
  jenis: string;
  nomor: string;
  tanggal: string | null;
  keterangan: string;
  totalDebet: number;
  totalKredit: number;
  bisaDiposting: boolean;
  alasan: string;
}

export interface PratinjauJurnalBulanan {
  bulan: number;
  tahun: number;
  rows: PratinjauJurnalBulananRow[];
  bisaDiposting: boolean;
  alasan: string;
  totalDebet: number;
  totalKredit: number;
}

export interface HasilPostingJurnalBulanan {
  bulan: number;
  tahun: number;
  jumlahJurnal: number;
  totalDebet: number;
  totalKredit: number;
  user: string;
}

export const postingJurnalBulananApi = {
  pratinjau: async (bulan: number, tahun: number): Promise<PratinjauJurnalBulanan> => {
    const { data } = await api.get("/utility/posting-jurnal-bulanan/pratinjau", {
      params: { bulan, tahun },
    });
    return data?.data;
  },

  proses: async (payload: { bulan: number; tahun: number }): Promise<HasilPostingJurnalBulanan> => {
    const { data } = await api.post("/utility/posting-jurnal-bulanan/proses", payload);
    return data?.data;
  },
};
