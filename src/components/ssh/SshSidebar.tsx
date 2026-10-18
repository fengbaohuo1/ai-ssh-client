import SshToolbar from "./SshToolbar";
import SshServerList from "./SshServerList";
import SshServerDialog from "./SshServerDialog";
import { useSshState } from "../../contexts/SshContext";

export default function SshSidebar() {
  const { servers } = useSshState();
  const favorites = servers.filter((s) => s.favorite).length;

  return (
    <div className="flex h-full flex-col border-r border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-[var(--border-default)] px-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          SSH 服务器
        </h2>
        <div className="flex items-center gap-1.5">
          {favorites > 0 ? (
            <span className="rounded bg-[var(--surface-input)] px-1.5 py-0.5 text-[9px] text-[var(--status-warning)]" title="收藏数量">
              ★ {favorites}
            </span>
          ) : null}
          <span className="rounded bg-[var(--surface-input)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-tertiary)]" title="连接总数">
            {servers.length}
          </span>
        </div>
      </div>

      <SshToolbar />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <SshServerList />
      </div>

      <div className="shrink-0 border-t border-[var(--border-default)] px-3 py-1.5 text-[9px] text-[var(--text-tertiary)]">
        双击连接 · 右键文件管理 / 编辑 / 收藏
      </div>

      <SshServerDialog />
    </div>
  );
}
