import { useRef, useEffect } from "react";
import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import AiChatMessage from "./AiChatMessage";

const quickPrompts = [
  { text: "检查磁盘空间", icon: "💾", command: "检查一下这台服务器的磁盘空间使用情况" },
  { text: "查看运行服务", icon: "⚙️", command: "查看当前正在运行的服务和进程" },
  { text: "分析系统日志", icon: "📋", command: "分析最近的系统日志，找出可能的错误" },
];

export default function AiChatMessages() {
  const { conversations, activeConversationId } = useChatState();
  const dispatch = useChatDispatch();
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );
  const messages = activeConversation?.messages || [];

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleQuickPrompt = (text: string) => {
    dispatch({ type: "SEND_MESSAGE", content: text });
    // TODO: 后续对接真实 AI API 时实现流式回复
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-3xl mb-4 opacity-50">🤖</div>
        <p className="text-sm text-[#cccccc] mb-1">AI 助手</p>
        <p className="text-xs text-[#858585] mb-6">
          我可以帮你分析服务器状态、排查问题、生成脚本
        </p>

        <div className="space-y-2 w-full max-w-[260px]">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.text}
              onClick={() => handleQuickPrompt(prompt.command)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                         bg-[#333] hover:bg-[#37373d] text-xs text-[#cccccc]
                         transition-colors text-left border border-[#3c3c3c]"
            >
              <span className="text-base">{prompt.icon}</span>
              <span>{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
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
