import { create } from "zustand";

export interface FileExplorerTarget {
  connectionId: string;
  serverName: string;
  initialPath?: string;
}

interface FileExplorerState {
  target: FileExplorerTarget | null;
  open: (target: FileExplorerTarget) => void;
  close: () => void;
}

/**
 * 文件管理器开关状态——从服务器列表右键、状态栏、命令面板都能打开同一实例，
 * 避免每个入口各自复制一份弹层状态。
 */
export const useFileExplorerStore = create<FileExplorerState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
