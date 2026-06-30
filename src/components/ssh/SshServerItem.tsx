import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { useSshDispatch } from "../../contexts/SshContext";
import { useTerminalDispatch } from "../../contexts/TerminalContext";

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

  const handleDelete = () => {
    if (showDeleteConfirm) {
      sshDispatch({ type: "DELETE_SERVER", id: server.id });
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
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#37373d]
                    transition-colors border-b border-[#2d2d2d] last:border-b-0"
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* 连接状态指示灯 */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isConnected ? "bg-green-400" : "bg-[#858585]"
          }`}
          title={isConnected ? "已连接" : "未连接"}
        />

        {/* 服务器信息 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#cccccc] truncate font-medium">{server.name}</div>
          <div className="text-[11px] text-[#858585] truncate">
            {server.username}@{server.host}:{server.port}
          </div>
        </div>

        {/* 标签 */}
        {server.tags && server.tags.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {server.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-[#999]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            className="fixed z-50 bg-[#2b2b2b] border border-[#3c3c3c] rounded shadow-lg py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleConnect}
              className="w-full text-left px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#094771]"
            >
              连接
            </button>
            <button
              onClick={handleEdit}
              className="w-full text-left px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#094771]"
            >
              编辑
            </button>
            <button
              onClick={handleCopyAddress}
              className="w-full text-left px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#094771]"
            >
              复制地址
            </button>
            <div className="border-t border-[#3c3c3c] my-0.5" />
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#5a1d1d]"
            >
              {showDeleteConfirm ? "确认删除？" : "删除"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
