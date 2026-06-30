import { useThemeStore } from "../../stores/themeStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-xl shadow-2xl
                    w-[380px] animate-[dialog-in_0.15s_ease-out]"
        style={{ animation: "dialog-in 0.15s ease-out" }}
      >
        <style>{`
          @keyframes dialog-in {
            from { opacity: 0; transform: scale(0.96) translateY(-8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-default)]">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">设置</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)]
                       hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Theme */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-[0.04em]">
              主题
            </label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setTheme(theme)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs transition-all duration-150 ${
                    currentTheme === theme
                      ? "bg-[var(--surface-active)] border-[var(--accent-bg)] text-[var(--text-primary)]"
                      : "bg-[var(--surface-input)] border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {/* Theme icon */}
                  {theme === "dark" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                  {theme === "dark" ? "深色" : "浅色"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
