// api/daftar/formasiFormApi.ts
import api from "@/api/axios";

export interface FormasiOption {
  id: number;
  nama: string;
}

export interface SalesmanOption {
  kode: string;
  nama: string;
}

export interface AreaOption {
  kode: string;
  nama: string;
  formasiId: number;
}

export interface TypeOption {
  kode: string;
  keterangan: string;
  level: number;
}

export interface FormasiTarget {
  periode: number;
  nama: string;
  target: number;
  targetJenis?: string;
  additionalTargetProduk?: string;
}

export interface FormasiArea {
  kode: string;
  nama: string;
}

export interface FormasiForm {
  isEdit: boolean;
  id: number | null;
  nama: string;
  divisi: string;
  type: string;
  atasanKode: string;
  areas: string[];
  target: FormasiTarget[];
  tahun?: number;
}

export interface FormasiDetail {
  id: number;
  nama: string;
  divisi: string;
  type: string;
  atasanKode: string;
  areas: FormasiArea[];
}

export const formasiFormApi = {
  getOptions: async (search = ""): Promise<FormasiOption[]> => {
    const { data } = await api.get("/daftar/formasi/form/options", {
      params: { search },
    });
    return data.data as FormasiOption[];
  },

  getSalesmanOptions: async (search = ""): Promise<SalesmanOption[]> => {
    const { data } = await api.get("/daftar/formasi/form/salesman-options", {
      params: { search },
    });
    return data.data as SalesmanOption[];
  },

  getAreaOptions: async (search = ""): Promise<AreaOption[]> => {
    const { data } = await api.get("/daftar/formasi/form/area-options", {
      params: { search },
    });
    return data.data as AreaOption[];
  },

  getTypeOptions: async (search = ""): Promise<TypeOption[]> => {
    const { data } = await api.get("/daftar/formasi/form/type-options", {
      params: { search },
    });
    return data.data as TypeOption[];
  },

  getDetailForm: async (id: number): Promise<FormasiDetail> => {
    const { data } = await api.get(
      `/daftar/formasi/form/detail/${encodeURIComponent(String(id))}`
    );
    return data.data;
  },

  getTargetBulanan: async (id: number, tahun: number) => {
    const { data } = await api.get("/daftar/formasi/form/target-bulanan", {
      params: { id, tahun },
    });
    return data.data as FormasiTarget[];
  },

  save: async (payload: FormasiForm) => {
    const { data } = await api.post("/daftar/formasi/form/save", payload);
    return data;
  },
};
