// api/penjualan/fakturPajakV3Api.ts
import api from "@/api/axios";

export interface FakturPajakV3Row {
  baris: number;
  tanggal: string;
  jenisFaktur: string;
  kodeTransaksi: string;
  keteranganTambahan: string;
  dokumenPendukung: string;
  periodeDokPendukung: string;
  referensi: string;
  capFasilitas: string;
  idTkuPenjual: string;
  npwpPembeli: string;
  jenisIdPembeli: string;
  negaraPembeli: string;
  nomorDokumenPembeli: string;
  namaPembeli: string;
  alamatPembeli: string;
  emailPembeli: string;
  idTkuPembeli: string;
}

export const fakturPajakV3Api = {
  // GET /api/penjualan/faktur-pajak-v3/refresh?startDate=&endDate=&isManual=
  refresh: async (startDate: string, endDate: string, isManual: number): Promise<FakturPajakV3Row[]> => {
    const { data } = await api.get<{ success: boolean; data: FakturPajakV3Row[] }>(
      "/penjualan/faktur-pajak-v3/refresh",
      { params: { startDate, endDate, isManual } }
    );
    return data.data;
  },

  // POST /api/penjualan/faktur-pajak-v3/export
  // referensiList = whitelist nomor FP dari baris yang tersisa (paritas Delphi export dari CDS).
  // POST (bukan GET) karena daftar referensi bisa panjang — GET query string
  // melewati limit header nginx (414).
  exportExcel: async (startDate: string, endDate: string, isManual: number, referensiList?: string[]) => {
    const response = await api.post(
      "/penjualan/faktur-pajak-v3/export",
      {
        startDate,
        endDate,
        isManual,
        referensi: referensiList?.length ? referensiList : undefined,
      },
      { responseType: "blob" }
    );
    return response.data;
  },
};