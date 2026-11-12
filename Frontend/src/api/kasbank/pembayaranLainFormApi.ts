import api from "@/api/axios";

export interface PembayaranLainDetail {
  no?: number;
  account: string;
  accountName: string;
  nilai: number;
  memo: string;
  costCenter: string;
  customer: string;
  kendaraan: string;
  kilometer: number;
  ekspedisi: string;
  /** Nama ekspedisi dari tekspedisi. Kosong = id tidak resolve, FE tampilkan id. */
  ekspedisiNama: string;
}

export interface PembayaranLainForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  keterangan: string;
  nilai: number;
  account: string;
  namaAccount: string;
  tipe: "KK" | "BK";
  locked?: number;
  detail: PembayaranLainDetail[];
}

export const pembayaranLainFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string, tipe: string): Promise<string> => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/get-max-nomor", {
      params: { tanggal, cabang, tipe },
    });
    return data.data.nomor;
  },

  // scope "header" (default) = akun Kas (11%) / Bank (12%), untuk kotak
  // Account di header. scope "detail" = seluruh akun aktif, untuk kolom
  // Account di grid detail (paritas Delphi bantuanaccount). Jangan tukar
  // keduanya: header yang dilepas filternya bisa jadi debit ke akun biaya.
  searchAccount: async (search: string, tipe: string, scope: "header" | "detail" = "header") => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/search-account", {
      params: { search, tipe, scope },
    });
    return data.data as { kode: string; nama: string }[];
  },

  searchCostCenter: async () => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/cost-center");
    return data.data as { kode: string; nama: string }[];
  },

  searchCustomer: async (search: string) => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/customer", {
      params: { search },
    });
    return data.data as { kode: string; nama: string }[];
  },

  searchKendaraan: async (search: string) => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/kendaraan", {
      params: { search },
    });
    return data.data as { nopol: string; tipe: string }[];
  },

  searchEkspedisi: async (search: string) => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/ekspedisi", {
      params: { search },
    });
    return data.data as { id: string; nama: string }[];
  },

  cekBiaya: async (account: string) => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/cek-biaya", {
      params: { account },
    });
    return data.data as { needCostCenter: boolean; needCustomer: boolean; needKendaraan: boolean; needEkspedisi: boolean };
  },

  cekPeriode: async (tanggal: string): Promise<boolean> => {
    const { data } = await api.get("/kasbank/pembayaran-lain/form/cek-periode", {
      params: { tanggal },
    });
    return data.data.closed;
  },

  getDetailForm: async (nomor: string): Promise<PembayaranLainForm> => {
    const { data } = await api.get(
      `/kasbank/pembayaran-lain/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PembayaranLainForm) => {
    const { data } = await api.post("/kasbank/pembayaran-lain/form/save", payload);
    return data;
  },
};