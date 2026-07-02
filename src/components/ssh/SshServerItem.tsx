import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { useSshDispatch } from "../../contexts/SshContext";
import { useTerminalDispatch } from "../../contexts/TerminalContext";
import { deleteConnection } from "../../api/ssh";

interface Props {
  server: SshServer;
}

export default function SshServerItem({ server }: Props) {
  const sshDispatch = useSshDispatch();
  const terminalDispatch = useTerminalDispatch();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isConnected = !!server.lastConnected;

  const handleDoubleClick = useCallback(() => {
    terminalDispatch({
      type: "OPEN_TAB",
      serverId: server.id,
      serverName: server.name,
    });
  }, [server.id, server.name, terminalDispatch]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleConnect = () => {
    terminalDispatch({ type: "OPEN_TAB", serverId: server.id, serverName: server.name });
    closeMenu();
  };

  const handleEdit = () => {
    sshDispatch({ type: "OPEN_EDIT_DIALOG", server });
    closeMenu();
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      try {
        const res = await deleteConnection(server.id);
        if (res.code === "0000") {
          sshDispatch({ type: "DELETE_SERVER", id: server.id });
        }
      } catch (err) {
        console.error("删除失败", err);
      }
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
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Connection status dot */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
            isConnected ? "bg-[var(--status-success)] shadow-[0_0_6px_var(--status-success)]" : "bg-[var(--text-tertiary)]"
          }`}
          title={isConnected ? "已连接" : "未连接"}
        />

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
