import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { serverSessionState } from "./sessionStatus";
import { useSshState, useSshDispatch, useSshActions } from "../../contexts/SshContext";
import { useTerminalState, useTerminalDispatch } from "../../contexts/TerminalContext";
import { useServerSession } from "../../hooks/useServerSession";

interface Props {
  server: SshServer;
}

/**
 * 服务器列表项。
 * <p>交互语义（V2 收敛）：
 * - 单击：仅聚焦该服务器的终端标签（若已打开）
 * - 双击 / 右键「连接」：确保前端会话（打开/重建终端标签并连 WS）
 * - 行尾指示灯 = 前端页面终端会话状态（WS 为准），非后端连接池状态
 * - AI 目标服务器绑定不再由列表行触发——统一在右侧 AI 面板顶部的选择器里选
 */
export default function SshServerItem({ server }: Props) {
  const { activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const sshDispatch = useSshDispatch();
  const terminalDispatch = useTerminalDispatch();
  const { disconnectServer, removeServer, setActiveConnection } = useSshActions();
  const { connectAndOpen } = useServerSession();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 连接状态：以当前页面终端会话（TerminalTab / WS）为准
  const session = serverSessionState(tabs.find((t) => t.serverId === server.id));
  const isConnected = session.connected;
  const isActive = activeConnectionId === server.id;

  /** 查找该服务器对应的终端标签并激活 */
  const activateServerTab = useCallback(() => {
    const tab = tabs.find((t) => t.serverId === server.id);
    if (tab) {
      terminalDispatch({ type: "SET_ACTIVE_TAB", id: tab.id });
    }
  }, [tabs, server.id, terminalDispatch]);

  /** 双击：确保前端会话（已连接仅聚焦，不再兼任 AI 绑定） */
  const handleDoubleClick = useCallback(async () => {
    await connectAndOpen(server);
  }, [server, connectAndOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleConnect = useCallback(async () => {
    await connectAndOpen(server);
    closeMenu();
  }, [server, connectAndOpen, closeMenu]);

  const handleDisconnect = async () => {
    await disconnectServer(server.id);
    // 关闭该服务器对应的所有标签
    for (const tab of tabs) {
      if (tab.serverId === server.id) {
        terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
      }
    }
    // 若该服务器正被 AI 绑定，解除绑定
    if (isActive) setActiveConnection(null);
    closeMenu();
  };

  const handleEdit = () => {
    sshDispatch({ type: "OPEN_EDIT_DIALOG", server });
    closeMenu();
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      // 如果已连接，先断开
      if (isConnected) {
        await disconnectServer(server.id);
      }
      // 关闭关联标签
      for (const tab of tabs) {
        if (tab.serverId === server.id) {
          terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
        }
      }
      if (isActive) setActiveConnection(null);
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
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100
                    border-b border-[var(--border-subtle)] last:border-b-0
                    hover:bg-[var(--surface-hover)]
                    ${isActive ? "bg-[var(--surface-active)] ring-1 ring-inset ring-[var(--accent-bg)]" : ""}`}
        onClick={activateServerTab}
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

        {/* 状态指示灯（前端终端会话为准） */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${session.dotClass}`}
          title={session.label}
        />
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
