import { useLayoutStore, type SidebarView } from "../../stores/layoutStore";
import type React from "react";

/** 顶部：运维概览 / 服务器 / 远程文件 / 会话历史 / 操作审计 */
const topViews: { id: SidebarView; label: string; hint: string }[] = [
  { id: "overview", label: "运维概览", hint: "后端健康与平台统计" },
  { id: "ssh", label: "SSH 服务器", hint: "主机分组与连接管理" },
  { id: "files", label: "远程文件", hint: "IDE 文件树与拖拽上传" },
  { id: "history", label: "会话历史", hint: "历史对话回放" },
  { id: "audit", label: "操作审计", hint: "命令与文件操作留痕" },
];

/** 底部：AI 配置 */
const bottomViews: { id: SidebarView; label: string; hint: string }[] = [
  { id: "config", label: "AI 配置", hint: "模型、工具与运行参数" },
];

function OverviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function SshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M5.5 7.5 8 10l-2.5 2.5" />
      <line x1="9" y1="12.5" x2="12.5" y2="12.5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" />
      <polyline points="10,5.5 10,10 13.5,12" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.2 17 5v5c0 4.2-2.9 6.9-7 7.8C5.9 16.9 3 14.2 3 10V5Z" />
      <path d="m6.8 10 2.1 2.1 4.3-4.3" />
    </svg>
  );
}

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

function FilesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.6 1.7h6.8a1.5 1.5 0 0 1 1.5 1.5v6.3a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z" />
    </svg>
  );
}

const iconMap: Record<SidebarView, React.FC> = {
  overview: OverviewIcon,
  ssh: SshIcon,
  files: FilesIcon,
  history: HistoryIcon,
  audit: AuditIcon,
  config: ConfigIcon,
};

export default function ActivityBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const activeView = useLayoutStore((s) => s.leftSidebarView);
  const setView = useLayoutStore((s) => s.setLeftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);

  const renderView = (v: { id: SidebarView; label: string; hint: string }) => {
    const isActive = activeView === v.id && leftVisible;
    const Icon = iconMap[v.id];
    return (
      <button
        key={v.id}
        title={`${v.label} — ${v.hint}`}
        onClick={() => {
          if (isActive) toggleLeft();
          else setView(v.id);
        }}
        className={`relative flex h-11 w-12 items-center justify-center transition-all duration-150
          ${isActive ? "text-[var(--activity-bar-active)]" : "text-[var(--activity-bar-text)] hover:text-[var(--activity-bar-hover)]"}`}
      >
        <span
          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r transition-all duration-200
            ${isActive ? "h-7 bg-[var(--accent-bg)]" : "bg-transparent"}`}
        />
        <Icon />
      </button>
    );
  };

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--border-default)] bg-[var(--activity-bar-bg)] py-3">
      {topViews.map(renderView)}

      <div className="my-2 h-px w-6 bg-[var(--border-default)]" />

      {bottomViews.map(renderView)}

      <div className="flex-1" />

      <button
        onClick={onOpenSettings}
        className="mb-1 flex h-11 w-12 items-center justify-center text-[var(--activity-bar-text)] transition-all hover:text-[var(--activity-bar-hover)]"
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
