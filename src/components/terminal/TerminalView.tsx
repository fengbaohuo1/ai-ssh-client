import { useRef, useEffect, useState } from "react";
import type { TerminalTab } from "../../types";
import { useTerminal } from "../../hooks/useTerminal";
import { useTerminalWebSocket } from "../../hooks/useTerminalWebSocket";
import { useTerminalDispatch } from "../../contexts/TerminalContext";
import { useSshActions } from "../../contexts/SshContext";

interface Props {
  tab: TerminalTab;
}

export default function TerminalView({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useTerminalDispatch();
  const { connectServer } = useSshActions();
  const { terminal: terminalRef, fitAddon } = useTerminal(containerRef);
  const [retrying, setRetrying] = useState(false);

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
          <button
            onClick={async () => {
              if (!tab.serverId || retrying) return;
              setRetrying(true);
              dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status: "connecting" });
              try {
                const res = await connectServer(tab.serverId);
                if (res?.code === "0000") {
                  connectWs();
                } else {
                  dispatch({
                    type: "UPDATE_TAB_STATUS",
                    id: tab.id,
                    status: "error",
                    errorMessage: res?.info || "重新连接失败",
                  });
                }
              } finally {
                setRetrying(false);
              }
            }}
            disabled={retrying}
            className="mt-4 rounded-md bg-[var(--accent-bg)] px-3.5 py-1.5 text-xs font-medium text-white
                       hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            {retrying ? "重连中…" : "重新连接"}
          </button>
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">或关闭此标签后从左侧双击服务器重建会话</p>
        </div>
      )}
    </div>
  );
}
