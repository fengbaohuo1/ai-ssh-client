import { useMemo } from "react";
import { useTerminalState } from "../../contexts/TerminalContext";
import TerminalTabs from "./TerminalTabs";
import TerminalView from "./TerminalView";

export default function TerminalPanel() {
  const { serverTabs, activeServerId, localTabs, activeTabId, activeLocalTabId } = useTerminalState();

  // Determine which tabs to display in the tab bar
  const currentTabs = activeServerId
    ? (serverTabs[activeServerId] || [])
    : localTabs;

  const currentActiveTabId = activeServerId ? activeTabId : activeLocalTabId;
  const isEmpty = currentTabs.length === 0;

  // Collect ALL tabs across all servers + local to keep instances alive
  const allTabs = useMemo(() => {
    const result: Array<{ tab: typeof localTabs[0]; visible: boolean }> = [];
    // Add all server tabs
    for (const [sid, tabs] of Object.entries(serverTabs)) {
      for (const tab of tabs) {
        result.push({ tab, visible: sid === activeServerId && tab.id === currentActiveTabId });
      }
    }
    // Add all local tabs
    for (const tab of localTabs) {
      result.push({ tab, visible: tab.id === activeLocalTabId && !activeServerId });
    }
    return result;
  }, [serverTabs, activeServerId, localTabs, activeLocalTabId, currentActiveTabId]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-app)]">
      {/* Only show tab bar when there are tabs for the active context */}
      {!isEmpty && (
        <TerminalTabs
          tabs={currentTabs}
          activeTabId={currentActiveTabId}
          serverId={activeServerId}
        />
      )}

      <div className="flex-1 relative">
        {allTabs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-input)] flex items-center justify-center mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   className="text-[var(--text-secondary)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M6 7l4 4-4 4" />
                <line x1="13" y1="15" x2="17" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-primary)] mb-1 font-medium">终端</p>
            <p className="text-xs text-[var(--text-secondary)]">
              从左侧双击服务器以连接
            </p>
          </div>
        ) : (
          allTabs.map(({ tab, visible }) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: visible ? "block" : "none" }}
            >
              <TerminalView tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
