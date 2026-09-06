import { useState } from "react";
import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import AiChatMessages from "./AiChatMessages";
import AiChatInput from "./AiChatInput";
import TargetServerSelect from "./TargetServerSelect";

export default function AiChatPanel() {
  const { conversations, activeConversationId } = useChatState();
  const dispatch = useChatDispatch();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];
  const isStreaming = messages.length > 0 && messages[messages.length - 1]?.streaming === true;

  // Copy last AI response
  const handleCopyLast = async () => {
    const lastAi = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAi?.content) return;
    await navigator.clipboard.writeText(lastAi.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-l border-[var(--border-default)]">
      {/* ===== 目标服务器选择器（对话/输入区之外；AI 绑定入口，单选） ===== */}
      <TargetServerSelect />

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-3 h-[42px] border-b border-[var(--border-default)] shrink-0 gap-1">
        {/* Title + history toggle */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`flex items-center justify-center w-5 h-5 rounded transition-all duration-150
              ${historyOpen ? "text-[var(--text-primary)] rotate-90" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            title="会话历史"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </button>
          <input
            type="text"
            value={activeConversation?.title || "新对话"}
            onChange={(e) => dispatch({ type: "SET_CONVERSATION_TITLE", title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none
                       border-b border-transparent hover:border-[var(--border-default)]
                       focus:border-[var(--border-focus)] truncate px-1 py-0.5 transition-colors min-w-0"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Copy last */}
          <button
            onClick={handleCopyLast}
            disabled={!messages.some((m) => m.role === "assistant" && m.content)}
            className="relative flex items-center justify-center w-7 h-7 rounded-md
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--surface-hover)] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title={copied ? "已复制" : "复制回复"}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Clear */}
          <button
            onClick={() => dispatch({ type: "CLEAR_CONVERSATION" })}
            disabled={messages.length === 0}
            className="flex items-center justify-center w-7 h-7 rounded-md
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--surface-hover)] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="清空对话"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          {/* Regenerate */}
          <button
            onClick={() => dispatch({ type: "REGENERATE" })}
            disabled={!messages.some((m) => m.role === "assistant")}
            className="flex items-center justify-center w-7 h-7 rounded-md
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--surface-hover)] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="重新生成"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>

          {/* New conversation */}
          <button
            onClick={() => dispatch({ type: "NEW_CONVERSATION" })}
            className="flex items-center justify-center w-7 h-7 rounded-md
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--surface-hover)] transition-colors"
            title="新建对话"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== Conversation History Dropdown ===== */}
      {historyOpen && (
        <div className="border-b border-[var(--border-default)] max-h-[160px] overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => { dispatch({ type: "SWITCH_CONVERSATION", id: c.id }); setHistoryOpen(false); }}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors
                ${c.id === activeConversationId
                  ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{c.title || "新对话"}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {c.messages.length} 条消息
                </div>
              </div>
              {conversations.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "DELETE_CONVERSATION", id: c.id }); }}
                  className="opacity-0 hover:opacity-100 flex items-center justify-center w-5 h-5 rounded
                             text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--status-danger-hover)]"
                  title="删除"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <AiChatMessages />
      </div>

      {/* Input — pass streaming state */}
      <AiChatInput isStreaming={isStreaming} />
    </div>
  );
}
