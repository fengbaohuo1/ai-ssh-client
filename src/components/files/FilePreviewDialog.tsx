import { useCallback, useEffect, useState } from "react";
import { previewFile, writeFile, type SftpPreview } from "../../api/files";
import { toast } from "../../stores/toastStore";
import FileIcon from "./FileIcon";
import { baseName, formatBytes } from "./fileUtils";

interface Props {
  connectionId: string;
  /** null = 关闭；有值 = 打开对应文件 */
  path: string | null;
  onClose: () => void;
  onSaved?: (path: string) => void;
}

/**
 * 远程文本文件预览/编辑弹窗。
 *
 * <p>被文件树、左侧文件视图、文件管理器共用，避免三处各写一套加载与保存逻辑。
 * 二进制文件只展示提示；编辑保存后重新拉取远端内容，防止展示旧内容。
 */
export default function FilePreviewDialog({ connectionId, path, onClose, onSaved }: Props) {
  const [preview, setPreview] = useState<SftpPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await previewFile(connectionId, target);
        if (res.code === "0000" && res.data) {
          setPreview(res.data);
          setContent(res.data.content);
          setEditing(false);
        } else {
          setError(res.info || "预览失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [connectionId]
  );

  useEffect(() => {
    if (!path) {
      setPreview(null);
      setEditing(false);
      setError(null);
      return;
    }
    void load(path);
  }, [path, load]);

  useEffect(() => {
    if (!path) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (editing) setEditing(false);
      else onClose();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [path, editing, onClose]);

  const save = useCallback(async () => {
    if (!path || !preview) return;
    setSaving(true);
    try {
      const res = await writeFile(connectionId, path, content);
      if (res.code === "0000") {
        toast.success("文件已保存", path);
        setEditing(false);
        await load(path);
        onSaved?.(path);
      } else {
        toast.error("保存失败", res.info);
      }
    } catch (err) {
      toast.error("保存失败", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [path, preview, content, connectionId, load, onSaved]);

  if (!path) return null;

  const canEdit = preview !== null && !preview.binary && !error;
  const isTruncated = preview?.truncated ?? false;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-[80vh] w-[min(920px,92vw)] flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-4">
          <FileIcon type="file" name={baseName(path)} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[11px] text-[var(--text-primary)]" title={path}>
              {path}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {loading
                ? "加载中…"
                : preview
                  ? `${formatBytes(preview.size)}${isTruncated ? " · 已截断" : ""}${preview.binary ? " · 二进制" : " · UTF-8"}`
                  : ""}
            </div>
          </div>
          {canEdit ? (
            editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md bg-[var(--surface-input)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  取消
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-md bg-[var(--accent-bg)] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                disabled={isTruncated}
                title={isTruncated ? "文件超过预览上限，编辑会丢失截断内容，已禁用" : "编辑并保存回远程文件"}
                className="rounded-md bg-[var(--surface-input)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
              >
                编辑
              </button>
            )
          ) : null}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            title="关闭 (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--surface-app)]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-xs text-[var(--status-error)]">预览失败</p>
              <p className="break-all text-[11px] text-[var(--text-tertiary)]">{error}</p>
              <button
                onClick={() => void load(path)}
                className="mt-1 rounded-md bg-[var(--surface-input)] px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                重试
              </button>
            </div>
          ) : !preview ? (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-tertiary)]">无内容</div>
          ) : preview.binary ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <FileIcon type="file" name={baseName(path)} size={28} />
              <p className="text-xs text-[var(--text-secondary)]">二进制文件不支持在线预览</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">请使用下载功能在本地打开</p>
            </div>
          ) : editing ? (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none bg-[var(--surface-app)] p-4 font-mono text-[11px] leading-relaxed text-[var(--text-primary)] outline-none"
            />
          ) : (
            <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
              {preview.content}
            </pre>
          )}
        </div>

        <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--border-default)] px-4 text-[10px] text-[var(--text-tertiary)]">
          <span className="truncate">{path}</span>
          <span>{editing ? "编辑中 · Esc 取消" : "Esc 关闭"}</span>
        </div>
      </div>
    </div>
  );
}
