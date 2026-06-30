import type { ChatMessage } from "../../types";

interface Props {
  message: ChatMessage;
}

export default function AiChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-[#0078d4] text-white rounded-br-sm"
            : "bg-[#333333] text-[#cccccc] rounded-bl-sm"
        }`}
      >
        {/* 消息内容 - 简单 Markdown 渲染 */}
        <div className="whitespace-pre-wrap break-words">
          {renderMarkdown(message.content)}
        </div>

        {/* 流式光标 */}
        {message.streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-[#cccccc] ml-0.5 animate-pulse align-middle" />
        )}

        {/* 状态指示 */}
        {message.status === "sending" && (
          <span className="text-[10px] text-blue-300 ml-2">发送中...</span>
        )}
        {message.status === "error" && (
          <span className="text-[10px] text-red-400 ml-2">发送失败</span>
        )}

        {/* 时间戳 */}
        <div
          className={`text-[10px] mt-1 ${
            isUser ? "text-blue-200" : "text-[#6a6a6a]"
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ===== 简单 Markdown 渲染 =====
function renderMarkdown(content: string): React.ReactNode {
  if (!content) return null;

  // 处理代码块 ```code```
  const parts: React.ReactNode[] = [];
  const segments = content.split(/(```[\s\S]*?```)/g);

  segments.forEach((seg, i) => {
    if (seg.startsWith("```") && seg.endsWith("```")) {
      // 代码块
      const code = seg.slice(3, -3).replace(/^[a-z]*\n?/, "");
      parts.push(
        <pre
          key={i}
          className="bg-[#1e1e1e] rounded px-2 py-1.5 my-1 overflow-x-auto text-[11px] border border-[#3c3c3c]"
        >
          <code>{code.trim()}</code>
        </pre>
      );
    } else {
      // 行内代码 `code`
      const inlineParts = seg.split(/(`[^`]+`)/g).map((inline, j) => {
        if (inline.startsWith("`") && inline.endsWith("`")) {
          return (
            <code
              key={j}
              className="bg-[#1e1e1e] text-[#e5e510] px-1 rounded text-[11px]"
            >
              {inline.slice(1, -1)}
            </code>
          );
        }
        // 加粗 **text**
        const boldParts = inline.split(/(\*\*[^*]+\*\*)/g).map((bold, k) => {
          if (bold.startsWith("**") && bold.endsWith("**")) {
            return (
              <strong key={k} className="font-semibold">
                {bold.slice(2, -2)}
              </strong>
            );
          }
          return bold;
        });
        return <span key={j}>{boldParts}</span>;
      });
      parts.push(<span key={i}>{inlineParts}</span>);
    }
  });

  return <>{parts}</>;
}

// ===== 时间格式化 =====
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
