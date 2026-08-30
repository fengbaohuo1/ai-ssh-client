import { useCallback, useEffect, useState } from "react";
import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import { listSessions, listMessages, type SessionListItem } from "../../api/chat";
import { generateLocalId } from "./historyUtils";

/**
 * 会话历史侧栏（2-8 对接）：展示后端 chat_session 列表，
 * 点击某个会话 → 拉取消息回放到聊天面板，并绑定同一后端会话（可继续对话）。
 */
export default function ChatHistorySidebar() {
  const { selectedAgentId } = useChatState();
  const dispatch = useChatDispatch();

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSessions(selectedAgentId, "default", 30);
      if (res.code === "0000" && res.data) {
        setSessions(res.data);
      } else {
        setError(res.info || "查询失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 点击历史会话：拉取消息 → 生成本地对话（绑定同一 sessionId，可继续聊） */
  const openSession = useCallback(async (session: SessionListItem) => {
    setLoadingSessionId(session.sessionId);
    try {
      const res = await listMessages(session.sessionId, 100);
      if (res.code === "0000" && res.data) {
        const messages = res.data
          // tool 行是审计细节（命令原文/输出），不进聊天回放
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, idx) => ({
            id: `${session.sessionId}-${idx}`,
            role: m.role as "user" | "assistant",
            content: m.content || "",
            timestamp: m.createdAt ? new Date(m.createdAt.replace(" ", "T")).getTime() : Date.now(),
            status: "sent" as const,
          }));
        dispatch({
          type: "LOAD_HISTORY",
          conversation: {
            id: generateLocalId(),
            title: session.title || "历史会话",
            messages,
            createdAt: session.updatedAt
              ? new Date(session.updatedAt.replace(" ", "T")).getTime()
              : Date.now(),
            sessionId: session.sessionId,
          },
        });
      }
    } catch (err) {
      console.error("加载历史会话失败", err);
    } finally {
      setLoadingSessionId(null);
    }
  }, [dispatch]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 h-[38px] border-b border-[var(--border-default)] shrink-0">
        <h2 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em]">
          会话历史
        </h2>
        <button
          onClick={refresh}
          title="刷新"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <p className="text-xs text-[var(--status-error)] mb-1">加载失败</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <p className="text-xs text-[var(--text-secondary)] mb-1">暂无历史会话</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">开始对话后自动记录</p>
          </div>
        ) : (
          <div className="py-0.5">
            {sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => openSession(s)}
                disabled={loadingSessionId !== null}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--surface-input)] transition-colors
                           disabled:opacity-50 border-b border-[var(--border-default)]/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-primary)] truncate">
                    {s.title || "未命名会话"}
                  </span>
                  {loadingSessionId === s.sessionId ? (
                    <span className="w-3 h-3 shrink-0 border border-[var(--border-default)]
                                     border-t-[var(--accent-bg)] rounded-full animate-spin" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                      {s.messageCount ?? 0} 条
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  {s.updatedAt || ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
