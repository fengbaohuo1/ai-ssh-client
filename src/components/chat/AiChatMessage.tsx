import { useState } from "react";
import type { ChatMessage, StepEvent } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
        {/* Tool call steps — 放在内容之前，按时间顺序 */}
        {!isUser && message.steps && message.steps.length > 0 && (
          <div className="mb-2 space-y-1">
            <ToolCallSteps steps={message.steps} />
          </div>
        )}

        {/* Message content with full Markdown */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="prose-custom break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content || ""}
            </ReactMarkdown>
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

// ===== 可折叠的工具调用步骤 =====

function ToolCallSteps({ steps }: { steps: StepEvent[] }) {
  // 配对 tool_call + tool_result
  const pairs: { call?: StepEvent; result?: StepEvent }[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].t === "tool_call") {
      const next = steps[i + 1];
      if (next?.t === "tool_result" && next.n === steps[i].n) {
        pairs.push({ call: steps[i], result: next });
        i++; // 跳过已配对的 result
      } else {
        pairs.push({ call: steps[i] });
      }
    } else if (steps[i].t === "tool_result") {
      pairs.push({ result: steps[i] });
    }
  }

  return (
    <>
      {pairs.map((pair, i) => (
        <ToolCallItem key={i} pair={pair} />
      ))}
    </>
  );
}

function ToolCallItem({ pair }: { pair: { call?: StepEvent; result?: StepEvent } }) {
  const hasContent = pair.call || pair.result;
  if (!hasContent) return null;
  const [open, setOpen] = useState(false);
  const { call, result } = pair;

  // 从 tool_call 参数 JSON 中提取命令
  const command = parseCommand(call?.a);
  // 从 tool_result 中提取返回摘要
  const resultSummary = result?.r ? result.r.slice(0, 60).trim() : "";

  return (
    <div
      className="bg-[var(--surface-app)] rounded-md border border-[var(--border-subtle)] overflow-hidden cursor-pointer
                  transition-colors duration-100 hover:border-[var(--border-default)]"
      onClick={() => setOpen(!open)}
    >
      {/* 折叠栏 (summary) */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 select-none">
        {/* 展开/折叠图标 */}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round"
          className={`text-[var(--text-tertiary)] transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>

        {/* 图标 */}
        {call ? (
          <span className="text-[var(--status-warning)] flex-shrink-0 text-[11px]">🔧</span>
        ) : (
          <span className="text-[var(--status-success)] flex-shrink-0 text-[11px]">✓</span>
        )}

        {/* 工具名 */}
        <span className="font-medium text-[11px] text-[var(--text-primary)]">
          {call?.n || result?.n || "工具"}
        </span>

        {/* 命令/结果摘要 */}
        {!open && (
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate ml-1">
            {command || resultSummary}
          </span>
        )}

        {/* Streaming indicator (只有 call 没有 result) */}
        {call && !result && (
          <span className="ml-auto flex-shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] animate-pulse" />
          </span>
        )}
      </div>

      {/* 展开内容 */}
      {open && (
        <div className="border-t border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
          {call && (
            <div className="px-3 py-1.5">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">命令</div>
              <div className="text-[11px] font-mono text-[var(--terminal-green)] bg-[var(--surface-input)] rounded px-2 py-1">
                $ {command || "(参数解析失败)"}
              </div>
            </div>
          )}
          {result?.r && (
            <div className="px-3 py-1.5 border-t border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">返回结果</div>
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed
                              max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
                {result.r}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 从 tool_call 的 args JSON 中提取 command 字段 */
function parseCommand(args?: string): string {
  if (!args) return "";
  try {
    const parsed = JSON.parse(args);
    return parsed.command || parsed.cmd || parsed.script || "";
  } catch {
    // 不是 JSON 则直接返回原文
    return args.length > 80 ? args.slice(0, 80) + "..." : args;
  }
}

// ===== Custom Markdown Components =====

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-[var(--surface-app)] text-[var(--terminal-cyan)] px-1.5 py-0.5 rounded-md text-[11px]
                     font-mono border border-[var(--border-subtle)]"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre
        className="bg-[var(--surface-app)] rounded-lg px-3 py-2 my-1.5 overflow-x-auto text-[11px]
                   border border-[var(--border-default)] font-mono"
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },

  p({ children }) {
    return <p className="my-1 last:mb-0">{children}</p>;
  },

  h1({ children }) {
    return <h1 className="text-sm font-bold my-2 text-[var(--text-primary)]">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-[13px] font-bold my-1.5 text-[var(--text-primary)]">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-xs font-semibold my-1 text-[var(--text-primary)]">{children}</h3>;
  },

  ul({ children }) {
    return <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-[var(--text-primary)]">{children}</li>;
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-bg)] underline hover:opacity-80"
      >
        {children}
      </a>
    );
  },

  table({ children }) {
    return (
      <div className="overflow-x-auto my-1.5">
        <table className="min-w-full text-[11px] border-collapse border border-[var(--border-default)]">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[var(--surface-app)]">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="border border-[var(--border-default)] px-2 py-1 font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-[var(--border-default)] px-2 py-1">{children}</td>;
  },

  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[var(--accent-bg)] pl-3 my-1.5 text-[var(--text-secondary)] italic">
        {children}
      </blockquote>
    );
  },

  hr() {
    return <hr className="my-2 border-[var(--border-subtle)]" />;
  },

  strong({ children }) {
    return <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>;
  },
};

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
