import { useLayoutStore, type SidebarView } from "../../stores/layoutStore";
import type React from "react";

const views: { id: SidebarView; label: string }[] = [
  { id: "ssh", label: "SSH 服务器" },
  { id: "files", label: "文件浏览" },
  { id: "sftp", label: "SFTP 传输" },
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

const iconMap: Record<SidebarView, React.FC> = {
  ssh: SshIcon,
  files: FilesIcon,
  sftp: SftpIcon,
};

export default function ActivityBar() {
  const activeView = useLayoutStore((s) => s.leftSidebarView);
  const setView = useLayoutStore((s) => s.setLeftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);

  return (
    <div className="w-12 bg-[var(--activity-bar-bg)] flex flex-col items-center py-3 gap-0.5 border-r border-[var(--border-default)] shrink-0">
      {views.map((v) => {
        const isActive = activeView === v.id && leftVisible;
        const Icon = iconMap[v.id];
        return (
          <button
            key={v.id}
            title={v.label}
            onClick={() => {
              if (isActive) {
                toggleLeft();
              } else {
                setView(v.id);
              }
            }}
            className={`relative w-12 h-11 flex items-center justify-center transition-all duration-150
              ${isActive
                ? "text-[var(--activity-bar-active)]"
                : "text-[var(--activity-bar-text)] hover:text-[var(--activity-bar-hover)]"
              }`}
          >
            {/* Left active indicator bar */}
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
