import { useState, useCallback } from "react";
import type { SshServer } from "../../types";
import { statusLabel } from "../../types";
import { useSshState, useSshDispatch, useSshActions } from "../../contexts/SshContext";
import { useTerminalState, useTerminalDispatch } from "../../contexts/TerminalContext";

interface Props {
  server: SshServer;
}

/** 连接状态指示灯样式：已连接=亮绿、连接中=琥珀脉冲、失败=红、未连接=熄灭 */
function statusDotClass(status: number): string {
  switch (status) {
    case 1:
      return "bg-[var(--status-success)] shadow-[0_0_4px_var(--status-success)]";
    case 2:
      return "bg-[var(--status-warning)] animate-pulse";
    case 3:
      return "bg-[var(--status-error)]";
    default:
      return "bg-[var(--text-tertiary)] opacity-40";
  }
}

export default function SshServerItem({ server }: Props) {
  const { activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const sshDispatch = useSshDispatch();
  const terminalDispatch = useTerminalDispatch();
  const { connectServer, disconnectServer, removeServer, setActiveConnection } = useSshActions();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isConnected = server.status === 1;
  const isActive = activeConnectionId === server.id;

  /** 查找该服务器对应的终端标签并激活 */
  const activateServerTab = useCallback(() => {
    const tab = tabs.find((t) => t.serverId === server.id);
    if (tab) {
      terminalDispatch({ type: "SET_ACTIVE_TAB", id: tab.id });
    }
  }, [tabs, server.id, terminalDispatch]);

  const handleRowClick = () => {
    // 单击：切换到该服务器的终端标签，同时绑定 AI 到该服务器
    activateServerTab();
    if (isConnected) {
      setActiveConnection(isActive ? null : server.id);
    }
  };

  const handleDoubleClick = useCallback(async () => {
    activateServerTab();
    // 已连接：双击只负责"激活标签 + 绑定 AI"，不再重复调 connect 接口
    if (isConnected) {
      if (!isActive) setActiveConnection(server.id);
      return;
    }
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
  }, [server.id, server.name, isConnected, isActive, connectServer, terminalDispatch, activateServerTab, setActiveConnection]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleConnect = useCallback(async () => {
    activateServerTab();
    try {
      const res = await connectServer(server.id);
      if (res?.code === "0000") {
        terminalDispatch({ type: "OPEN_SERVER_TAB", serverId: server.id, serverName: server.name });
      }
    } catch (err) {
      console.error("连接失败", err);
    }
    closeMenu();
  }, [server.id, connectServer, terminalDispatch, closeMenu, activateServerTab]);

  const handleDisconnect = async () => {
    await disconnectServer(server.id);
    // 关闭该服务器对应的所有标签
    for (const tab of tabs) {
      if (tab.serverId === server.id) {
        terminalDispatch({ type: "CLOSE_TAB", id: tab.id });
      }
    }
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

        {/* 状态指示灯（连接交互改为双击/右键菜单，不再提供开关） */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass(server.status)}`}
          title={statusLabel(server.status)}
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
