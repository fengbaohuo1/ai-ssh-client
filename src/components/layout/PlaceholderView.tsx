interface Props {
  title: string;
  icon: string;
  description: string;
  onClose: () => void;
}

function PlaceholderIcon({ icon }: { icon: string }) {
  // Map emoji→SVG for clean rendering
  if (icon === "📁") {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           className="text-[var(--text-tertiary)]" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
      </svg>
    );
  }
  if (icon === "📤") {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           className="text-[var(--text-tertiary)]" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h11l1.5 2H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        <polyline points="8,14 12,10 16,14" />
        <line x1="12" y1="10" x2="12" y2="18" />
      </svg>
    );
  }
  return <span className="text-3xl opacity-40">{icon}</span>;
}

export default function PlaceholderView({ title, icon, description, onClose }: Props) {
  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-default)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)]
                     hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors text-sm"
          title="关闭面板"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Placeholder content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-input)] flex items-center justify-center mb-4">
          <PlaceholderIcon icon={icon} />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
    </div>
  );
}
