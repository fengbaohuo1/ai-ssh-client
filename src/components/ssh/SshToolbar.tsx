import { useSshState, useSshDispatch, useSshActions } from "../../contexts/SshContext";

export default function SshToolbar() {
  const { filterText, loading } = useSshState();
  const dispatch = useSshDispatch();
  const { fetchServers } = useSshActions();

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-3 py-2">
      <div className="relative flex-1">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          value={filterText}
          onChange={(e) => dispatch({ type: "SET_FILTER", text: e.target.value })}
          placeholder="搜索名称 / 主机 / 分组 / 标签…"
          className="w-full rounded-md border border-transparent bg-[var(--surface-input)] py-1.5 pl-7 pr-6 text-xs text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
        />
        {filterText ? (
          <button
            onClick={() => dispatch({ type: "SET_FILTER", text: "" })}
            className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            title="清空"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>

      <button
        onClick={() => void fetchServers()}
        disabled={loading}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        title="刷新列表"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
          <polyline points="23,4 23,10 17,10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>

      <button
        onClick={() => dispatch({ type: "OPEN_ADD_DIALOG" })}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        title="添加服务器"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
