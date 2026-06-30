import { useRef, useEffect } from "react";
import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import AiChatMessage from "./AiChatMessage";

const quickPrompts = [
  { text: "检查磁盘空间", command: "检查一下这台服务器的磁盘空间使用情况" },
  { text: "查看运行服务", command: "查看当前正在运行的服务和进程" },
  { text: "分析系统日志", command: "分析最近的系统日志，找出可能的错误" },
];

/** Refined empty state — subtle, clean, no giant emoji */
function EmptyChat({ onPrompt }: { onPrompt: (cmd: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center select-none">
      {/* Subtle AI icon */}
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
      <p className="text-xs text-[var(--text-secondary)] mb-7 leading-relaxed">
        分析服务器状态 · 排查故障 · 生成运维脚本
      </p>

      {/* Quick prompt cards */}
      <div className="space-y-2 w-full max-w-[280px]">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt.text}
            onClick={() => onPrompt(prompt.command)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg
                       bg-[var(--surface-input)] hover:bg-[var(--surface-hover)]
                       text-xs text-[var(--text-primary)] transition-all duration-150
                       text-left border border-[var(--border-subtle)]
                       hover:border-[var(--border-default)]"
          >
            {/* Dot accent */}
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
  const dispatch = useChatDispatch();
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleQuickPrompt = (text: string) => {
    dispatch({ type: "SEND_MESSAGE", content: text });
  };

  if (messages.length === 0) {
    return <EmptyChat onPrompt={handleQuickPrompt} />;
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      {messages.map((msg) => (
        <AiChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
