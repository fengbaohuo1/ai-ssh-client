import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  busy?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** 轻量输入弹窗（新建目录 / 重命名），避免使用原生 prompt */
export default function PromptDialog({
  open,
  title,
  label,
  placeholder,
  defaultValue = "",
  confirmText = "确定",
  busy = false,
  onSubmit,
  onClose,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const timer = window.setTimeout(() => inputRef.current?.select(), 30);
      return () => window.clearTimeout(timer);
    }
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[380px] max-w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl">
        <div className="px-5 py-3 border-b border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)]">
          {title}
        </div>
        <div className="px-5 py-4 space-y-2">
          {label ? (
            <label className="block text-[11px] text-[var(--text-secondary)]">{label}</label>
          ) : null}
          <input
            ref={inputRef}
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="w-full rounded-md bg-[var(--surface-input)] px-3 py-2 text-xs text-[var(--text-primary)]
                       outline-none border border-transparent focus:border-[var(--border-focus)]
                       placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
          <button
            onClick={onClose}
            className="rounded-md px-3.5 py-1.5 text-xs text-[var(--text-primary)] bg-[var(--surface-input)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!value.trim() || busy}
            className="rounded-md px-3.5 py-1.5 text-xs font-medium text-[var(--accent-text)] bg-[var(--accent-bg)]
                       hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "处理中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
