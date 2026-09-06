import type { TerminalTab } from "../../types";

export interface ServerSessionState {
  label: string;
  dotClass: string;
  connected: boolean;
}

/**
 * 服务器连接状态 = 前端当前页面的终端会话（TerminalTab，WS 驱动），
 * 而非后端连接池状态：本页面没有打开该服务器的终端/WS 未通，就不算真连上。
 */
export function serverSessionState(tab: TerminalTab | undefined): ServerSessionState {
  if (!tab) {
    return { label: "未连接（未打开终端）", dotClass: "bg-[var(--text-tertiary)] opacity-40", connected: false };
  }
  switch (tab.status) {
    case "connected":
      return {
        label: "已连接",
        dotClass: "bg-[var(--status-success)] shadow-[0_0_4px_var(--status-success)]",
        connected: true,
      };
    case "connecting":
      return { label: "连接中", dotClass: "bg-[var(--status-warning)] animate-pulse", connected: false };
    case "error":
      return { label: "连接失败", dotClass: "bg-[var(--status-error)]", connected: false };
    default:
      return { label: "已断开", dotClass: "bg-[var(--text-tertiary)] opacity-40", connected: false };
  }
}
