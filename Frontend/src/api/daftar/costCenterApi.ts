import api from "@/api/axios";

export interface CostCenter {
  kode: string;
  nama: string;
}

export const costCenterApi = {
  getAll: async (): Promise<CostCenter[]> => {
    const { data } = await api.get<{ success: boolean; data: CostCenter[] }>(
      "/daftar/cost-center"
    );
    return data.data;
  },

  getById: async (kode: string): Promise<CostCenter> => {
    const { data } = await api.get<{ success: boolean; data: CostCenter }>(
      `/daftar/cost-center/${encodeURIComponent(kode)}`
    );
    return data.data;
  },

  save: async (form: { isEdit: boolean; kode: string; nama: string }): Promise<void> => {
    await api.post("/daftar/cost-center/save", {
      isEdit: form.isEdit,
      kode: form.kode,
      nama: form.nama,
    });
  },

  delete: async (kode: string): Promise<void> => {
    await api.delete(`/daftar/cost-center/${encodeURIComponent(kode)}`);
  },
};
