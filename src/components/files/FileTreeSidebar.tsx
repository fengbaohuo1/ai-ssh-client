import { useCallback, useEffect, useRef, useState } from "react";
import { deletePath, downloadFile, mkdir, renamePath, type SftpFile } from "../../api/files";
import { useSshActions, useSshDispatch, useSshState } from "../../contexts/SshContext";
import { useLayoutStore } from "../../stores/layoutStore";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";
import { toast } from "../../stores/toastStore";
import FileTree, { type FileTreeHandle } from "./FileTree";
import FilePreviewDialog from "./FilePreviewDialog";
import DeletePathDialog from "./DeletePathDialog";
import UploadProgressPanel from "./UploadProgressPanel";
import PromptDialog from "../ui/PromptDialog";
import { useDroppedUpload } from "./dndUpload";
import {
  isSameOrDescendant,
  joinPath,
  moveDestination,
  parentOf,
  pathAfterMove,
  validateMove,
} from "./fileUtils";

function ToolButton({
  title,
  onClick,
  active = false,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-md px-1 text-[11px] transition-colors
        ${active
          ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`}
    >
      {children}
    </button>
  );
}

/**
 * 左侧「远程文件」视图：IDE 风格文件树 + 拖拽上传。
 *
 * <p>和全屏文件管理器共用 `FileTree` / 上传队列 / 预览弹窗；这里承担"常驻浏览"，
 * 复杂写操作可以一键转到文件管理器。
 */
export default function FileTreeSidebar() {
  const { servers, activeConnectionId } = useSshState();
  const sshDispatch = useSshDispatch();
  const { connectServer } = useSshActions();
  const setLeftView = useLayoutStore((s) => s.setLeftSidebarView);
  const openExplorer = useFileExplorerStore((s) => s.open);

  const [serverId, setServerId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState(".");
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState("");
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SftpFile | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const treeRef = useRef<FileTreeHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const selectedServer = servers.find((server) => server.id === serverId) ?? null;
  const connected = selectedServer?.status === 1;

  // 默认跟随 AI 目标服务器；没有目标时取第一台已连接/第一台服务器
  useEffect(() => {
    setServerId((prev) => {
      if (prev && servers.some((server) => server.id === prev)) return prev;
      if (activeConnectionId && servers.some((server) => server.id === activeConnectionId)) {
        return activeConnectionId;
      }
      return servers.find((server) => server.status === 1)?.id ?? servers[0]?.id ?? null;
    });
  }, [servers, activeConnectionId]);

  // AI 目标服务器变化时，文件视图跟随切换
  useEffect(() => {
    if (activeConnectionId && servers.some((server) => server.id === activeConnectionId)) {
      setServerId(activeConnectionId);
    }
  }, [activeConnectionId, servers]);

  useEffect(() => {
    setActivePath(".");
    setPreviewPath(null);
    setFilter("");
  }, [serverId]);

  const { progress, startFiles, startDrop } = useDroppedUpload(serverId, {
    onUploaded: (destDir) => treeRef.current?.refresh(destDir),
  });

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!selectedServer) return;
    const res = await connectServer(selectedServer.id);
    if (res?.code === "0000") {
      treeRef.current?.refresh();
    }
  }, [selectedServer, connectServer]);

  const handleDownload = useCallback(
    async (file: { path: string }) => {
      if (!serverId) return;
      try {
        const name = await downloadFile(serverId, file.path);
        toast.success("开始下载", name);
      } catch (err) {
        toast.error("下载失败", err instanceof Error ? err.message : String(err));
      }
    },
    [serverId]
  );

  const submitMkdir = useCallback(
    async (value: string) => {
      if (!serverId) return;
      setPromptBusy(true);
      try {
        const destination = joinPath(activePath, value);
        const res = await mkdir(serverId, destination);
        if (res.code === "0000") {
          toast.success("目录已创建", destination);
          setPromptOpen(false);
          treeRef.current?.refresh(activePath);
          setActivePath(destination);
        } else {
          toast.error("创建目录失败", res.info);
        }
      } catch (err) {
        toast.error("创建目录失败", err instanceof Error ? err.message : String(err));
      } finally {
        setPromptBusy(false);
      }
    },
    [serverId, activePath]
  );

  const handleMove = useCallback(
    async (sourcePath: string, destDir: string) => {
      if (!serverId) return;
      const invalid = validateMove(sourcePath, destDir);
      if (invalid) {
        toast.info(invalid, sourcePath);
        return;
      }
      const destination = moveDestination(sourcePath, destDir);
      try {
        const res = await renamePath(serverId, sourcePath, destination);
        if (res.code === "0000") {
          toast.success("移动成功", `${sourcePath} → ${destination}`);
          treeRef.current?.refresh(parentOf(sourcePath) ?? ".");
          treeRef.current?.refresh(destDir);
          const movedActive = pathAfterMove(sourcePath, destination, activePath);
          if (movedActive) setActivePath(movedActive);
          if (previewPath) {
            const movedPreview = pathAfterMove(sourcePath, destination, previewPath);
            if (movedPreview) setPreviewPath(movedPreview);
          }
        } else {
          toast.error("移动失败", res.info);
        }
      } catch (err) {
        toast.error("移动失败", err instanceof Error ? err.message : String(err));
      }
    },
    [serverId, activePath, previewPath]
  );

  const confirmDelete = useCallback(
    async (recursive: boolean) => {
      if (!serverId || !deleteTarget) return;
      setDeleteBusy(true);
      try {
        const deletedPath = deleteTarget.path;
        const res = await deletePath(serverId, deletedPath, recursive);
        if (res.code === "0000") {
          toast.success("已删除", deletedPath);
          setDeleteTarget(null);
          treeRef.current?.refresh(parentOf(deletedPath) ?? ".");
          if (previewPath && isSameOrDescendant(deletedPath, previewPath)) {
            setPreviewPath(null);
          }
          if (isSameOrDescendant(deletedPath, activePath)) {
            setActivePath(parentOf(deletedPath) ?? ".");
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
    [serverId, deleteTarget, previewPath, activePath]
  );

  const openInExplorer = useCallback(
    (path: string) => {
      if (!serverId || !selectedServer) return;
      openExplorer({ connectionId: serverId, serverName: selectedServer.name, initialPath: path });
    },
    [serverId, selectedServer, openExplorer]
  );

  return (
    <div className="flex h-full min-w-0 flex-col border-r border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-[var(--border-default)] px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
          远程文件
        </h2>
        <div className="flex items-center gap-0.5">
          <ToolButton title="刷新文件树" onClick={() => treeRef.current?.refresh()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </ToolButton>
          <ToolButton
            title="在文件管理器中打开"
            onClick={() => openInExplorer(activePath)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          </ToolButton>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-input)] text-[var(--text-tertiary)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">还没有可浏览的服务器</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">先添加并连接一台主机，再回来浏览文件</p>
          <div className="flex gap-2">
            <button
              onClick={() => setLeftView("ssh")}
              className="rounded-md bg-[var(--surface-input)] px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              管理服务器
            </button>
            <button
              onClick={() => sshDispatch({ type: "OPEN_ADD_DIALOG" })}
              className="rounded-md bg-[var(--accent-bg)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              添加连接
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-2 py-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-[var(--status-success)]" : selectedServer?.status === 2 ? "bg-[var(--status-warning)]" : "bg-[var(--text-tertiary)]"}`}
                title={connected ? "已连接" : "未连接"}
              />
              <select
                value={serverId ?? ""}
                onChange={(event) => setServerId(event.target.value || null)}
                className="min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-[var(--surface-input)] px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                title="选择要浏览的服务器"
              >
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}（{server.username}@{server.host}）
                  </option>
                ))}
              </select>
            </div>
            {!connected ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded bg-[var(--status-warning)]/10 px-2 py-1 text-[10px] text-[var(--status-warning)]">
                <span>当前主机未连接</span>
                <button
                  onClick={() => void handleConnect()}
                  className="rounded bg-[var(--status-warning)]/15 px-1.5 py-0.5 font-medium hover:bg-[var(--status-warning)]/25"
                >
                  立即连接
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border-subtle)] px-2 py-1.5">
            <ToolButton title="新建目录" onClick={() => setPromptOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" />
              </svg>
            </ToolButton>
            <ToolButton title={`上传文件到 ${activePath}`} onClick={() => fileInputRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </ToolButton>
            <ToolButton title={`上传文件夹到 ${activePath}`} onClick={() => folderInputRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                <line x1="12" y1="10.5" x2="12" y2="15.5" />
                <polyline points="9.5,13 12,10.5 14.5,13" />
              </svg>
            </ToolButton>
            <div className="mx-1 h-3.5 w-px bg-[var(--border-default)]" />
            <ToolButton
              title={showHidden ? "隐藏点文件" : "显示点文件"}
              active={showHidden}
              onClick={() => setShowHidden((value) => !value)}
            >
              {showHidden ? "◉" : "○"}
            </ToolButton>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="过滤…"
              spellCheck={false}
              className="ml-auto w-[84px] rounded-md border border-transparent bg-[var(--surface-input)] px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
            />
          </div>

          <div className="min-h-0 flex-1">
            <FileTree
              ref={treeRef}
              connectionId={serverId ?? ""}
              activePath={activePath}
              showHidden={showHidden}
              filter={filter}
              className="scrollbar-thin px-0.5"
              onDirectoryChange={setActivePath}
              onOpenFile={(file) => setPreviewPath(file.path)}
              onDownload={(file) => void handleDownload(file)}
              onOpenInExplorer={openInExplorer}
              onDelete={setDeleteTarget}
              onMove={(sourcePath, destDir) => void handleMove(sourcePath, destDir)}
              onDropFiles={(destDir, dataTransfer) => startDrop(dataTransfer, destDir)}
            />
          </div>

          {progress ? (
            <div className="shrink-0 border-t border-[var(--border-subtle)] px-2 py-2">
              <UploadProgressPanel progress={progress} />
            </div>
          ) : null}

          <div className="shrink-0 border-t border-[var(--border-default)] px-2.5 py-1.5 text-[9px] text-[var(--text-tertiary)]">
            双击预览 · 右键删除 · 拖动节点到目录移动
            <br />
            拖入本地文件/文件夹上传
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) startFiles(event.target.files, activePath);
          event.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) startFiles(event.target.files, activePath);
          event.target.value = "";
        }}
      />

      <PromptDialog
        open={promptOpen}
        title="新建目录"
        label={`当前位置：${activePath}`}
        placeholder="例如 logs、backup"
        confirmText="创建"
        busy={promptBusy}
        onSubmit={(value) => void submitMkdir(value)}
        onClose={() => setPromptOpen(false)}
      />

      <DeletePathDialog
        file={deleteTarget}
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(recursive) => void confirmDelete(recursive)}
      />

      <FilePreviewDialog
        connectionId={serverId ?? ""}
        path={previewPath}
        onClose={() => setPreviewPath(null)}
        onSaved={() => treeRef.current?.refresh()}
      />
    </div>
  );
}
