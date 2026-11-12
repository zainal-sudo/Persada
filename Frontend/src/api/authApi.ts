import api from "./axios";

export interface CabangItem {
  kode: string;
  cbg_nama: string;
  dbase: string;
}

export interface CabangResponse {
  cabangs: CabangItem[];
  defaultDbase: string;
  isLocked: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
  dbase: string;
  cbgNama: string;
}

export interface AuthUser {
  kode: string;
  nama: string;
  level: string;
  cabang: string;
  cabangNama?: string;
  database?: string;
  menus?: MenuPermission[];
}

export interface MenuPermission {
  menu_id: string;
  hak_view: "Y" | "N";
  hak_insert: "Y" | "N";
  hak_edit: "Y" | "N";
  hak_delete: "Y" | "N";
  hak_print: "Y" | "N";
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface UserItem {
  kode: string;
  nama: string;
}

export const authApi = {
  getCabang: async (): Promise<CabangResponse> => {
    const { data } = await api.get<{ success: boolean; data: CabangResponse }>(
      "/auth/cabang",
    );
    return data.data;
  },

  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const { data } = await api.post<{ success: boolean; data: LoginResponse }>(
      "/auth/login",
      payload,
    );
    return data.data;
  },

  getUsers: async (): Promise<UserItem[]> => {
    const { data } = await api.get<{ success: boolean; data: UserItem[] }>(
      "/auth/users"
    );
    return data.data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await api.get<{ success: boolean; data: AuthUser }>(
      "/auth/me",
    );
    return data.data;
  },
};
