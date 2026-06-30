import { useRef, useEffect } from "react";
import type { TerminalTab } from "../../types";
import { useTerminal } from "../../hooks/useTerminal";
import { useTerminalDispatch } from "../../contexts/TerminalContext";

interface Props {
  tab: TerminalTab;
}

export default function TerminalView({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useTerminalDispatch();
  const { terminal } = useTerminal(containerRef);

  // 连接终端时显示欢迎信息（useEffect 避免渲染期间 dispatch）
  useEffect(() => {
    const term = terminal.current;
    if (term && tab.status === "disconnected") {
      dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status: "connected" });
      term.writeln(`\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m`);
      term.writeln(`\x1b[1;36m║\x1b[0m  AI SSH Client - Terminal Ready      \x1b[1;36m║\x1b[0m`);
      term.writeln(`\x1b[1;36m║\x1b[0m  Server: \x1b[1;33m${tab.serverName.padEnd(27)}\x1b[0m\x1b[1;36m║\x1b[0m`);
      term.writeln(`\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m`);
      term.writeln("");
    }
  }, [terminal.current, tab.status, tab.id, tab.serverName, dispatch]);

  if (tab.status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-app)] text-[var(--text-secondary)]">
        <div className="text-2xl mb-3">⚠️</div>
        <p className="text-sm text-[var(--status-error)]">连接失败</p>
        <p className="text-xs mt-1">{tab.errorMessage || "未知错误"}</p>
      </div>
    );
  }

  if (tab.status === "connecting") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-app)] text-[var(--text-secondary)]">
        <div className="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin mb-3" />
        <p className="text-sm">正在连接到 {tab.serverName}...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 xterm-container" />
  );
}
