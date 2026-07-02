import { useRef, useCallback, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";

export function useTerminalWebSocket(
  terminalRef: RefObject<Terminal | null>,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalRef = useRef(false);

  const connectWs = useCallback(() => {
    if (!connectionId) return;

    const url = `ws://localhost:8091/ws/terminal/${connectionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    intentionalRef.current = false;

    ws.onopen = () => {
      onStatusChange?.("connected");
      terminalRef.current?.focus();
    };

    ws.onmessage = (event) => {
      terminalRef.current?.write(event.data);
    };

    ws.onclose = () => {
      onStatusChange?.("disconnected");
      if (!intentionalRef.current) {
        terminalRef.current?.write("\r\n\x1b[31m[连接已断开]\x1b[0m\r\n");
      }
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
    intentionalRef.current = true;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData, disconnectWs };
}
