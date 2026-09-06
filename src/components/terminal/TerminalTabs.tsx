import { useTerminalDispatch } from "../../contexts/TerminalContext";
import { useSshState, useSshActions } from "../../contexts/SshContext";
import type { TerminalTab } from "../../types";

interface Props {
  tabs: TerminalTab[];
  activeTabId: string | null;
}

export default function TerminalTabs({ tabs, activeTabId }: Props) {
  const dispatch = useTerminalDispatch();
  const { activeConnectionId } = useSshState();
  const { disconnectServer, setActiveConnection } = useSshActions();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-end bg-[var(--surface-panel)] border-b border-[var(--border-default)]">
      <div className="flex h-[34px] overflow-x-auto flex-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => dispatch({ type: "SET_ACTIVE_TAB", id: tab.id })}
              className={`group relative flex items-center gap-2 px-3.5 text-xs cursor-pointer select-none
                border-r border-[var(--border-subtle)] transition-colors duration-100 flex-shrink-0
                ${isActive
                  ? "bg-[var(--surface-tab-active)] text-[var(--text-primary)]"
                  : "bg-[var(--surface-tab-inactive)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
            >
              {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--accent-bg)]" />}

              {/* Server icon or terminal icon */}
              {tab.serverId ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.8" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M6 7l4 4-4 4" />
                  <line x1="13" y1="15" x2="17" y2="15" />
                </svg>
              )}

              <div className="flex items-center gap-1.5 min-w-0">
                {/* Status dot */}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  tab.status === "connected" ? "bg-[var(--status-success)]"
                  : tab.status === "connecting" ? "bg-[var(--status-warning)] animate-pulse"
                  : tab.status === "error" ? "bg-[var(--status-error)]"
                  : "bg-[var(--text-tertiary)]"
                }`} />

                {/* Server name */}
                <span className="truncate">{tab.serverName}</span>
              </div>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tab.serverId) {
                    // SSH 标签关闭时自动断开连接；若该服务器正被 AI 绑定则解除
                    disconnectServer(tab.serverId);
                    if (activeConnectionId === tab.serverId) {
                      setActiveConnection(null);
                    }
                  }
                  dispatch({ type: "CLOSE_TAB", id: tab.id });
                }}
                className="flex items-center justify-center w-4 h-4 rounded-sm
                           text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                           hover:bg-[var(--status-danger-hover)]
                           opacity-0 group-hover:opacity-100 transition-all duration-100"
                title="关闭"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
