import { create } from "zustand";

export type SidebarView = "ssh" | "files" | "sftp" | "mcp" | "skills" | "plugins";

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
