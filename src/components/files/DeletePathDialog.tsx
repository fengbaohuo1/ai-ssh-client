import { useEffect, useState } from "react";
import type { SftpFile } from "../../api/files";

interface Props {
  /** null = 关闭 */
  file: SftpFile | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (recursive: boolean) => void;
}

/**
 * 删除确认弹窗（文件树 / 文件管理器共用）。
 *
 * <p>目录默认非递归删除，避免误删整棵目录；需要递归时必须显式勾选。
 */
export default function DeletePathDialog({ file, busy, onClose, onConfirm }: Props) {
  const [recursive, setRecursive] = useState(false);

  useEffect(() => {
    setRecursive(false);
  }, [file?.path]);

  useEffect(() => {
    if (!file) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [file, busy, onClose]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="relative w-[400px] max-w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl">
        <div className="border-b border-[var(--border-default)] px-5 py-3 text-sm font-medium text-[var(--text-primary)]">
          确认删除
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="break-all font-mono text-[11px] text-[var(--text-primary)]">{file.path}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {file.type === "dir" ? "将删除该目录" : "将删除该文件"}，此操作不可撤销。
          </p>
          {file.type === "dir" ? (
            <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(event) => setRecursive(event.target.checked)}
                className="accent-[var(--status-error)]"
              />
              递归删除目录内全部内容
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md bg-[var(--surface-input)] px-3.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(recursive)}
            disabled={busy}
            className="rounded-md bg-[var(--status-error)] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "删除中…" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
