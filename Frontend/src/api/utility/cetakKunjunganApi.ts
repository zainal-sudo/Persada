// api/utility/cetakKunjunganApi.ts
// Cetak Kunjungan (Delphi: ufrmCetakKunjungan) — laporan read-only
import api from "@/api/axios";

export interface KunjunganRow {
  user: string;
  cus_kode: string;
  cus_nama: string;
  tanggal: string;
  jam: string;
  kar_cabang: string;
  hari: string;
  koordinat: string;
  jarak: number;
}

export interface KunjunganSalesman {
  kode: string;
  nama: string;
}

export interface KunjunganPerusahaan {
  perush_nama: string;
  perush_alamat: string;
  perush_kota: string;
}

export const cetakKunjunganApi = {
  getSalesman: async (): Promise<KunjunganSalesman[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: KunjunganSalesman[];
    }>("/utility/cetak-kunjungan/salesman");
    return data.data;
  },

  getKunjungan: async (
    startDate: string,
    endDate: string,
    salesman: string
  ): Promise<KunjunganRow[]> => {
    const { data } = await api.get<{
      success: boolean;
      data: KunjunganRow[];
    }>("/utility/cetak-kunjungan", {
      params: { startDate, endDate, salesman },
    });
    return data.data;
  },

  getPerusahaan: async (): Promise<KunjunganPerusahaan | null> => {
    const { data } = await api.get<{
      success: boolean;
      data: KunjunganPerusahaan | null;
    }>("/utility/cetak-kunjungan/perusahaan");
    return data.data;
  },
};
