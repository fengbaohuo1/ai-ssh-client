import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";
import { toast } from "../../stores/toastStore";
import {
  listFiles,
  mkdir,
  renamePath,
  deletePath,
  downloadFile,
  type SftpFile,
  type SftpList,
} from "../../api/files";
import PromptDialog from "../ui/PromptDialog";
import FileIcon from "./FileIcon";
import FileTree, { type FileTreeHandle } from "./FileTree";
import FilePreviewDialog from "./FilePreviewDialog";
import DeletePathDialog from "./DeletePathDialog";
import UploadProgressPanel from "./UploadProgressPanel";
import { useDroppedUpload } from "./dndUpload";
import {
  formatBytes,
  formatTime,
  hasFileDrag,
  hasRemoteDrag,
  isSameOrDescendant,
  joinPath,
  moveDestination,
  parentOf,
  pathAfterMove,
  readRemoteDrag,
  REMOTE_DRAG_MIME,
  samePath,
  validateMove,
} from "./fileUtils";

type PromptState =
  | { mode: "mkdir" }
  | { mode: "rename"; file: SftpFile }
  | null;

/**
 * 远程文件管理器——IDE 布局：左侧文件树、右侧目录列表。
 *
 * <p>能力：树/列表双浏览、面包屑、预览编辑、上传（含文件夹与拖拽）、下载、
 * 新建、重命名、递归删除。所有路径安全与限额由后端 `IFileSystemService` 兜底。
 */
