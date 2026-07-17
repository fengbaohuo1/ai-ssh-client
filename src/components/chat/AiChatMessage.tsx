import type { ChatMessage } from "../../types";

interface Props {
  message: ChatMessage;
}

export default function AiChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
          isUser
            ? "bg-[var(--accent-bg)] text-white rounded-br-md"
            : "bg-[var(--surface-input)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-subtle)]"
        }`}
      >
        {/* Message content with markdown */}
        <div className="whitespace-pre-wrap break-words">
          {renderMarkdown(message.content)}
        </div>

        {/* Tool call steps (only for assistant messages) */}
        {!isUser && message.steps && message.steps.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]
                           bg-[var(--surface-app)] rounded-md px-2 py-1.5 border border-[var(--border-subtle)]"
              >
                {step.t === "tool_call" ? (
                  <>
                    <span className="text-[var(--status-warning)] flex-shrink-0">🔧</span>
                    <div className="min-w-0">
                      <span className="font-medium text-[var(--text-primary)]">{step.n}</span>
                      {step.a && (
                        <span className="ml-1 text-[var(--text-tertiary)] font-mono break-all">
                          {truncate(step.a, 60)}
                        </span>
                      )}
                    </div>
                  </>
                ) : step.t === "tool_result" ? (
                  <>
                    <span className="text-[var(--status-success)] flex-shrink-0">✓</span>
                    <span className="font-mono break-all text-[10px]">
                      {step.r ? truncate(step.r, 120) : "完成"}
                    </span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Streaming cursor */}
        {message.streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-[var(--text-primary)] ml-0.5 animate-pulse align-middle rounded-sm" />
        )}

        {/* Status */}
        {message.status === "sending" && (
          <span className="text-[10px] text-[var(--status-info)] ml-2">发送中...</span>
        )}
        {message.status === "error" && (
          <span className="text-[10px] text-[var(--status-error)] ml-2">发送失败</span>
        )}

        {/* Timestamp */}
        <div
          className={`text-[10px] mt-1.5 ${
            isUser ? "text-white/50" : "text-[var(--text-tertiary)]"
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ===== Simple Markdown Rendering =====
function renderMarkdown(content: string): React.ReactNode {
  if (!content) return null;

  const parts: React.ReactNode[] = [];
  const segments = content.split(/(```[\s\S]*?```)/g);

  segments.forEach((seg, i) => {
    if (seg.startsWith("```") && seg.endsWith("```")) {
      const code = seg.slice(3, -3).replace(/^[a-z]*\n?/, "");
      parts.push(
        <pre
          key={i}
          className="bg-[var(--surface-app)] rounded-lg px-3 py-2 my-1.5 overflow-x-auto text-[11px]
                     border border-[var(--border-default)] font-mono"
        >
          <code>{code.trim()}</code>
        </pre>
      );
    } else {
      const inlineParts = seg.split(/(`[^`]+`)/g).map((inline, j) => {
        if (inline.startsWith("`") && inline.endsWith("`")) {
          return (
            <code
              key={j}
              className="bg-[var(--surface-app)] text-[var(--terminal-cyan)] px-1.5 py-0.5 rounded-md text-[11px] font-mono border border-[var(--border-subtle)]"
            >
              {inline.slice(1, -1)}
            </code>
          );
        }
        // Bold **text**
        const boldParts = inline.split(/(\*\*[^*]+\*\*)/g).map((bold, k) => {
          if (bold.startsWith("**") && bold.endsWith("**")) {
            return (
              <strong key={k} className="font-semibold text-[var(--text-primary)]">
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

// ===== Helpers =====
function truncate(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  return s.slice(0, max) + "...";
}

// ===== Time Formatting =====
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
