import { useCallback } from "react";
import type { SshServer } from "../types";
import { useSshActions } from "../contexts/SshContext";
import { useTerminalState, useTerminalDispatch } from "../contexts/TerminalContext";

/**
 * 服务器会话编排 hook（跨 Ssh/Terminal 两个 context 的唯一连接入口）。
 * <p>
 * 语义：连接 = 打开该服务器的终端标签并建立 WS（前端 session 为准）。
 * - 已有已连接标签 → 仅激活；
 * - 已有标签但 WS 断开/失败 → 回收旧标签重建（TerminalView 只在挂载时发起连接，无自动重连）；
 * - 无标签 → HTTP connect 成功后打开标签（挂载即连 WS）。
 *
 * 供 SshServerItem（双击/右键连接）与 AI 面板目标服务器选择器复用。
 */
export function useServerSession() {
  const { tabs } = useTerminalState();
  const terminalDispatch = useTerminalDispatch();
  const { connectServer } = useSshActions();

  /** 确保目标服务器在本页面有已连接的终端会话；返回是否成功（HTTP connect 层面） */
  const connectAndOpen = useCallback(async (server: SshServer): Promise<boolean> => {
    const tab = tabs.find((t) => t.serverId === server.id);
    if (tab && tab.status === "connected") {
      terminalDispatch({ type: "SET_ACTIVE_TAB", id: tab.id });
      return true;
    }
    if (tab) {
      // WS 已断开/失败：回收旧标签，重建以触发重连
      terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
    }
    try {
      const res = await connectServer(server.id);
      if (res?.code === "0000") {
        terminalDispatch({ type: "OPEN_SERVER_TAB", serverId: server.id, serverName: server.name });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [tabs, terminalDispatch, connectServer]);

  return { connectAndOpen };
}
