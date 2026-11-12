// api/penjualan/listJualPerItemApi.ts
import api from "@/api/axios";

export interface ListJualPerItemRow {
  Nomor: string;
  Tanggal: string;
  Bulan: number;
  Tahun: number;
  Group_produk: string;
  Marketing: string;
  Rayon: string;
  Salesman: string;
  Outlet: string;
  Golongan: string;
  JenisCustomer: string;
  Kode: string;
  Nama: string;
  Merk: string;
  Kategori: string;
  SubDepartemen: string;
  Departemen: string;
  Divisi: string;
  Satuan: string;
  IsPf: string;
  Eceran: string;
  isCatalog: string;
  fpd_cn: number;
  Qty: number;
  Nilai: number;
  Nilaiblmppn: number;
  Kontrak: number;
  hpp?: number;
  margin?: number;
  biaya_promosi: number;
  fee_marketing: number;
  Nilai_Net: number;
  Pajak: number;
  StatusHet: string;
  kunjunganmarketing: number;
  kunjungansales: number;
  NilaiEkspedisi: number;
}

export interface FilterParams {
  startDate: string;
  endDate: string;
  customerCode?: string;
  customerName?: string;
  barangName?: string;
  isProductFocus?: boolean;
  isKontrak?: boolean;
  byInkaso?: boolean;
  linkMarketing?: boolean;
}

export const listJualPerItemApi = {
  getBrowse: async (params: FilterParams): Promise<ListJualPerItemRow[]> => {
    const { data } = await api.get<{ success: boolean; data: ListJualPerItemRow[] }>(
      "/penjualan/list-jual-per-item",
      { params }
    );
    return data.data;
  },
};