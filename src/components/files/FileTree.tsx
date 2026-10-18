import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SftpFile } from "../../api/files";
import { toast } from "../../stores/toastStore";
import FileIcon from "./FileIcon";
import {
  hasFileDrag,
  hasRemoteDrag,
  parentOf,
  readRemoteDrag,
  REMOTE_DRAG_MIME,
} from "./fileUtils";
import { useFileTree } from "./useFileTree";

export interface FileTreeRoot {
  path: string;
  label: string;
  kind: "home" | "root";
}

export interface FileTreeHandle {
  /** 刷新指定目录；不传则刷新整棵树（已展开节点） */
  refresh: (path?: string) => void;
  /** 展开并滚动到指定路径（通常是当前目录） */
  reveal: (path: string) => void;
}

interface Props {
  connectionId: string;
  activePath?: string | null;
  showHidden?: boolean;
  filter?: string;
  className?: string;
  roots?: FileTreeRoot[];
  onDirectoryChange?: (path: string) => void;
  onOpenFile?: (file: SftpFile) => void;
  onDownload?: (file: SftpFile) => void;
  onOpenInExplorer?: (path: string) => void;
  /** 删除节点（由父组件弹确认框并调用后端） */
  onDelete?: (file: SftpFile) => void;
  /** 把远程节点拖到 destDir（由父组件调用后端 rename 并刷新） */
  onMove?: (sourcePath: string, destDir: string) => void;
  onDropFiles?: (destDir: string, dataTransfer: DataTransfer) => void;
}

const DEFAULT_ROOTS: FileTreeRoot[] = [
  { path: ".", label: "主目录", kind: "home" },
  { path: "/", label: "根目录", kind: "root" },
];

type MenuState = {
  x: number;
  y: number;
  file: SftpFile;
  isRoot: boolean;
};

function rootFile(root: FileTreeRoot): SftpFile {
  return {
    name: root.label,
    path: root.path,
    type: "dir",
    size: 0,
    modifiedAt: 0,
    permissions: 0,
    permissionsText: "",
    hidden: false,
    linkTarget: null,
    owner: null,
  };
}

function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function RootIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <line x1="7" y1="7.5" x2="7.01" y2="7.5" />
      <line x1="7" y1="16.5" x2="7.01" y2="16.5" />
    </svg>
  );
}

/**
 * IDE 风格远程文件树。
 *
 * <p>能力：懒加载展开 / 过滤 / 隐藏文件 / 右键菜单 / 拖入本地文件或文件夹上传。
 * 树本身不执行写操作，具体上传由父组件通过 `onDropFiles` 注入，便于和列表页共享上传队列。
 */
