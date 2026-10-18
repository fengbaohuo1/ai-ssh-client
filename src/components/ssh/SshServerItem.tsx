import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { serverSessionState } from "./sessionStatus";
import { useSshState, useSshDispatch, useSshActions } from "../../contexts/SshContext";
import { useTerminalState, useTerminalDispatch } from "../../contexts/TerminalContext";
import { useServerSession } from "../../hooks/useServerSession";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";

interface Props {
  server: SshServer;
}

/**
 * 服务器列表项。
 *
 * <p>交互：
 * - 单击：聚焦该服务器的终端标签（若已打开）
 * - 双击 / 右键「连接」：确保前端会话
 * - 星标：收藏（写入后端）
 * - 文件图标 / 右键「文件管理」：SFTP 文件管理器
 */
export default function SshServerItem({ server }: Props) {
  const { activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const sshDispatch = useSshDispatch();
  const terminalDispatch = useTerminalDispatch();
  const { disconnectServer, removeServer, setActiveConnection, connectServer, toggleFavorite } = useSshActions();
  const { connectAndOpen } = useServerSession();
  const openExplorer = useFileExplorerStore((s) => s.open);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const session = serverSessionState(tabs.find((t) => t.serverId === server.id));
  const isConnected = session.connected || server.status === 1;
  const isActive = activeConnectionId === server.id;
  const statusDotClass = isConnected ? "bg-[var(--status-success)]" : session.dotClass;
  const statusLabel = isConnected ? "已连接" : session.label;

  const activateServerTab = useCallback(() => {
    const tab = tabs.find((t) => t.serverId === server.id);
    if (tab) terminalDispatch({ type: "SET_ACTIVE_TAB", id: tab.id });
  }, [tabs, server.id, terminalDispatch]);

  const handleDoubleClick = useCallback(async () => {
    await connectAndOpen(server);
  }, [server, connectAndOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const width = 172;
    const height = 230;
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - width - 8),
      y: Math.min(e.clientY, window.innerHeight - height - 8),
    });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleConnect = useCallback(async () => {
    await connectAndOpen(server);
    closeMenu();
  }, [server, connectAndOpen, closeMenu]);

  const handleOpenFiles = useCallback(async () => {
    closeMenu();
    // 后端状态可能因进程重启而陈旧：以当前页面终端会话为准，必要时重新建立 SSH 会话
    if (!session.connected) {
      const res = await connectServer(server.id);
      if (!res || res.code !== "0000") return;
    }
    openExplorer({ connectionId: server.id, serverName: server.name });
  }, [server, session.connected, connectServer, openExplorer, closeMenu]);

  const handleDisconnect = async () => {
    await disconnectServer(server.id);
    for (const tab of tabs) {
      if (tab.serverId === server.id) terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
    }
    if (isActive) setActiveConnection(null);
    closeMenu();
  };

  const handleEdit = () => {
    sshDispatch({ type: "OPEN_EDIT_DIALOG", server });
    closeMenu();
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    if (isConnected) await disconnectServer(server.id);
    for (const tab of tabs) {
      if (tab.serverId === server.id) terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
    }
    if (isActive) setActiveConnection(null);
    await removeServer(server.id);
    closeMenu();
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(`${server.username}@${server.host}:${server.port}`);
    closeMenu();
  };

  return (
    <>
      <div
        className={`group flex cursor-pointer items-center gap-2 border-b border-[var(--border-subtle)]/60 px-3 py-2
                    transition-colors duration-100 last:border-b-0 hover:bg-[var(--surface-hover)]
                    ${isActive ? "bg-[var(--surface-active)]/70 ring-1 ring-inset ring-[var(--accent-bg)]/40" : ""}`}
        onClick={activateServerTab}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${statusDotClass}`} title={statusLabel} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs text-[var(--text-primary)]">{server.name}</span>
            {server.favorite ? <span className="shrink-0 text-[10px] text-[var(--status-warning)]">★</span> : null}
            {server.groupName ? (
              <span className="shrink-0 rounded bg-[var(--surface-input)] px-1 py-0.5 text-[9px] text-[var(--text-tertiary)]">
                {server.groupName}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-tertiary)]">
            {server.username}@{server.host}:{server.port}
          </div>
          {server.tags && server.tags.length > 0 ? (
            <div className="mt-1 flex gap-1 overflow-hidden">
              {server.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="shrink-0 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-1 py-0.5 text-[9px] text-[var(--text-secondary)]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleFavorite(server);
            }}
            className={`flex h-5 w-5 items-center justify-center rounded text-[11px] transition-opacity
              ${server.favorite ? "text-[var(--status-warning)] opacity-100" : "text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--status-warning)]"}`}
            title={server.favorite ? "取消收藏" : "收藏"}
          >
            {server.favorite ? "★" : "☆"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenFiles();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-tertiary)] opacity-0 transition-opacity
                       hover:bg-[var(--surface-input)] hover:text-[var(--accent-bg)] group-hover:opacity-100"
            title="文件管理"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </button>
        </div>
      </div>

      {contextMenu ? (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            className="fixed z-50 min-w-[172px] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-dropdown)] py-1 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={handleConnect} className="menu-item">连接 / 聚焦终端</button>
            <button onClick={() => void handleOpenFiles()} className="menu-item">文件管理</button>
            <button onClick={handleEdit} className="menu-item">编辑配置</button>
            <button onClick={() => { void toggleFavorite(server); closeMenu(); }} className="menu-item">
              {server.favorite ? "取消收藏" : "加入收藏"}
            </button>
            <button onClick={() => void handleCopyAddress()} className="menu-item">复制地址</button>
            {isConnected ? (
              <button onClick={() => void handleDisconnect()} className="menu-item !text-[var(--status-warning)]">断开连接</button>
            ) : null}
            <div className="my-0.5 border-t border-[var(--border-default)]" />
            <button onClick={() => void handleDelete()} className="menu-item !text-[var(--status-error)]">
              {showDeleteConfirm ? "确认删除？" : "删除服务器"}
            </button>
          </div>
        </>
      ) : null}

      <style>{`
        .menu-item {
          display: block; width: 100%; padding: 6px 14px; text-align: left;
          font-size: 11px; color: var(--text-primary); transition: background-color .1s;
        }
        .menu-item:hover { background: var(--surface-active); }
      `}</style>
    </>
  );
}
