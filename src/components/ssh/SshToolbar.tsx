import { useSshState, useSshDispatch } from "../../contexts/SshContext";

export default function SshToolbar() {
  const { filterText } = useSshState();
  const dispatch = useSshDispatch();

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
      {/* Search */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={filterText}
          onChange={(e) => dispatch({ type: "SET_FILTER", text: e.target.value })}
          placeholder="搜索服务器..."
          className="w-full bg-[var(--surface-input)] text-[var(--text-primary)] text-xs rounded-md
                     px-2.5 py-1.5 outline-none
                     border border-transparent focus:border-[var(--border-focus)]
                     placeholder:text-[var(--text-tertiary)] transition-colors duration-150"
        />
        {filterText && (
          <button
            onClick={() => dispatch({ type: "SET_FILTER", text: "" })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center
                       w-4 h-4 rounded-sm text-[var(--text-secondary)]
                       hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => dispatch({ type: "OPEN_ADD_DIALOG" })}
        className="flex items-center justify-center w-7 h-7 rounded-md
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                   hover:bg-[var(--surface-hover)] transition-all duration-150"
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
