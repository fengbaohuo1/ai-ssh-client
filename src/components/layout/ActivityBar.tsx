import { useLayoutStore, type SidebarView } from "../../stores/layoutStore";
import type React from "react";

/** 顶部：SSH 服务器 + 会话历史（已实现的后端能力入口） */
const topViews: { id: SidebarView; label: string }[] = [
  { id: "ssh", label: "SSH 服务器" },
  { id: "history", label: "会话历史" },
];

/** 底部：AI 配置（后端配置文件真实信息只读展示） */
const bottomViews: { id: SidebarView; label: string }[] = [
  { id: "config", label: "AI 配置" },
];

/** SVG icon for SSH — terminal with connection nodes */
function SshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M5.5 7.5 8 10l-2.5 2.5" />
      <line x1="9" y1="12.5" x2="12.5" y2="12.5" />
    </svg>
  );
}

/** SVG icon for History — clock */
function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" />
      <polyline points="10,5.5 10,10 13.5,12" />
    </svg>
  );
}

/** SVG icon for AI 配置 — 芯片（模型/能力配置信息） */
function ConfigIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <rect x="8" y="8" width="4" height="4" />
      <line x1="7" y1="2" x2="7" y2="4" /><line x1="13" y1="2" x2="13" y2="4" />
      <line x1="7" y1="16" x2="7" y2="18" /><line x1="13" y1="16" x2="13" y2="18" />
      <line x1="2" y1="7" x2="4" y2="7" /><line x1="2" y1="13" x2="4" y2="13" />
      <line x1="16" y1="7" x2="18" y2="7" /><line x1="16" y1="13" x2="18" y2="13" />
    </svg>
  );
}

const iconMap: Record<SidebarView, React.FC> = {
  ssh: SshIcon,
  history: HistoryIcon,
  config: ConfigIcon,
};

export default function ActivityBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const activeView = useLayoutStore((s) => s.leftSidebarView);
  const setView = useLayoutStore((s) => s.setLeftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);

  const renderView = (v: { id: SidebarView; label: string }) => {
    const isActive = activeView === v.id && leftVisible;
    const Icon = iconMap[v.id];
    return (
      <button
        key={v.id}
        title={v.label}
        onClick={() => {
          if (isActive) { toggleLeft(); } else { setView(v.id); }
        }}
        className={`relative w-12 h-11 flex items-center justify-center transition-all duration-150
          ${isActive ? "text-[var(--activity-bar-active)]" : "text-[var(--activity-bar-text)] hover:text-[var(--activity-bar-hover)]"}`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r transition-all duration-200
            ${isActive ? "bg-[var(--accent-bg)] h-7" : "bg-transparent h-5"}`}
        />
        <Icon />
      </button>
    );
  };

  return (
    <div className="w-12 bg-[var(--activity-bar-bg)] flex flex-col items-center py-3 gap-0.5 border-r border-[var(--border-default)] shrink-0">
      {/* Top section: implemented backend entries */}
      {topViews.map(renderView)}

      {/* Separator */}
      <div className="w-6 h-px bg-[var(--border-default)] my-2" />

      {/* Bottom section: AI 配置（配置文件信息只读入口） */}
      {bottomViews.map(renderView)}

      {/* Spacer pushes settings to bottom */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <button
        onClick={onOpenSettings}
        className="w-12 h-11 flex items-center justify-center text-[var(--activity-bar-text)]
                   hover:text-[var(--activity-bar-hover)] transition-all duration-150 mb-1"
        title="设置"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
