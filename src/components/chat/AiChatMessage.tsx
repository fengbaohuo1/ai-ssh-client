import { useState, useMemo } from "react";
import type { ChatMessage, StepEvent } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/** 切割后的段落：文本段 或 步骤卡片 */
type Segment =
  | { type: "text"; content: string }
  | { type: "step"; step: StepEvent };

/**
 * 将消息文本按各步骤的 contentOffset 切割，步骤卡片穿插在对应段落之间。
 * 每个文本段独立传给 ReactMarkdown，避免 \n\n 跨段落干扰 Markdown 解析。
 */
function interleaveSteps(content: string, steps: StepEvent[]): Segment[] {
  if (!steps || steps.length === 0) return [{ type: "text", content }];

  const sorted = [...steps].sort(
    (a, b) => (a.contentOffset ?? 0) - (b.contentOffset ?? 0)
  );

  const segments: Segment[] = [];
  let cursor = 0;

  for (const step of sorted) {
    const offset = Math.min(step.contentOffset ?? 0, content.length);

    if (offset > cursor) {
      segments.push({ type: "text", content: content.slice(cursor, offset) });
    }

    segments.push({ type: "step", step });
    cursor = Math.max(cursor, offset);
  }

  if (cursor < content.length) {
    segments.push({ type: "text", content: content.slice(cursor) });
  }

  return segments;
}

interface Props {
  message: ChatMessage;
}

export default function AiChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  // [DEBUG] 步骤渲染
  if (!isUser && message.steps?.length) {
    console.log("[ChatMsg] rendering steps:", message.steps.length, message.steps);
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed bg-[var(--accent-bg)] text-white rounded-br-md">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
          <div className="text-[10px] mt-1.5 text-white/50">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // AI 消息：按 contentOffset 切割文本，步骤穿插
  const segments = useMemo(
    () => interleaveSteps(message.content, message.steps || []),
    [message.content, message.steps]
  );

  return (
    <div className="flex justify-start">
      <div className="w-full min-w-0 text-xs leading-relaxed">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return (
              <div key={`t-${i}`} className="prose-custom break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {seg.content}
                </ReactMarkdown>
              </div>
            );
          }
          return (
            <div key={`s-${i}`} className="my-1">
              <ToolCallItem step={seg.step} />
            </div>
          );
        })}

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
        <div className="text-[10px] text-[var(--text-tertiary)] mt-2">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ===== 可折叠的工具调用卡片 =====

/**
 * 解析 JSON 字段，支持普通 JSON 和 SshExecuteAdkTool 返回的带 output 字段的 Map JSON。
 */
function jsonField(json: string | object | undefined | null, key: string): string {
  if (!json) { console.warn("[jsonField] null input"); return ""; }
  try {
    console.log("[jsonField] typeof=", typeof json, "str=", JSON.stringify(json), "key=", key);
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    if (typeof obj !== "object" || obj === null) { console.warn("[jsonField] not object"); return ""; }
    const val = (obj as Record<string, unknown>)[key];
    if (val === null || val === undefined) return "";
    return String(val);
  } catch (e) {
    console.warn("[jsonField] caught:", e);
    return "";
  }
}

function ToolCallItem({ step }: { step: StepEvent }) {
  const [open, setOpen] = useState(false);
  const isCall = step.t === "tool_call";

  // [DEBUG] 完整 step 内容
  console.log("[ToolCallItem] step=", JSON.stringify(step), "keys=", Object.keys(step));

  const command = isCall ? jsonField(step.a, "command") : "";
  const resultOutput = !isCall ? jsonField(step.r, "output") : "";
  const resultOk = !isCall ? jsonField(step.r, "success") : null;

  return (
    <div
      className="bg-[var(--surface-app)] rounded-md border border-[var(--border-subtle)] overflow-hidden cursor-pointer
                  transition-colors duration-100 hover:border-[var(--border-default)]"
      onClick={() => setOpen(!open)}
    >
      {/* 折叠栏 (summary) */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 select-none">
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round"
          className={`text-[var(--text-tertiary)] transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>

        {isCall ? (
          <span className="text-[var(--status-warning)] flex-shrink-0 text-[11px]">🔧</span>
        ) : (
          <span className={`flex-shrink-0 text-[11px] ${resultOk === "false" ? "text-[var(--status-error)]" : "text-[var(--status-success)]"}`}>
            {resultOk === "false" ? "✗" : "✓"}
          </span>
        )}

        <span className="font-medium text-[11px] text-[var(--text-primary)]">
          {step.n || "工具"}
        </span>

        {!open && (
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate ml-1">
            {command || resultOutput || JSON.stringify(step.a || step.r || "")}
          </span>
        )}

        {/* [DEBUG] 步骤原始数据 */}
        {command || resultOutput ? null : (
          <span className="ml-auto text-[9px] text-[var(--status-error)] flex-shrink-0">空</span>
        )}

        {isCall && (
          <span className="ml-auto flex-shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] animate-pulse" />
          </span>
        )}
      </div>

      {/* 展开内容 */}
      {open && (
        <div className="border-t border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
          {isCall && command && (
            <div className="px-3 py-1.5">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">命令</div>
              <div className="text-[11px] font-mono text-[var(--terminal-green)] bg-[var(--surface-input)] rounded px-2 py-1">
                $ {command}
              </div>
            </div>
          )}
          {!isCall && resultOutput && (
            <div className="px-3 py-1.5">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">返回结果</div>
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed
                              max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
                {resultOutput}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
