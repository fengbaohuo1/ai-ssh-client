import { useRef, useCallback, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";

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
      const url = `ws://localhost:8091/ws/terminal/${connectionId}`;
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
