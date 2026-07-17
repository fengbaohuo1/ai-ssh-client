import { useRef, useCallback, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";

/** AI 操作中的标识文本前缀（与后端 UnifiedSessionManager 一致） */
const AI_LOCK_PREFIX = "\r\n[33m■ AI 正在操作:";
const AI_UNLOCK_PREFIX = "\r\n[32m■ AI 操作完成";

export function useTerminalWebSocket(
  terminalRef: RefObject<Terminal | null>,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false);

  const connectWs = useCallback(() => {
    if (!connectionId) return;

    const url = `ws://localhost:8091/ws/terminal/${connectionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      hasConnectedRef.current = true;
      onStatusChange?.("connected");
      terminalRef.current?.focus();
    };

    ws.onmessage = (event) => {
      const data = event.data as string;
      const terminal = terminalRef.current;
      if (!terminal) return;

      // 检测 AI 锁定/解锁消息，控制终端输入
      if (data.startsWith(AI_LOCK_PREFIX)) {
        terminal.options.disableStdin = true;
      } else if (data.startsWith(AI_UNLOCK_PREFIX)) {
        terminal.options.disableStdin = false;
      }

      // 所有消息都写入终端（包括 AI 状态消息，提供视觉反馈）
      terminal.write(data);
    };

    ws.onclose = () => {
      onStatusChange?.("disconnected");
      if (hasConnectedRef.current) {
        terminalRef.current?.write("\r\n[31m[连接已断开][0m\r\n");
      }
      hasConnectedRef.current = false;
    };

    ws.onerror = () => {
      onStatusChange?.("error");
    };
  }, [connectionId, terminalRef, onStatusChange]);

  const sendData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const disconnectWs = useCallback(() => {
    hasConnectedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData, disconnectWs };
}
