import { create } from "zustand";

// 左侧栏视图：ssh=服务器、history=会话历史、config=AI 配置（配置文件真实信息，只读）
export type SidebarView = "ssh" | "history" | "config";

interface LayoutState {
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  leftSidebarView: SidebarView;

  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarView: (view: SidebarView) => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  setRightSidebarVisible: (visible: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  leftSidebarVisible: true,
  rightSidebarVisible: true,
  leftSidebarView: "ssh",

  toggleLeftSidebar: () =>
    set((s) => ({ leftSidebarVisible: !s.leftSidebarVisible })),

  toggleRightSidebar: () =>
    set((s) => ({ rightSidebarVisible: !s.rightSidebarVisible })),

  setLeftSidebarView: (view) => set({ leftSidebarView: view, leftSidebarVisible: true }),

  setLeftSidebarVisible: (visible) => set({ leftSidebarVisible: visible }),

  setRightSidebarVisible: (visible) => set({ rightSidebarVisible: visible }),
}));
