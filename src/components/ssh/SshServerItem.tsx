import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { useSshDispatch, useSshActions } from "../../contexts/SshContext";
import { useTerminalDispatch } from "../../contexts/TerminalContext";

interface Props {
  server: SshServer;
}

export default function SshServerItem({ server }: Props) {
  const sshDispatch = useSshDispatch();
  const terminalDispatch = useTerminalDispatch();
  const { connectServer, disconnectServer, removeServer } = useSshActions();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isConnected = server.status === 1;

  const handleRowClick = () => {
    terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
  };

  const handleDoubleClick = useCallback(async () => {
    terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
    try {
      const res = await connectServer(server.id);
      if (res?.code === "0000") {
        terminalDispatch({
          type: "OPEN_SERVER_TAB",
          serverId: server.id,
          serverName: server.name,
        });
      }
    } catch (err) {
      console.error("连接失败", err);
    }
  }, [server.id, server.name, connectServer, terminalDispatch]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleConnect = useCallback(async () => {
    terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
    try {
      const res = await connectServer(server.id);
      if (res?.code === "0000") {
        terminalDispatch({ type: "OPEN_SERVER_TAB", serverId: server.id, serverName: server.name });
      }
    } catch (err) {
      console.error("连接失败", err);
    }
    closeMenu();
  }, [server.id, connectServer, terminalDispatch, closeMenu]);

  const handleDisconnect = async () => {
    await disconnectServer(server.id);
    closeMenu();
  };

  const handleEdit = () => {
    sshDispatch({ type: "OPEN_EDIT_DIALOG", server });
    closeMenu();
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      await removeServer(server.id);
      closeMenu();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(`${server.username}@${server.host}:${server.port}`);
    closeMenu();
  };

  return (
    <>
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100
                    border-b border-[var(--border-subtle)] last:border-b-0
                    hover:bg-[var(--surface-hover)]"
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--text-primary)] truncate">{server.name}</div>
          <div className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5 font-mono">
            {server.username}@{server.host}:{server.port}
          </div>
        </div>

        {/* Tags */}
        {server.tags && server.tags.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {server.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-input)] text-[var(--text-secondary)]
                           border border-[var(--border-subtle)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Toggle switch */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (isConnected) {
              await disconnectServer(server.id);
            } else {
              terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
              const res = await connectServer(server.id);
              if (res?.code === "0000") {
                terminalDispatch({ type: "OPEN_SERVER_TAB", serverId: server.id, serverName: server.name });
              }
            }
          }}
          className={`relative w-7 h-4 rounded-full transition-colors duration-200 flex-shrink-0 ${
            isConnected
              ? "bg-[var(--status-success)]"
              : "bg-[var(--text-tertiary)]"
          }`}
          title={isConnected ? "点击断开" : "点击连接"}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm ${
              isConnected ? "translate-x-3" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            className="fixed z-50 bg-[var(--surface-dropdown)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 min-w-[150px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleConnect}
              className="w-full text-left px-3.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-active)] transition-colors"
            >
              连接
            </button>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="w-full text-left px-3.5 py-1.5 text-xs text-[var(--status-warning)] hover:bg-[var(--status-danger-hover)] transition-colors"
              >
                断开
              </button>
            )}
            <button
              onClick={handleEdit}
              className="w-full text-left px-3.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-active)] transition-colors"
            >
              编辑
            </button>
            <button
              onClick={handleCopyAddress}
              className="w-full text-left px-3.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-active)] transition-colors"
            >
              复制地址
            </button>
            <div className="border-t border-[var(--border-default)] my-0.5" />
            <button
              onClick={handleDelete}
              className="w-full text-left px-3.5 py-1.5 text-xs text-[var(--status-error)] hover:bg-[var(--status-danger-hover)] transition-colors"
            >
              {showDeleteConfirm ? "确认删除？" : "删除"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
