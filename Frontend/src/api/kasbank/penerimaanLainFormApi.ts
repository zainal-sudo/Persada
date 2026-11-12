import api from "@/api/axios";

export interface PenerimaanLainDetail {
  no?: number;
  account: string;
  accountName: string;
  nilai: number;
  memo: string;
  costCenter: string;
  customer: string;
}

export interface PenerimaanLainForm {
  isEdit: boolean;
  nomor: string;
  tanggal: string;
  keterangan: string;
  nilai: number;
  account: string;
  namaAccount: string;
  tipe: "KM" | "BM";
  locked?: number;
  detail: PenerimaanLainDetail[];
}

export const penerimaanLainFormApi = {
  getMaxNomor: async (tanggal: string, cabang: string, tipe: string): Promise<string> => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/get-max-nomor", {
      params: { tanggal, cabang, tipe },
    });
    return data.data.nomor;
  },

  // scope "header" (default) = akun Kas (11%) / Bank (12%), untuk kotak
  // Account di header. scope "detail" = seluruh akun aktif, untuk kolom
  // Account di grid detail (paritas Delphi bantuanaccount). Jangan tukar
  // keduanya: header yang dilepas filternya bisa jadi debit ke akun biaya.
  searchAccount: async (search: string, tipe: string, scope: "header" | "detail" = "header") => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/search-account", {
      params: { search, tipe, scope },
    });
    return data.data as { kode: string; nama: string }[];
  },

  getAccountByKode: async (kode: string) => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/account", {
      params: { kode },
    });
    return data.data as { kode: string; nama: string };
  },

  searchCostCenter: async () => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/cost-center");
    return data.data as { kode: string; nama: string }[];
  },

  searchCustomer: async (search: string) => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/customer", {
      params: { search },
    });
    return data.data as { kode: string; nama: string }[];
  },

  cekBiaya: async (account: string): Promise<boolean> => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/cek-biaya", {
      params: { account },
    });
    return data.data.needCustomer;
  },

  cekPeriode: async (tanggal: string): Promise<boolean> => {
    const { data } = await api.get("/kasbank/penerimaan-lain/form/cek-periode", {
      params: { tanggal },
    });
    return data.data.closed;
  },

  getDetailForm: async (nomor: string): Promise<PenerimaanLainForm> => {
    const { data } = await api.get(
      `/kasbank/penerimaan-lain/form/${encodeURIComponent(nomor)}`
    );
    return data.data;
  },

  save: async (payload: PenerimaanLainForm) => {
    const { data } = await api.post("/kasbank/penerimaan-lain/form/save", payload);
    return data;
  },
};