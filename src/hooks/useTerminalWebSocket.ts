import { useRef, useCallback, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import { getApiBase, readAuth } from "../api/client";

/**
 * WebSocket 基址：运行期读取（Tauri 侧后端端口是启动后才知道的）。
 * 浏览器开发直连 8091（Vite 只代理 /api）；Tauri 用 API 基址同源升级。
 */
function wsBase(): string {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
  const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (import.meta.env.DEV && !inTauri) return "ws://localhost:8091";
  return getApiBase().replace(/^http/, "ws");
}

export function useTerminalWebSocket(
  terminalRef: RefObject<Terminal | null>,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWs = useCallback(() => {
    if (!connectionId) return;

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    connectTimerRef.current = setTimeout(() => {
      const token = readAuth().token;
      const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
      const url = `${wsBase()}/ws/terminal/${connectionId}${query}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        hasConnectedRef.current = true;
        onStatusChange?.("connected");
        terminalRef.current?.focus();
      };

      ws.onmessage = (event) => {
        const terminal = terminalRef.current;
        if (terminal) {
          terminal.write(event.data);
        }
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
    }, 0);
  }, [connectionId, terminalRef, onStatusChange]);

  const sendData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      console.warn("[WS] 键盘输入丢弃: readyState=", wsRef.current?.readyState, "data=", data);
    }
  }, []);

  const disconnectWs = useCallback(() => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
    hasConnectedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData, disconnectWs };
}
