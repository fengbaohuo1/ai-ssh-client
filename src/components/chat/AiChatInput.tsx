import { useState, useRef, useCallback } from "react";
import { useChatActions, useChatState } from "../../contexts/ChatContext";
import { useSshState } from "../../contexts/SshContext";
import { baseUrlHost, formatContextSize } from "../../api/chat";
import { toast } from "../../stores/toastStore";

export default function AiChatInput({ isStreaming }: { isStreaming: boolean }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, stopStreaming } = useChatActions();
  const { activeConnectionId } = useSshState();
  // 模型信息：来自后端配置（query_ai_agent_config_list → chatModel），只读展示
  const { agents, selectedAgentId, sending } = useChatState();
  const agent = agents.find((a) => a.agentId === selectedAgentId);
  const modelName = agent?.chatModel?.modelName;
  const contextSize = agent?.chatModel?.contextSize;

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || sending) return;
    // 未绑定服务器时提前提示：否则模型会在"没有终端会话"的状态下白跑几轮工具
    if (!activeConnectionId) {
      toast.warning("未绑定服务器", "请先在顶部选择并连接一台服务器，再让 AI 执行命令");
    }
    sendMessage(trimmed, activeConnectionId ?? undefined);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sending, sendMessage, activeConnectionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${newHeight}px`;
  }, []);

  return (
    <div className="border-t border-[var(--border-default)]">
      {/* ===== 输入区 ===== */}
      <div className="p-3 pb-2">
        <div className="bg-[var(--surface-input)] rounded-xl px-3.5 py-2.5
                        border border-transparent focus-within:border-[var(--border-focus)] transition-colors duration-150">
          {/* Textarea */}
          <div className="overflow-y-auto max-h-[150px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleInput(); }}
              onKeyDown={handleKeyDown}
              placeholder="输入命令或问题... (Enter 发送, Shift+Enter 换行)"
              className="w-full bg-transparent text-[var(--text-primary)] text-xs outline-none resize-none
                         placeholder:text-[var(--text-tertiary)] min-h-[20px] overflow-hidden"
              rows={1}
            />
          </div>

          {/* ===== 操作行（仅发送/停止——其余附件/指令均非后端能力，已移除） ===== */}
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-[var(--border-subtle)]">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0
                           bg-[var(--status-error)] hover:bg-red-600 text-white
                           transition-all duration-150 active:scale-95"
                title="停止生成（中断本次请求）"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0
                           bg-[var(--accent-bg)] hover:bg-[var(--accent-hover)] text-white
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-150 active:scale-95"
                title={sending ? "正在创建会话…" : "发送"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== 模型信息栏（只读，来自后端配置文件） ===== */}
      <div className="flex items-center gap-2.5 px-4 pb-2.5 min-w-0">
        <span className="flex items-center gap-1 flex-shrink-0">
          <label className="text-[10px] text-[var(--text-tertiary)]">模型</label>
          <span className="text-[11px] font-medium text-[var(--text-primary)] truncate max-w-[220px]" title={modelName}>
            {modelName ?? "配置加载中…"}
          </span>
        </span>
        {contextSize ? (
          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
            上下文 {formatContextSize(contextSize)}
          </span>
        ) : null}
        {agent?.agentName ? (
          <span className="min-w-0 truncate text-[10px] text-[var(--text-tertiary)]" title={agent.agentName}>
            · {agent.agentName}
          </span>
        ) : null}
        {agent?.chatModel?.baseUrl ? (
          <span
            className="text-[10px] text-[var(--text-tertiary)] truncate"
            title={`${agent.chatModel.baseUrl}（${agent.agentName}）`}
          >
            · {baseUrlHost(agent.chatModel.baseUrl)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
