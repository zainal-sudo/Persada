import apiClient from "./axios";

export interface ChangelogEntry {
  version: string;
  date?: string | null;
  notes: string[];
}

export interface SystemInfo {
  name: string;
  version: string;
  date?: string | null;
  changelog: string[];
  history: ChangelogEntry[];
}

export const systemApi = {
  getInfo: async (): Promise<SystemInfo> => {
    const { data } = await apiClient.get("/system/info");
    return data.data;
  },
};