const FileTree = forwardRef<FileTreeHandle, Props>(function FileTree(
  {
    connectionId,
    activePath,
    showHidden = false,
    filter = "",
    className = "",
    roots,
    onDirectoryChange,
    onOpenFile,
    onDownload,
    onOpenInExplorer,
    onDelete,
    onMove,
    onDropFiles,
  },
  ref
) {
  const tree = useFileTree(connectionId);
  const {
    children,
    errors,
    loading,
    expanded,
    ensureLoaded,
    toggle,
    expandTo,
    expandPaths,
    refreshPath,
    refreshAll,
  } = tree;

  const rootList = roots ?? DEFAULT_ROOTS;
  const rootsKey = rootList.map((root) => `${root.path}:${root.label}`).join("|");

  const containerRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const filterText = filter.trim().toLowerCase();

  const scrollToPath = useCallback((target: string) => {
    requestAnimationFrame(() => {
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(target)
          : target.replace(/["\\]/g, "\\$&");
      const element = containerRef.current?.querySelector<HTMLElement>(
        `[data-tree-path="${escaped}"]`
      );
      element?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  // 连接切换时只默认展开第一个根（主目录），其余根按需加载，避免首屏请求过多
  useEffect(() => {
    if (!connectionId || rootList.length === 0) return;
    expandPaths([rootList[0].path]);
    // rootList 以 rootsKey 作为稳定依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, rootsKey, expandPaths]);

  // 外部当前目录变化：展开祖先链并滚动定位
  useEffect(() => {
    if (!connectionId || !activePath) return;
    let alive = true;
    void expandTo(activePath).then(() => {
      if (alive) scrollToPath(activePath);
    });
    return () => {
      alive = false;
    };
  }, [connectionId, activePath, expandTo, scrollToPath]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: (target?: string) => {
        if (target) {
          refreshPath(target);
          return;
        }
        refreshAll();
        if (rootList.length > 0) void ensureLoaded(rootList[0].path, true);
      },
      reveal: (target: string) => {
        void expandTo(target).then(() => scrollToPath(target));
      },
    }),
    [refreshPath, refreshAll, rootList, ensureLoaded, expandTo, scrollToPath]
  );

  const nodeVisible = useCallback(
    (file: SftpFile): boolean => {
      if (!showHidden && file.hidden) return false;
      if (!filterText) return true;
      if (file.name.toLowerCase().includes(filterText)) return true;
      if (file.type === "dir") {
        return (children[file.path] ?? []).some((child) => nodeVisible(child));
      }
      return false;
    },
    [children, filterText, showHidden]
  );

  const handleNodeClick = useCallback(
    (file: SftpFile) => {
      if (file.type === "dir") {
        toggle(file.path);
        onDirectoryChange?.(file.path);
      } else {
        onOpenFile?.(file);
      }
    },
    [toggle, onDirectoryChange, onOpenFile]
  );

  const openContextMenu = useCallback((event: React.MouseEvent, file: SftpFile, isRoot: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    const width = 178;
    const height = 188;
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - width - 8),
      y: Math.min(event.clientY, window.innerHeight - height - 8),
      file,
      isRoot,
    });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const handleDragOver = useCallback(
    (event: React.DragEvent, destDir: string) => {
      const files = hasFileDrag(event.dataTransfer);
      const remote = hasRemoteDrag(event.dataTransfer);
      if (!files && !remote) return;
      if (files && !onDropFiles) return;
      if (remote && !onMove) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = files ? "copy" : "move";
      setDropTarget(destDir);
    },
    [onDropFiles, onMove]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent, destDir: string) => {
      const files = hasFileDrag(event.dataTransfer);
      const remote = hasRemoteDrag(event.dataTransfer);
      if (!files && !remote) return;
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(null);
      if (files) {
        onDropFiles?.(destDir, event.dataTransfer);
        return;
      }
      const sourcePath = readRemoteDrag(event.dataTransfer);
      if (sourcePath) {
        onMove?.(sourcePath, destDir);
      }
    },
    [onDropFiles, onMove]
  );

  const renderChildren = (dir: SftpFile | FileTreeRoot, depth: number) => {
    const kids = children[dir.path];
    if (!kids) {
      if (loading[dir.path]) {
        return (
          <div style={{ paddingLeft: 10 + depth * 12 }} className="flex h-[22px] items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[var(--border-default)] border-t-[var(--accent-bg)]" />
            加载中…
          </div>
        );
      }
      if (errors[dir.path]) {
        return (
          <div style={{ paddingLeft: 10 + depth * 12 }} className="flex min-h-[22px] items-center gap-2 py-0.5 pr-2 text-[10px] text-[var(--status-error)]">
            <span className="min-w-0 flex-1 truncate" title={errors[dir.path]}>
              {errors[dir.path]}
            </span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                refreshPath(dir.path);
              }}
              className="shrink-0 rounded px-1 py-0.5 text-[9px] text-[var(--text-secondary)] hover:bg-[var(--surface-input)] hover:text-[var(--text-primary)]"
            >
              重试
            </button>
          </div>
        );
      }
      return null;
    }
    const visible = kids.filter(nodeVisible);
    if (visible.length === 0) {
      if (!filterText) {
        return (
          <div style={{ paddingLeft: 22 + depth * 12 }} className="h-[20px] text-[10px] italic leading-[20px] text-[var(--text-tertiary)]">
            {loading[dir.path] ? "加载中…" : "空目录"}
          </div>
        );
      }
      return (
        <div style={{ paddingLeft: 22 + depth * 12 }} className="h-[20px] text-[10px] italic leading-[20px] text-[var(--text-tertiary)]">
          无匹配项
        </div>
      );
    }
    return visible.map((child) => renderNode(child, depth));
  };

  const renderNode = (file: SftpFile, depth: number) => {
    const isDir = file.type === "dir";
    const open = isDir && (expanded.has(file.path) || Boolean(filterText));
    const isActive = activePath === file.path;
    const isDropTarget = dropTarget === file.path;
    const dropDest = isDir ? file.path : parentOf(file.path) ?? ".";

    return (
      <div key={file.path}>
        <div
          data-tree-path={file.path}
          role="treeitem"
          aria-expanded={isDir ? open : undefined}
          aria-selected={isActive}
          title={`${file.path}\n拖动可移动到其他目录`}
          draggable={Boolean(onMove)}
          onDragStart={(event) => {
            if (!onMove) return;
            event.stopPropagation();
            event.dataTransfer.setData(REMOTE_DRAG_MIME, file.path);
            event.dataTransfer.setData("text/plain", file.path);
            event.dataTransfer.effectAllowed = "move";
            setDraggingPath(file.path);
          }}
          onDragEnd={() => {
            setDraggingPath(null);
            setDropTarget(null);
          }}
          onClick={() => handleNodeClick(file)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (!isDir) onOpenFile?.(file);
          }}
          onContextMenu={(event) => openContextMenu(event, file, false)}
          onDragOver={(event) => handleDragOver(event, dropDest)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDropTarget((prev) => (prev === dropDest ? null : prev));
            }
          }}
          onDrop={(event) => handleDrop(event, dropDest)}
          className={`group flex h-[22px] cursor-pointer select-none items-center gap-1 pr-1.5 text-[11px] leading-none transition-colors
            ${isActive ? "bg-[var(--surface-active)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}
            ${isDropTarget ? "!bg-[var(--accent-bg)]/15 ring-1 ring-inset ring-[var(--accent-bg)]" : ""}
            ${draggingPath === file.path ? "opacity-40" : ""}`}
          style={{ paddingLeft: 5 + depth * 12 }}
        >
          {isDir ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggle(file.path);
              }}
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              tabIndex={-1}
              aria-label={open ? "折叠" : "展开"}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-100 ${open ? "rotate-90" : ""}`}
              >
                <polyline points="4,2 8,6 4,10" />
              </svg>
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          {loading[file.path] ? (
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[var(--border-default)] border-t-[var(--accent-bg)]" />
            </span>
          ) : (
            <FileIcon type={file.type} name={file.name} size={14} />
          )}

          <span className={`min-w-0 flex-1 truncate ${file.hidden ? "text-[var(--text-tertiary)]" : ""}`}>
            {file.name}
          </span>
          {file.type === "link" ? (
            <span className="shrink-0 text-[9px] text-[var(--status-info)]" title={file.linkTarget ?? undefined}>↗</span>
          ) : null}
        </div>
        {open ? renderChildren(file, depth + 1) : null}
      </div>
    );
  };

  const renderRoot = (root: FileTreeRoot) => {
    const file = rootFile(root);
    const open = expanded.has(root.path) || Boolean(filterText);
    const isActive = activePath === root.path;
    const isDropTarget = dropTarget === root.path;

    return (
      <div key={root.path}>
        <div
          data-tree-path={root.path}
          role="treeitem"
          aria-expanded={open}
          aria-selected={isActive}
          onClick={() => {
            toggle(root.path);
            onDirectoryChange?.(root.path);
          }}
          onContextMenu={(event) => openContextMenu(event, file, true)}
          onDragOver={(event) => handleDragOver(event, root.path)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDropTarget((prev) => (prev === root.path ? null : prev));
            }
          }}
          onDrop={(event) => handleDrop(event, root.path)}
          className={`group flex h-[24px] cursor-pointer select-none items-center gap-1.5 pr-1.5 text-[11px] transition-colors
            ${isActive ? "bg-[var(--surface-active)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}
            ${isDropTarget ? "!bg-[var(--accent-bg)]/15 ring-1 ring-inset ring-[var(--accent-bg)]" : ""}`}
          style={{ paddingLeft: 5 }}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggle(root.path);
            }}
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
            tabIndex={-1}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-100 ${open ? "rotate-90" : ""}`}
            >
              <polyline points="4,2 8,6 4,10" />
            </svg>
          </button>
          <span className="text-[var(--accent-bg)]">{root.kind === "home" ? <HomeIcon /> : <RootIcon />}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{root.label}</span>
          <span className="shrink-0 font-mono text-[9px] text-[var(--text-tertiary)]">{root.path}</span>
        </div>
        {open ? renderChildren(root, 1) : null}
      </div>
    );
  };

  const menuFile = menu?.file ?? null;
  const menuIsDir = menuFile?.type === "dir";
  const menuParent = menuFile ? (menuIsDir ? menuFile.path : parentOf(menuFile.path) ?? ".") : ".";

  const menuItems = useMemo(() => {
    if (!menu || !menuFile) return [];
    const items: { label: string; run: () => void; danger?: boolean }[] = [];
    if (menuIsDir) {
      items.push({
        label: expanded.has(menuFile.path) ? "折叠目录" : "展开目录",
        run: () => toggle(menuFile.path),
      });
    } else {
      items.push({
        label: "预览 / 打开",
        run: () => onOpenFile?.(menuFile),
      });
      if (onDownload) {
        items.push({ label: "下载到本地", run: () => onDownload(menuFile) });
      }
    }
    if (onOpenInExplorer) {
      items.push({
        label: "在文件管理器中打开",
        run: () => onOpenInExplorer(menuParent),
      });
    }
    items.push({
      label: "刷新",
      run: () => refreshPath(menuIsDir ? menuFile.path : menuParent),
    });
    items.push({
      label: "复制路径",
      run: () => {
        void navigator.clipboard.writeText(menuFile.path).then(
          () => toast.success("路径已复制", menuFile.path),
          () => toast.error("复制失败", menuFile.path)
        );
      },
    });
    if (!menu.isRoot && onDelete) {
      items.push({
        label: "删除",
        danger: true,
        run: () => onDelete(menuFile),
      });
    }
    return items;
  }, [
    menu,
    menuFile,
    menuIsDir,
    menuParent,
    expanded,
    toggle,
    refreshPath,
    onOpenFile,
    onDownload,
    onOpenInExplorer,
    onDelete,
  ]);

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="远程文件树"
      className={`relative h-full overflow-auto py-1 ${className}`}
      onDragOver={(event) => {
        const files = hasFileDrag(event.dataTransfer);
        const remote = hasRemoteDrag(event.dataTransfer);
        if (!files && !remote) return;
        if (files && !onDropFiles) return;
        if (remote && !onMove) return;
        // 始终阻止默认行为，避免 WebView 把拖入的文件当成导航打开
        event.preventDefault();
        event.dataTransfer.dropEffect = files ? "copy" : "move";
        if (event.target === event.currentTarget) {
          setDropTarget(activePath ?? rootList[0]?.path ?? ".");
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTarget(null);
        }
      }}
      onDrop={(event) => {
        const files = hasFileDrag(event.dataTransfer);
        const remote = hasRemoteDrag(event.dataTransfer);
        if (!files && !remote) return;
        // 行级 drop 已 stopPropagation；能冒泡到容器的都属于"空白区域"
        event.preventDefault();
        const dest = activePath ?? rootList[0]?.path ?? ".";
        setDropTarget(null);
        if (files) {
          onDropFiles?.(dest, event.dataTransfer);
          return;
        }
        const sourcePath = readRemoteDrag(event.dataTransfer);
        if (sourcePath) onMove?.(sourcePath, dest);
      }}
    >
      {rootList.map(renderRoot)}

      {menu ? (
        <>
          <div
            className="fixed inset-0 z-[120]"
            onClick={closeMenu}
            onContextMenu={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          />
          <div
            className="fixed z-[121] min-w-[178px] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-dropdown)] py-1 shadow-2xl"
            style={{ left: menu.x, top: menu.y }}
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.run();
                  closeMenu();
                }}
                className={`file-tree-menu-item ${item.danger ? "danger" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <style>{`
        .file-tree-menu-item {
          display: block; width: 100%; padding: 5px 14px; text-align: left;
          font-size: 11px; color: var(--text-primary); transition: background-color .1s;
        }
        .file-tree-menu-item:hover { background: var(--surface-active); }
        .file-tree-menu-item.danger { color: var(--status-error); }
        .file-tree-menu-item.danger:hover {
          background: color-mix(in srgb, var(--status-error) 14%, transparent);
        }
      `}</style>
    </div>
  );
});

export default FileTree;
