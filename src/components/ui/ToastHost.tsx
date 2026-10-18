import { useToastStore, type ToastKind } from "../../stores/toastStore";

const ICONS: Record<ToastKind, string> = {
  success: "M20 6 9 17l-5-5",
  error: "M18 6 6 18M6 6l12 12",
  warning: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

const TONE: Record<ToastKind, { border: string; icon: string; bg: string }> = {
  success: { border: "var(--status-success)", icon: "var(--status-success)", bg: "color-mix(in srgb, var(--status-success) 12%, transparent)" },
  error: { border: "var(--status-error)", icon: "var(--status-error)", bg: "color-mix(in srgb, var(--status-error) 12%, transparent)" },
  warning: { border: "var(--status-warning)", icon: "var(--status-warning)", bg: "color-mix(in srgb, var(--status-warning) 12%, transparent)" },
  info: { border: "var(--status-info)", icon: "var(--status-info)", bg: "color-mix(in srgb, var(--status-info) 12%, transparent)" },
};

/** 全局轻提示：右下角堆叠，带进度条与关闭按钮 */
export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-[120] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((item) => {
        const tone = TONE[item.kind];
        return (
          <div
            key={item.id}
            className="pointer-events-auto relative flex gap-2.5 items-start rounded-lg border border-[var(--border-default)]
                       bg-[var(--surface-dropdown)] shadow-2xl px-3.5 py-3 overflow-hidden animate-[toast-in_0.18s_ease-out]"
            style={{ borderLeft: `3px solid ${tone.border}` }}
            role="status"
          >
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 mt-0.5"
              style={{ background: tone.bg, color: tone.icon }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[item.kind]} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] break-words">{item.title}</div>
              {item.message ? (
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 break-words leading-relaxed">{item.message}</div>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mt-0.5"
              title="关闭"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
