import { useEffect, useState } from "react";
import { useSshState, useSshActions } from "../../contexts/SshContext";
import { useTerminalState } from "../../contexts/TerminalContext";
import { useServerSession } from "../../hooks/useServerSession";
import { serverSessionState } from "../ssh/sessionStatus";

/**
 * AI 目标服务器选择器（AI 面板顶部，位于对话/输入区之外）。
 * <p>
 * AI 助手要操作哪台服务器，统一在这里单选（暂时只支持单台）：
 * - 选中未连接的服务器 → 自动连接（打开终端标签并建立 WS），连接成功即绑定；
 * - 选项文案携带实时连接状态（前端页面会话为准）；
 * - 选择"纯对话"解除绑定；绑定服务器被断开/关闭时自动解除。
 * 左侧列表行的单击/双击不再兼任 AI 绑定，避免交互冲突。
 */
export default function TargetServerSelect() {
  const { servers, activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const { setActiveConnection } = useSshActions();
  const { connectAndOpen } = useServerSession();
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
      if (ok) {
        setActiveConnection(server.id);
      } else {
        console.error(`连接服务器失败: ${server.name}`);
      }
    } finally {
      setBusy(false);
    }
  };

  // 绑定跟随前端会话：已绑定的服务器失去会话（WS 断开/失败/标签被关）→ 自动解除绑定
  useEffect(() => {
    if (!activeConnectionId) return;
    const tab = tabs.find((t) => t.serverId === activeConnectionId);
    const dead = !tab || tab.status === "disconnected" || tab.status === "error";
    if (dead) {
      setActiveConnection(null);
    }
  }, [tabs, activeConnectionId, setActiveConnection]);

  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--border-default)] shrink-0 bg-[var(--surface-panel)]">
      <label className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">目标服务器</label>
      <select
        value={activeConnectionId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={busy}
        title="AI 助手要操作的服务器（选择未连接项将自动连接）"
        className="flex-1 min-w-0 bg-[var(--surface-input)] text-[var(--text-primary)] text-[11px]
                   rounded-md px-2 py-1 outline-none border border-transparent
                   focus:border-[var(--border-focus)] cursor-pointer disabled:opacity-50"
      >
        <option value="">纯对话（不绑定服务器）</option>
        {servers.map((s) => {
          const st = serverSessionState(tabs.find((t) => t.serverId === s.id));
          return (
            <option key={s.id} value={s.id}>
              {st.connected ? "● " : "○ "}
              {s.name}（{st.label}）
            </option>
          );
        })}
      </select>
    </div>
  );
}
