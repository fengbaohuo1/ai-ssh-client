import { useRef, useEffect, useState, useCallback } from "react";
import { useChatState, useChatActions } from "../../contexts/ChatContext";
import { useSshState } from "../../contexts/SshContext";
import AiChatMessage from "./AiChatMessage";

const quickPrompts = [
  { text: "检查磁盘空间", command: "检查一下这台服务器的磁盘空间使用情况" },
  { text: "查看运行服务", command: "查看当前正在运行的服务和进程" },
  { text: "分析系统日志", command: "分析最近的系统日志，找出可能的错误" },
];

/** 空态：没有对话时给出可直接发起的入口（点击即真正发起，不再是"假发送"） */
function EmptyChat({ onPrompt, disabled, boundServerName }: {
  onPrompt: (cmd: string) => void;
  disabled: boolean;
  boundServerName?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-input)] flex items-center justify-center mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             className="text-[var(--text-secondary)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M6 10h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
          <circle cx="9" cy="16" r="1" />
          <circle cx="15" cy="16" r="1" />
        </svg>
      </div>

      <p className="text-sm text-[var(--text-primary)] mb-1 font-medium">AI 助手</p>
      <p className="text-xs text-[var(--text-secondary)] mb-2 leading-relaxed">
        分析服务器状态 · 排查故障 · 生成运维脚本
      </p>
      <p className="text-[10px] text-[var(--text-tertiary)] mb-6">
        {boundServerName ? `当前绑定：${boundServerName}` : "当前为纯对话模式（未绑定服务器，AI 无法执行命令）"}
      </p>

      <div className="space-y-2 w-full max-w-[280px]">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt.text}
            onClick={() => onPrompt(prompt.command)}
            disabled={disabled}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg
                       bg-[var(--surface-input)] hover:bg-[var(--surface-hover)]
                       text-xs text-[var(--text-primary)] transition-all duration-150
                       text-left border border-[var(--border-subtle)]
                       hover:border-[var(--border-default)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-bg)] flex-shrink-0" />
            <span>{prompt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AiChatMessages() {
  const { conversations, activeConversationId } = useChatState();
  const { sendMessage } = useChatActions();
  const { servers, activeConnectionId } = useSshState();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];
  const lastMessage = messages[messages.length - 1];
  const streaming = lastMessage?.streaming === true;
  const boundServerName = servers.find((s) => s.id === activeConnectionId)?.name;

  // 只有"用户就在底部"才自动跟随；往上翻时不再被强行拽回（流式期间用 instant 避免抖动）
  useEffect(() => {
    if (!pinned) return;
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
  }, [messages.length, lastMessage?.content, lastMessage?.steps?.length, streaming, pinned]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 80);
  }, []);

  const handleQuickPrompt = useCallback(
    (text: string) => {
      if (streaming) return;
      sendMessage(text, activeConnectionId ?? undefined);
    },
    [streaming, sendMessage, activeConnectionId]
  );

  if (messages.length === 0) {
    return (
      <EmptyChat
        onPrompt={handleQuickPrompt}
        disabled={streaming}
        boundServerName={boundServerName}
      />
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-col gap-3 p-4 h-full overflow-y-auto"
      >
        {messages.map((msg) => (
          <AiChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 上翻时给一个"回到底部"的入口，而不是强行滚动 */}
      {!pinned ? (
        <button
          onClick={() => {
            setPinned(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[10px]
                     bg-[var(--surface-dropdown)] border border-[var(--border-default)]
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                     shadow-sm transition-colors"
        >
          回到底部
        </button>
      ) : null}
    </div>
  );
}
