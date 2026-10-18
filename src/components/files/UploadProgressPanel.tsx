import type { UploadProgress } from "./dndUpload";

/** 上传进度条：文件名 + x/y + 当前文件百分比 */
export default function UploadProgressPanel({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const active = progress.done < progress.total ? progress.filePercent : 0;
  const percent = progress.total > 0
    ? Math.min(1, (progress.done + active) / progress.total)
    : 0;

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--surface-input)]/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="min-w-0 truncate text-[var(--text-secondary)]">
          上传到 <span className="font-mono text-[var(--text-primary)]">{progress.destDir}</span>
        </span>
        <span className="shrink-0 font-mono text-[var(--text-tertiary)]">
          {progress.done}/{progress.total}
          {progress.failed > 0 ? ` · 失败 ${progress.failed}` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-panel)]">
        <div
          className="h-full rounded-full bg-[var(--accent-bg)] transition-[width] duration-200"
          style={{ width: `${Math.round(percent * 100)}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--text-tertiary)]">
        <span className="truncate font-mono">{progress.current || "完成"}</span>
        <span className="shrink-0">{Math.round(percent * 100)}%</span>
      </div>
    </div>
  );
}
