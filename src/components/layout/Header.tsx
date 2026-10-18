import { useLayoutStore } from "../../stores/layoutStore";
import { useSshState, useSshDispatch } from "../../contexts/SshContext";
import { toast } from "../../stores/toastStore";

export default function Header() {
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const toggleRight = useLayoutStore((s) => s.toggleRightSidebar);
  const setLeftView = useLayoutStore((s) => s.setLeftSidebarView);
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);
  const rightVisible = useLayoutStore((s) => s.rightSidebarVisible);
  const { activeConnectionId, servers } = useSshState();
  const sshDispatch = useSshDispatch();

  const activeServer = servers.find((s) => s.id === activeConnectionId);

  const openFiles = () => {
    if (servers.length === 0) {
      toast.info("请先添加服务器", "添加并连接后可浏览远程文件");
      return;
    }
    setLeftView("files");
  };

  return (
    <header className="flex h-11 shrink-0 select-none items-center gap-2.5 border-b border-[var(--border-default)] bg-[var(--header-bg)] px-3">
      <button
        onClick={toggleLeft}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--activity-bar-text)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--activity-bar-hover)]"
        title={leftVisible ? "隐藏侧边栏" : "显示侧边栏"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="1.5" />
          <line x1="5.5" y1="2" x2="5.5" y2="14" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: "var(--accent-gradient)", boxShadow: "var(--shadow-sm)" }}
        >
          AI
        </div>
        <div className="leading-none">
          <div className="text-xs font-semibold tracking-tight text-[var(--header-text)]">AI SSH</div>
          <div className="mt-0.5 text-[9px] text-[var(--text-tertiary)]">智能运维平台</div>
        </div>
      </div>

      {/* Center: AI binding status */}
      <div className="flex flex-1 items-center justify-center gap-3">
        {activeServer ? (
          <button
            onClick={openFiles}
            className="flex max-w-[420px] items-center gap-1.5 rounded-md border border-[var(--accent-bg)]/30 bg-[var(--accent-bg)]/10 px-2.5 py-1 text-[11px] text-[var(--accent-bg)] hover:bg-[var(--accent-bg)]/15"
            title="在左侧打开该服务器的文件树"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-success)]" />
            <span className="text-[var(--text-tertiary)]">AI →</span>
            <span className="truncate font-mono">
              {activeServer.username}@{activeServer.host}
            </span>
            {activeServer.groupName ? (
              <span className="rounded bg-[var(--surface-input)] px-1 py-0.5 text-[9px] text-[var(--text-tertiary)]">
                {activeServer.groupName}
              </span>
            ) : null}
          </button>
        ) : (
          <span className="text-[11px] text-[var(--text-tertiary)]">在右侧 AI 面板顶部选择目标服务器</span>
        )}
      </div>

      <button
        onClick={openFiles}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        title="远程文件管理"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
        <span>文件</span>
      </button>
      <button
        onClick={() => sshDispatch({ type: "OPEN_ADD_DIALOG" })}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        title="添加 SSH 服务器"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>添加连接</span>
      </button>

      <div className="h-4 w-px bg-[var(--border-default)]" />

      <button
        onClick={toggleRight}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-all ${
          rightVisible
            ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        }`}
        title={rightVisible ? "隐藏 AI 面板" : "显示 AI 面板"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>AI 助手</span>
      </button>
    </header>
  );
}
