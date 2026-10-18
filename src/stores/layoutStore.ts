import { create } from "zustand";

// 左侧栏视图：overview=运维概览、ssh=服务器、files=远程文件树、history=会话历史、audit=操作审计、config=AI 配置
export type SidebarView = "overview" | "ssh" | "files" | "history" | "audit" | "config";

// 设置弹窗页签：除基础页外，model=模型配置、agent=Agent 配置文件编辑
export type SettingsTab =
  | "appearance"
  | "security"
  | "shortcuts"
  | "about"
  | "model"
  | "agent";

interface LayoutState {
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  leftSidebarView: SidebarView;

  /** 设置弹窗是否打开（提升到全局，便于侧栏等入口直接跳转到指定页签） */
  settingsOpen: boolean;
  /** 设置弹窗当前页签 */
  settingsTab: SettingsTab;

  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarView: (view: SidebarView) => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  setRightSidebarVisible: (visible: boolean) => void;
  /** 打开设置弹窗；不传页签时回到「外观」 */
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  leftSidebarVisible: true,
  rightSidebarVisible: true,
  leftSidebarView: "ssh",

  settingsOpen: false,
  settingsTab: "appearance",

  toggleLeftSidebar: () => set((s) => ({ leftSidebarVisible: !s.leftSidebarVisible })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarVisible: !s.rightSidebarVisible })),
  setLeftSidebarView: (view) => set({ leftSidebarView: view, leftSidebarVisible: true }),
  setLeftSidebarVisible: (visible) => set({ leftSidebarVisible: visible }),
  setRightSidebarVisible: (visible) => set({ rightSidebarVisible: visible }),
  openSettings: (tab = "appearance") => set({ settingsOpen: true, settingsTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),
}));