export default function FileExplorer() {
  const target = useFileExplorerStore((s) => s.target);
  const close = useFileExplorerStore((s) => s.close);

  const [path, setPath] = useState(".");
  const [pathDraft, setPathDraft] = useState(".");
  const [dir, setDir] = useState<SftpList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SftpFile | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dropKind, setDropKind] = useState<"copy" | "move">("copy");
  const [dropRow, setDropRow] = useState<string | null>(null);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<FileTreeHandle>(null);
  const loadSeq = useRef(0);

  const currentDir = dir?.path || path;

  const load = useCallback(
    async (targetPath: string) => {
      if (!target) return;
      const seq = ++loadSeq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await listFiles(target.connectionId, targetPath);
        if (seq !== loadSeq.current) return;
        if (res.code === "0000" && res.data) {
          setDir(res.data);
          setPathDraft(res.data.path);
        } else {
          setError(res.info || "列目录失败");
        }
      } catch (err) {
        if (seq !== loadSeq.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [target]
  );

  // 打开时重置到目标目录
  useEffect(() => {
    if (!target) {
      setDir(null);
      setPreviewPath(null);
      return;
    }
    const initial = target.initialPath || ".";
    setPath(initial);
    setPathDraft(initial);
    setFilter("");
    setPreviewPath(null);
    void load(initial);
  }, [target, load]);

  const navigate = useCallback(
    (next: string) => {
      setPath(next);
      setPathDraft(next);
      void load(next);
    },
    [load]
  );

  const refresh = useCallback(() => {
    void load(currentDir);
  }, [currentDir, load]);

  const { progress, startFiles, startDrop } = useDroppedUpload(target?.connectionId, {
    onUploaded: (destDir) => {
      treeRef.current?.refresh(destDir);
      if (samePath(destDir, currentDir)) void load(currentDir);
    },
  });

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const visibleFiles = useMemo(() => {
    if (!dir) return [];
    return dir.files.filter((file) => {
      if (!showHidden && file.hidden) return false;
      if (!filter) return true;
      return file.name.toLowerCase().includes(filter.toLowerCase());
    });
  }, [dir, showHidden, filter]);

  const crumbs = useMemo(() => {
    if (!dir) return [];
    const current = dir.path;
    if (current.startsWith("/")) {
      const parts = current.split("/").filter(Boolean);
      const list: { label: string; path: string }[] = [{ label: "/", path: "/" }];
      let acc = "";
      for (const part of parts) {
        acc += `/${part}`;
        list.push({ label: part, path: acc });
      }
      return list;
    }
    if (current === ".") return [{ label: "~", path: "." }];
    return current.split("/").filter(Boolean).map((part, index, arr) => ({
      label: part,
      path: arr.slice(0, index + 1).join("/"),
    }));
  }, [dir]);

  const openItem = useCallback(
    (file: SftpFile) => {
      if (file.type === "dir") {
        navigate(file.path);
        return;
      }
      setPreviewPath(file.path);
    },
    [navigate]
  );

  const handleUpload = useCallback(
    (files: FileList | null) => {
      if (!target || !files || files.length === 0) return;
      startFiles(files, currentDir);
    },
    [target, currentDir, startFiles]
  );

  const handleDownload = useCallback(
    async (file: SftpFile) => {
      if (!target) return;
      try {
        const name = await downloadFile(target.connectionId, file.path);
        toast.success("开始下载", name);
      } catch (err) {
        toast.error("下载失败", err instanceof Error ? err.message : String(err));
      }
    },
    [target]
  );

  /** 拖动移动：改名/移动都复用 rename 接口，后端负责目标存在与自身子目录校验 */
  const handleMove = useCallback(
    async (sourcePath: string, destDir: string) => {
      if (!target) return;
      const invalid = validateMove(sourcePath, destDir);
      if (invalid) {
        toast.info(invalid, sourcePath);
        return;
      }
      const destination = moveDestination(sourcePath, destDir);
      try {
        const res = await renamePath(target.connectionId, sourcePath, destination);
        if (res.code === "0000") {
          toast.success("移动成功", `${sourcePath} → ${destination}`);
          const sourceParent = parentOf(sourcePath) ?? ".";
          treeRef.current?.refresh(sourceParent);
          treeRef.current?.refresh(destDir);
          const movedCurrent = pathAfterMove(sourcePath, destination, currentDir);
          if (movedCurrent) {
            if (previewPath && isSameOrDescendant(sourcePath, previewPath)) {
              setPreviewPath(pathAfterMove(sourcePath, destination, previewPath));
            }
            navigate(movedCurrent);
          } else if (samePath(currentDir, sourceParent) || samePath(currentDir, destDir)) {
            refresh();
          }
        } else {
          toast.error("移动失败", res.info);
        }
      } catch (err) {
        toast.error("移动失败", err instanceof Error ? err.message : String(err));
      }
    },
    [target, currentDir, navigate, refresh, previewPath]
  );

  const submitPrompt = useCallback(
    async (value: string) => {
      if (!target || !prompt) return;
      setPromptBusy(true);
      try {
        const base = currentDir;
        const destination = joinPath(base, value);
        const res = prompt.mode === "mkdir"
          ? await mkdir(target.connectionId, destination)
          : await renamePath(target.connectionId, prompt.file.path, destination);
        if (res.code === "0000") {
          toast.success(prompt.mode === "mkdir" ? "目录已创建" : "重命名成功", destination);
          setPrompt(null);
          treeRef.current?.refresh(base);
          if (prompt.mode === "mkdir") {
            navigate(destination);
          } else {
            refresh();
          }
        } else {
          toast.error(prompt.mode === "mkdir" ? "创建目录失败" : "重命名失败", res.info);
        }
      } catch (err) {
        toast.error("操作失败", err instanceof Error ? err.message : String(err));
      } finally {
        setPromptBusy(false);
      }
    },
    [target, prompt, currentDir, refresh, navigate]
  );

  const confirmDelete = useCallback(
    async (recursive: boolean) => {
      if (!target || !deleteTarget) return;
      setDeleteBusy(true);
      try {
        const deletedPath = deleteTarget.path;
        const res = await deletePath(target.connectionId, deletedPath, recursive);
        if (res.code === "0000") {
          toast.success("已删除", deletedPath);
          setDeleteTarget(null);
          if (previewPath && isSameOrDescendant(deletedPath, previewPath)) {
            setPreviewPath(null);
          }
          treeRef.current?.refresh(parentOf(deletedPath) ?? ".");
          if (isSameOrDescendant(deletedPath, currentDir)) {
            navigate(parentOf(deletedPath) ?? ".");
          } else {
            refresh();
          }
        } else {
          toast.error("删除失败", res.info);
        }
      } catch (err) {
        toast.error("删除失败", err instanceof Error ? err.message : String(err));
      } finally {
        setDeleteBusy(false);
      }
    },
    [target, deleteTarget, previewPath, currentDir, navigate, refresh]
  );

  // ESC：优先关预览/弹窗，最后关文件管理器
  useEffect(() => {
    if (!target) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (previewPath) return; // 预览弹窗自己处理 Esc
      if (deleteTarget) setDeleteTarget(null);
      else if (prompt) setPrompt(null);
      else close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, previewPath, deleteTarget, prompt, close]);

  const sectionDragEnter = useCallback((event: React.DragEvent) => {
    const files = hasFileDrag(event.dataTransfer);
    const remote = hasRemoteDrag(event.dataTransfer);
    if (!files && !remote) return;
    event.preventDefault();
    setDropKind(files ? "copy" : "move");
    setDropActive(true);
  }, []);

  const sectionDragOver = useCallback((event: React.DragEvent) => {
    const files = hasFileDrag(event.dataTransfer);
    const remote = hasRemoteDrag(event.dataTransfer);
    if (!files && !remote) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = files ? "copy" : "move";
  }, []);

  const sectionDragLeave = useCallback((event: React.DragEvent) => {
    if (!hasFileDrag(event.dataTransfer) && !hasRemoteDrag(event.dataTransfer)) return;
    // 只有真正离开右侧面板才熄灭遮罩，避免子元素之间移动时闪烁
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropActive(false);
    }
  }, []);

  const sectionDrop = useCallback(
    (event: React.DragEvent) => {
      const files = hasFileDrag(event.dataTransfer);
      const remote = hasRemoteDrag(event.dataTransfer);
      if (!files && !remote) return;
      event.preventDefault();
      setDropActive(false);
      if (files) {
        startDrop(event.dataTransfer, currentDir);
        return;
      }
      const sourcePath = readRemoteDrag(event.dataTransfer);
      if (sourcePath) void handleMove(sourcePath, currentDir);
    },
    [currentDir, startDrop, handleMove]
  );

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={close} />

      <div className="relative flex h-[86vh] w-[min(1280px,96vw)] flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-default)] px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--surface-input)] text-[var(--accent-bg)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-[var(--text-primary)]">文件管理</div>
            <div className="truncate text-[10px] text-[var(--text-tertiary)]">
              {target.serverName} · SFTP · 拖拽本地文件上传 / 拖动节点移动 / 右键删除
            </div>
          </div>
          <span className="hidden rounded bg-[var(--surface-input)] px-1.5 py-0.5 text-[9px] text-[var(--text-tertiary)] sm:inline">
            IDE 视图
          </span>
          <button
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            title="关闭 (Esc)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 左侧文件树 */}
          <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--surface-panel)]">
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                文件树
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => treeRef.current?.refresh()}
                  title="刷新文件树"
                  className="tree-tool-btn"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23,4 23,10 17,10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <FileTree
                ref={treeRef}
                connectionId={target.connectionId}
                activePath={currentDir}
                showHidden={showHidden}
                filter={filter}
                className="scrollbar-thin px-0.5"
                onDirectoryChange={navigate}
                onOpenFile={(file) => setPreviewPath(file.path)}
                onDownload={(file) => void handleDownload(file)}
                onDelete={setDeleteTarget}
                onMove={(sourcePath, destDir) => void handleMove(sourcePath, destDir)}
                onDropFiles={(destDir, dataTransfer) => startDrop(dataTransfer, destDir)}
              />
            </div>
            <div className="shrink-0 border-t border-[var(--border-subtle)] px-2.5 py-1.5 text-[9px] leading-relaxed text-[var(--text-tertiary)]">
              单击目录切换 · 双击文件预览 · 右键删除
              <br />
              拖动节点到目录 = 移动；拖入本地文件 = 上传
            </div>
          </aside>

          {/* 右侧：工具栏 + 列表 */}
          <section
            className="relative flex min-w-0 flex-1 flex-col"
            onDragEnter={sectionDragEnter}
            onDragOver={sectionDragOver}
            onDragLeave={sectionDragLeave}
            onDrop={sectionDrop}
          >
            {/* Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2">
              <button onClick={() => navigate(".")} title="用户主目录" className="tool-btn">~</button>
              <button
                onClick={() => dir?.parent && navigate(dir.parent)}
                disabled={!dir?.parent}
                title="上级目录"
                className="tool-btn disabled:opacity-30"
              >
                ↑
              </button>
              <button onClick={refresh} title="刷新" className="tool-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23,4 23,10 17,10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>

              <form
                className="relative min-w-[160px] flex-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate(pathDraft.trim() || ".");
                }}
              >
                <input
                  value={pathDraft}
                  onChange={(event) => setPathDraft(event.target.value)}
                  spellCheck={false}
                  className="w-full rounded-md border border-transparent bg-[var(--surface-input)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
                  placeholder="输入远程路径后回车"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  Go
                </button>
              </form>

              <button onClick={() => setPrompt({ mode: "mkdir" })} title="新建目录" className="tool-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <line x1="12" y1="11" x2="12" y2="16" />
                  <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" />
                </svg>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title={`上传文件到 ${currentDir}`}
                className="tool-btn"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                title={`上传文件夹到 ${currentDir}`}
                className="tool-btn"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <line x1="12" y1="10.5" x2="12" y2="15.5" />
                  <polyline points="9.5,13 12,10.5 14.5,13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleUpload(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleUpload(event.target.files);
                  event.target.value = "";
                }}
              />

              <div className="mx-1 h-4 w-px bg-[var(--border-default)]" />

              <button
                onClick={() => setShowHidden((value) => !value)}
                className={`tool-btn ${showHidden ? "bg-[var(--surface-active)] text-[var(--text-primary)]" : ""}`}
                title={showHidden ? "隐藏点文件" : "显示点文件"}
              >
                {showHidden ? "◉" : "○"}
              </button>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="过滤当前目录…"
                className="w-[120px] rounded-md border border-transparent bg-[var(--surface-input)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
              />
            </div>

            {/* Breadcrumb */}
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-3 py-1.5 text-[11px]">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb.path}-${index}`} className="flex shrink-0 items-center gap-1">
                  {index > 0 ? <span className="text-[var(--text-tertiary)]">/</span> : null}
                  <button
                    onClick={() => navigate(crumb.path)}
                    className="rounded px-1 py-0.5 font-mono text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    {crumb.label}
                  </button>
                </span>
              ))}
              {dir ? (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--text-tertiary)]">
                  {dir.total} 项{dir.truncated ? "（已截断）" : ""}
                </span>
              ) : null}
            </div>

            {/* Table head */}
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_90px_140px_110px_88px] items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-input)]/40 px-4 py-1.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
              <span>名称</span>
              <span className="text-right">大小</span>
              <span>修改时间</span>
              <span>权限</span>
              <span className="text-right">操作</span>
            </div>

            {/* List */}
            <div className="relative min-h-0 flex-1 overflow-y-auto">
              {loading && !dir ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-xs text-[var(--status-error)]">目录加载失败</p>
                  <p className="break-all text-[11px] text-[var(--text-tertiary)]">{error}</p>
                  <button onClick={refresh} className="mt-1 rounded-md bg-[var(--surface-input)] px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
                    重试
                  </button>
                </div>
              ) : visibleFiles.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <p className="text-xs text-[var(--text-secondary)]">{filter ? "没有匹配项" : "空目录"}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">拖入本地文件或点击上传按钮添加文件</p>
                </div>
              ) : (
                <div className="py-0.5">
                  {visibleFiles.map((file) => (
                    <div
                      key={file.path}
                      data-file-path={file.path}
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.setData(REMOTE_DRAG_MIME, file.path);
                        event.dataTransfer.setData("text/plain", file.path);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingPath(file.path);
                      }}
                      onDragEnd={() => {
                        setDraggingPath(null);
                        setDropRow(null);
                      }}
                      onDragEnter={(event) => {
                        if (file.type !== "dir") return;
                        const files = hasFileDrag(event.dataTransfer);
                        const remote = hasRemoteDrag(event.dataTransfer);
                        if (!files && !remote) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDropRow(file.path);
                      }}
                      onDragOver={(event) => {
                        if (file.type !== "dir") return;
                        const files = hasFileDrag(event.dataTransfer);
                        const remote = hasRemoteDrag(event.dataTransfer);
                        if (!files && !remote) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = files ? "copy" : "move";
                        setDropRow(file.path);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setDropRow((prev) => (prev === file.path ? null : prev));
                        }
                      }}
                      onDrop={(event) => {
                        if (file.type !== "dir") return;
                        const files = hasFileDrag(event.dataTransfer);
                        const remote = hasRemoteDrag(event.dataTransfer);
                        if (!files && !remote) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDropRow(null);
                        setDropActive(false);
                        if (files) {
                          startDrop(event.dataTransfer, file.path);
                          return;
                        }
                        const sourcePath = readRemoteDrag(event.dataTransfer);
                        if (sourcePath) void handleMove(sourcePath, file.path);
                      }}
                      className={`group grid grid-cols-[minmax(0,1fr)_90px_140px_110px_88px] items-center gap-2 border-b border-[var(--border-subtle)]/60 px-4 py-1.5 hover:bg-[var(--surface-hover)]
                        ${dropRow === file.path ? "bg-[var(--accent-bg)]/10 ring-1 ring-inset ring-[var(--accent-bg)]" : ""}
                        ${draggingPath === file.path ? "opacity-40" : ""}`}
                    >
                      <button
                        onClick={() => openItem(file)}
                        className="flex min-w-0 items-center gap-2 text-left"
                        title={file.linkTarget ? `${file.path} → ${file.linkTarget}` : file.path}
                      >
                        <FileIcon type={file.type} name={file.name} />
                        <span className={`truncate text-xs ${file.hidden ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                          {file.name}
                        </span>
                        {file.type === "link" && file.linkTarget ? (
                          <span className="truncate font-mono text-[10px] text-[var(--status-info)]/80">→ {file.linkTarget}</span>
                        ) : null}
                      </button>
                      <span className="text-right font-mono text-[10px] text-[var(--text-secondary)]">
                        {file.type === "dir" ? "-" : formatBytes(file.size)}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{formatTime(file.modifiedAt)}</span>
                      <span className="truncate font-mono text-[10px] text-[var(--text-tertiary)]" title={file.permissionsText}>
                        {file.permissionsText}
                      </span>
                      <span className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {file.type !== "dir" ? (
                          <button onClick={() => void handleDownload(file)} title="下载" className="row-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7,10 12,15 17,10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        ) : null}
                        <button onClick={() => setPrompt({ mode: "rename", file })} title="重命名" className="row-btn">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(file)}
                          title="删除"
                          className="row-btn hover:!text-[var(--status-error)]"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,6 5,6 21,6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {loading && dir ? (
                <div className="absolute right-3 top-2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
              ) : null}

              {dropActive ? (
                <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--accent-bg)] bg-[var(--surface-panel)]/90">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-bg)]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17,8 12,3 7,8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    {dropKind === "move" ? "释放以移动到此目录" : "释放以上传"}
                  </p>
                  <p className="max-w-[80%] truncate font-mono text-[10px] text-[var(--text-tertiary)]">→ {currentDir}</p>
                </div>
              ) : null}
            </div>

            {progress ? (
              <div className="shrink-0 border-t border-[var(--border-subtle)] px-4 py-2">
                <UploadProgressPanel progress={progress} />
              </div>
            ) : null}

            {/* Footer */}
            <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--border-default)] px-4 text-[10px] text-[var(--text-tertiary)]">
              <span className="truncate">{currentDir}</span>
              <span>预览 256 KB · 上传 100 MB · 支持文件夹</span>
            </div>
          </section>
        </div>
      </div>

      {/* 新建 / 重命名 */}
      <PromptDialog
        open={prompt !== null}
        title={prompt?.mode === "rename" ? "重命名" : "新建目录"}
        label={prompt?.mode === "rename" ? `当前名称：${prompt.file.name}` : `当前位置：${currentDir}`}
        placeholder={prompt?.mode === "rename" ? "输入新名称" : "例如 logs、backup"}
        defaultValue={prompt?.mode === "rename" ? prompt.file.name : ""}
        confirmText={prompt?.mode === "rename" ? "重命名" : "创建"}
        busy={promptBusy}
        onSubmit={(value) => void submitPrompt(value)}
        onClose={() => setPrompt(null)}
      />

      {/* 删除确认 */}
      <DeletePathDialog
        file={deleteTarget}
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(recursive) => void confirmDelete(recursive)}
      />

      <FilePreviewDialog
        connectionId={target.connectionId}
        path={previewPath}
        onClose={() => setPreviewPath(null)}
        onSaved={(savedPath) => {
          refresh();
          treeRef.current?.refresh(parentOf(savedPath) ?? ".");
        }}
      />

      <style>{`
        .tool-btn {
          display: inline-flex; align-items: center; justify-content: center;
          height: 26px; min-width: 26px; padding: 0 6px; border-radius: 6px;
          color: var(--text-secondary); font-size: 12px;
          transition: background-color .12s, color .12s;
        }
        .tool-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
        .tree-tool-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 5px; color: var(--text-tertiary);
        }
        .tree-tool-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
        .row-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 5px; color: var(--text-secondary);
        }
        .row-btn:hover { background: var(--surface-input); color: var(--text-primary); }
      `}</style>
    </div>
  );
}
