import { useTerminalState } from "../../contexts/TerminalContext";
import { useLayoutStore } from "../../stores/layoutStore";
import TerminalTabs from "./TerminalTabs";
import TerminalView from "./TerminalView";

export default function TerminalPanel() {
  const { tabs, activeTabId } = useTerminalState();
  const setLeftView = useLayoutStore((s) => s.setLeftSidebarView);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-app)]">
      {tabs.length > 0 ? <TerminalTabs tabs={tabs} activeTabId={activeTabId} /> : null}

      <div className="relative flex-1">
        {tabs.length === 0 ? (
          <div className="absolute inset-0 flex select-none flex-col items-center justify-center">
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-default)]"
              style={{ background: "linear-gradient(145deg, var(--surface-panel), var(--surface-input))", boxShadow: "var(--shadow-md)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--accent-bg)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M6 7l4 4-4 4" />
                <line x1="13" y1="15" x2="17" y2="15" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">终端</p>
            <p className="mb-4 text-xs text-[var(--text-secondary)]">从左侧双击服务器以连接</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLeftView("ssh")}
                className="rounded-md bg-[var(--accent-bg)] px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                打开服务器列表
              </button>
              <button
                onClick={() => setLeftView("overview")}
                className="rounded-md bg-[var(--surface-input)] px-3.5 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                查看运维概览
              </button>
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: tab.id === activeTabId ? "block" : "none" }}
            >
              <TerminalView tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
