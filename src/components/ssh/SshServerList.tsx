import { useSshState } from "../../contexts/SshContext";
import SshServerItem from "./SshServerItem";

export default function SshServerList() {
  const { servers, filterText, loading, error } = useSshState();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
        <p className="text-xs text-[var(--status-error)] mb-1">加载失败</p>
        <p className="text-[11px] text-[var(--text-tertiary)]">{error}</p>
      </div>
    );
  }

  const filtered = servers.filter((s) => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return (
      s.name.toLowerCase().includes(lower) ||
      s.host.toLowerCase().includes(lower) ||
      s.username.toLowerCase().includes(lower)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
        {servers.length === 0 ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-input)] flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   className="text-[var(--text-secondary)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="6" cy="18" r="1" />
              </svg>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">暂无服务器</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">点击上方 + 添加 SSH 连接</p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">无匹配结果</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-0.5">
      {filtered.map((server) => (
        <SshServerItem key={server.id} server={server} />
      ))}
    </div>
  );
}
