import { useLayoutStore, type SidebarView } from "../../stores/layoutStore";
import type React from "react";

const topViews: { id: SidebarView; label: string }[] = [
  { id: "ssh", label: "SSH 服务器" },
  { id: "files", label: "文件浏览" },
  { id: "sftp", label: "SFTP 传输" },
];

const bottomViews: { id: SidebarView; label: string }[] = [
  { id: "mcp", label: "MCP 服务器" },
  { id: "skills", label: "技能管理" },
  { id: "plugins", label: "插件管理" },
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

/** SVG icon for Files — folder */
function FilesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5.5a1 1 0 0 1 1-1h4.2l1.6 2h5.2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
    </svg>
  );
}

/** SVG icon for SFTP — arrows up/down with document */
function SftpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h7l1.5 2H16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      <line x1="7" y1="10" x2="10" y2="10" />
      <polyline points="10,14 7,11 10,11" />
      <line x1="10" y1="5" x2="10" y2="14" />
      <polyline points="7,9 10,12 13,9" />
    </svg>
  );
}

/** SVG icon for MCP — server/plug */
function McpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <line x1="8.5" y1="10" x2="11.5" y2="10" />
    </svg>
  );
}

/** SVG icon for Skills — lightning bolt */
function SkillsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11,2 4,12 9,12 7,18 16,8 11,8 13,2" />
    </svg>
  );
}

/** SVG icon for Plugins — puzzle piece */
function PluginsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2h3a2 2 0 0 1 2 2v3l-2 2 2 2v3a2 2 0 0 1-2 2h-3l-2-2-2 2H5a2 2 0 0 1-2-2v-3l2-2-2-2V4a2 2 0 0 1 2-2h3l2 2z" />
    </svg>
  );
}

const iconMap: Record<SidebarView, React.FC> = {
  ssh: SshIcon,
  files: FilesIcon,
  sftp: SftpIcon,
  mcp: McpIcon,
  skills: SkillsIcon,
  plugins: PluginsIcon,
};

export default function ActivityBar() {
  const activeView = useLayoutStore((s) => s.leftSidebarView);
  const setView = useLayoutStore((s) => s.setLeftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);

  return (
    <div className="w-12 bg-[var(--activity-bar-bg)] flex flex-col items-center py-3 gap-0.5 border-r border-[var(--border-default)] shrink-0">
      {/* Top section: file/connection management */}
      {topViews.map((v) => {
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
      })}

      {/* Separator */}
      <div className="w-6 h-px bg-[var(--border-default)] my-2" />

      {/* Bottom section: MCP / Skills / Plugins */}
      {bottomViews.map((v) => {
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
      })}
    </div>
  );
}
