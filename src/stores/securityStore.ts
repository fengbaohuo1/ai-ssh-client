import { create } from "zustand";
import { DEFAULT_USER_ID, TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "../api/client";

interface SecurityState {
  apiToken: string;
  userId: string;
  setApiToken: (token: string) => void;
  setUserId: (userId: string) => void;
}

function load(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // 隐私模式 / 存储不可用时静默降级
  }
}

export const useSecurityStore = create<SecurityState>((set) => ({
  apiToken: load(TOKEN_STORAGE_KEY, ""),
  userId: load(USER_STORAGE_KEY, DEFAULT_USER_ID),

  setApiToken: (token: string) => {
    persist(TOKEN_STORAGE_KEY, token.trim());
    set({ apiToken: token.trim() });
  },

  setUserId: (userId: string) => {
    const value = userId.trim() || DEFAULT_USER_ID;
    persist(USER_STORAGE_KEY, value);
    set({ userId: value });
  },
}));
