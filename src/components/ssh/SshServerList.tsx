import { useMemo, useState } from "react";
import { useSshState } from "../../contexts/SshContext";
import SshServerItem from "./SshServerItem";
import type { SshServer } from "../../types";

function matches(server: SshServer, filter: string): boolean {
  if (!filter) return true;
  const lower = filter.toLowerCase();
  return (
    server.name.toLowerCase().includes(lower) ||
    server.host.toLowerCase().includes(lower) ||
    server.username.toLowerCase().includes(lower) ||
    (server.groupName ?? "").toLowerCase().includes(lower) ||
    (server.tags ?? []).some((tag) => tag.toLowerCase().includes(lower)) ||
    (server.remark ?? "").toLowerCase().includes(lower)
  );
}

function GroupHeader({
  label,
  count,
  collapsed,
  onToggle,
  favorite,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  favorite?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 border-b border-[var(--border-subtle)]/60 bg-[var(--surface-panel)] px-3 py-1.5 text-left
                 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]/60"
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
      >
        <polyline points="6,9 12,15 18,9" />
      </svg>
      {favorite ? <span className="text-[var(--status-warning)]">★</span> : null}
      <span className="truncate">{label}</span>
      <span className="ml-auto rounded bg-[var(--surface-input)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-tertiary)]">
        {count}
      </span>
    </button>
  );
}

/** 服务器列表：收藏置顶 + 分组折叠 + 搜索 */
export default function SshServerList() {
  const { servers, filterText, loading, error } = useSshState();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => servers.filter((server) => matches(server, filterText)),
    [servers, filterText]
  );

  const favorites = useMemo(() => filtered.filter((s) => s.favorite), [filtered]);
  const grouped = useMemo(() => {
    const map = new Map<string, SshServer[]>();
    for (const server of filtered) {
      if (server.favorite) continue;
      const group = server.groupName?.trim() || "未分组";
      const list = map.get(group) ?? [];
      list.push(server);
      map.set(group, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "未分组") return 1;
      if (b[0] === "未分组") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center select-none">
        <p className="mb-1 text-xs text-[var(--status-error)]">加载失败</p>
        <p className="text-[11px] break-all text-[var(--text-tertiary)]">{error}</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center select-none">
        {servers.length === 0 ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-input)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--text-secondary)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="6" cy="18" r="1" />
              </svg>
            </div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">暂无服务器</p>
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
      {favorites.length > 0 ? (
        <section>
          <GroupHeader
            label="收藏"
            count={favorites.length}
            favorite
            collapsed={collapsed["__favorites__"] === true}
            onToggle={() => setCollapsed((s) => ({ ...s, __favorites__: !s["__favorites__"] }))}
          />
          {collapsed["__favorites__"] !== true
            ? favorites.map((server) => <SshServerItem key={server.id} server={server} />)
            : null}
        </section>
      ) : null}

      {grouped.map(([group, list]) => (
        <section key={group}>
          <GroupHeader
            label={group}
            count={list.length}
            collapsed={collapsed[group] === true}
            onToggle={() => setCollapsed((s) => ({ ...s, [group]: !s[group] }))}
          />
          {collapsed[group] !== true
            ? list.map((server) => <SshServerItem key={server.id} server={server} />)
            : null}
        </section>
      ))}
    </div>
  );
}
