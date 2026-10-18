import { create } from "zustand";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  createdAt: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, title: string, message?: string, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, title, message, durationMs = 4200) => {
    const id = `toast-${Date.now()}-${counter++}`;
    const item: ToastItem = { id, kind, title, message, createdAt: Date.now() };
    set((state) => ({ toasts: [...state.toasts.slice(-4), item] }));
    if (durationMs > 0) {
      window.setTimeout(() => get().dismiss(id), durationMs);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** 非组件环境（api / store）直接调用 */
export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().push("success", title, message),
  error: (title: string, message?: string) => useToastStore.getState().push("error", title, message, 6500),
  warning: (title: string, message?: string) => useToastStore.getState().push("warning", title, message, 5500),
  info: (title: string, message?: string) => useToastStore.getState().push("info", title, message),
};
