import { useEffect, useState } from "react";
import { useSshState, useSshActions } from "../../contexts/SshContext";
import { useTerminalState } from "../../contexts/TerminalContext";
import { useServerSession } from "../../hooks/useServerSession";
import { serverSessionState } from "../ssh/sessionStatus";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";
import { toast } from "../../stores/toastStore";

/**
 * AI 目标服务器选择器（AI 面板顶部）。
 * <p>选中未连接项会自动连接并绑定；右侧文件夹按钮直接打开该服务器的 SFTP。
 */
export default function TargetServerSelect() {
  const { servers, activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const { setActiveConnection } = useSshActions();
  const { connectAndOpen } = useServerSession();
  const openExplorer = useFileExplorerStore((s) => s.open);
  const [busy, setBusy] = useState(false);

  const handleChange = async (value: string) => {
    if (!value) {
      setActiveConnection(null);
      return;
    }
    const server = servers.find((s) => s.id === value);
    if (!server) return;
    setBusy(true);
    try {
      const ok = await connectAndOpen(server);
      if (ok) setActiveConnection(server.id);
      else toast.error("连接服务器失败", server.name);
    } finally {
      setBusy(false);
    }
  };

  // 绑定跟随前端会话：会话消失则解除绑定
  useEffect(() => {
    if (!activeConnectionId) return;
    const tab = tabs.find((t) => t.serverId === activeConnectionId);
    if (!tab || tab.status === "disconnected" || tab.status === "error") {
      setActiveConnection(null);
    }
  }, [tabs, activeConnectionId, setActiveConnection]);

  const active = servers.find((s) => s.id === activeConnectionId);

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-3">
      <label className="shrink-0 text-[10px] text-[var(--text-tertiary)]">目标服务器</label>
      <select
        value={activeConnectionId ?? ""}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={busy}
        title="AI 助手要操作的服务器（选择未连接项将自动连接）"
        className="min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-[var(--surface-input)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] disabled:opacity-50"
      >
        <option value="">纯对话（不绑定服务器）</option>
        {servers.map((server) => {
          const st = serverSessionState(tabs.find((t) => t.serverId === server.id));
          return (
            <option key={server.id} value={server.id}>
              {st.connected ? "● " : "○ "}
              {server.name}
              {server.groupName ? ` · ${server.groupName}` : ""}（{st.label}）
            </option>
          );
        })}
      </select>
      <button
        onClick={() => {
          if (!active) {
            toast.info("请先选择并连接目标服务器");
            return;
          }
          openExplorer({ connectionId: active.id, serverName: active.name });
        }}
        disabled={!active}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent-bg)] disabled:opacity-30"
        title="打开该服务器的文件管理"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      </button>
      {busy ? (
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-[var(--border-default)] border-t-[var(--accent-bg)]" />
      ) : null}
    </div>
  );
}
