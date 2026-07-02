import { useRef, useEffect } from "react";
import type { TerminalTab } from "../../types";
import { useTerminal } from "../../hooks/useTerminal";
import { useTerminalWebSocket } from "../../hooks/useTerminalWebSocket";
import { useTerminalDispatch } from "../../contexts/TerminalContext";

interface Props {
  tab: TerminalTab;
}

export default function TerminalView({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useTerminalDispatch();
  const { terminal: terminalRef, fitAddon } = useTerminal(containerRef);

  const { connectWs, sendData, disconnectWs } = useTerminalWebSocket(
    terminalRef,
    tab.serverId || "",
    (status) => {
      dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status });
    }
  );

  // 挂载时建立 WebSocket 连接
  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal && tab.serverId && tab.status !== "connected") {
      dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status: "connecting" });
      connectWs();

      const disposable = terminal.onData((data) => {
        sendData(data);
      });

      return () => {
        disposable.dispose();
        disconnectWs();
      };
    }
  }, [terminalRef, tab.serverId]);

  // 用 ResizeObserver 监听容器从 display:none 恢复 visible
  useEffect(() => {
    const container = containerRef.current;
    const fit = fitAddon.current;
    if (!container || !fit) return;

    // 轮询容器可见性，visible 时触发 fit
    const observer = new ResizeObserver(() => {
      if (container.offsetHeight > 0) {
        try { fit.fit(); } catch {}
      }
    });
    observer.observe(container);

    // 初始延迟触发一次 fit
    const timer = setTimeout(() => {
      if (container.offsetHeight > 0) {
        try { fit.fit(); } catch {}
      }
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [fitAddon]);

  return (
    <div className="absolute inset-0">
      {/* xterm container — always rendered so terminal instance stays alive */}
      <div ref={containerRef} className="absolute inset-0 xterm-container" />

      {/* Connecting overlay */}
      {tab.status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-app)]/80 text-[var(--text-secondary)]">
          <div className="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin mb-3" />
          <p className="text-sm">正在连接到 {tab.serverName}...</p>
        </div>
      )}

      {/* Error overlay */}
      {tab.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-app)] text-[var(--text-secondary)]">
          <div className="text-2xl mb-3">⚠️</div>
          <p className="text-sm text-[var(--status-error)]">连接失败</p>
          <p className="text-xs mt-1">{tab.errorMessage || "未知错误"}</p>
        </div>
      )}
    </div>
  );
}
