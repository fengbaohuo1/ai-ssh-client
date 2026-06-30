import { useState } from "react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useSshDispatch } from "../../contexts/SshContext";
import SettingsDialog from "../settings/SettingsDialog";

export default function Header() {
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const toggleRight = useLayoutStore((s) => s.toggleRightSidebar);
  const rightVisible = useLayoutStore((s) => s.rightSidebarVisible);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);
  const sshDispatch = useSshDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
    <header className="h-11 flex items-center bg-[var(--header-bg)] border-b border-[var(--border-default)] px-3 gap-2.5 shrink-0 select-none">
      {/* Left: collapse button + title */}
      <button
        onClick={toggleLeft}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--activity-bar-text)]
                   hover:text-[var(--activity-bar-hover)] hover:bg-[var(--surface-hover)] transition-all duration-150"
        title={leftVisible ? "隐藏侧边栏" : "显示侧边栏"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="1.5" />
          <line x1="5.5" y1="2" x2="5.5" y2="14" />
        </svg>
      </button>

      <span className="text-xs font-semibold text-[var(--header-text)] whitespace-nowrap tracking-tight">
        AI SSH Client
      </span>

      {/* Center: connection info placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[11px] text-[var(--text-tertiary)]">未连接</span>
      </div>

      {/* Right: toggle buttons + add */}
      <button
        onClick={() => sshDispatch({ type: "OPEN_ADD_DIALOG" })}
        className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]
                   hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]
                   px-2.5 py-1.5 rounded-md transition-all duration-150"
        title="添加 SSH 服务器"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>添加连接</span>
      </button>

      <div className="w-px h-4 bg-[var(--border-default)]" />

      <button
        onClick={toggleRight}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md transition-all duration-150 ${
          rightVisible
            ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        }`}
        title={rightVisible ? "隐藏 AI 面板" : "显示 AI 面板"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>AI 助手</span>
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)]
                   hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all duration-150"
        title="设置"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
