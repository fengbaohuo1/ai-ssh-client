import { useState, useMemo } from "react";
import type { ChatMessage, StepEvent } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * 规整换行——密度区分 artifact 和段落：
 *   每 10 个有效字出现超过 1 个 \n\n → 全去掉（Spring AI artifact）
 *   否则 → 3+ \n 压缩为 \n\n（保留真实段落分隔）
 */
function norm(s: string): string {
  const breaks = (s.match(/\n\n/g) || []).length;
  const len = s.replace(/\s/g, "").length || 1;
  if (breaks > 0 && len / breaks < 10) {
    return s.replace(/\n{2,}/g, "");
  }
  return s.replace(/\n{3,}/g, "\n\n");
}

/** 切割后的段落：文本段 或 合并的工具卡片 */
type Segment =
  | { type: "text"; content: string }
  | { type: "tool"; call: StepEvent; result: StepEvent | null };

/**
 * 将消息文本按步骤的 contentOffset 切割，步骤卡片穿插在对应段落之间。
 * tool_call + tool_result 合并为一张卡片。
 */
function interleaveSteps(content: string, steps: StepEvent[]): Segment[] {
  if (!steps || steps.length === 0) return [{ type: "text", content }];

  // 配对：tool_call 与 tool_result 按 FIFO 队列配对。
  // 后端可能连续发多个 tool_call（一次多命令）再连续发多个 tool_result，
  // 不能只配对"紧邻下一个 step"（会导致前面的 call 配不到 result，显示沙漏）。
  const results = steps.filter((s) => s.t === "tool_result");
  let resultIdx = 0;
  const merged: { call: StepEvent; result: StepEvent | null; offset: number }[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.t === "tool_call") {
      const result = resultIdx < results.length ? results[resultIdx++] : null;
      merged.push({ call: s, result, offset: s.contentOffset ?? 0 });
    }
  }
  if (merged.length === 0) return [{ type: "text", content }];

  const segments: Segment[] = [];
  let cursor = 0;

  for (const m of merged) {
    const offset = Math.min(m.offset, content.length);
    if (offset > cursor) {
      segments.push({ type: "text", content: content.slice(cursor, offset) });
    }
    segments.push({ type: "tool", call: m.call, result: m.result });
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
                  {norm(seg.content)}
                </ReactMarkdown>
              </div>
            );
          }
          return (
            <div key={`tool-${i}`} className="my-1">
              <MergedToolCard call={seg.call} result={seg.result} />
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

// ===== 合并的工具卡片 =====

/**
 * 合并 tool_call + tool_result 为一张卡片：命令 + 结果，可折叠
 */
function MergedToolCard({ call, result }: { call: StepEvent; result: StepEvent | null }) {
  const [open, setOpen] = useState(false);
  const command = jsonField(call.a, "command");
  const resultOk = result ? jsonField(result.r, "success") : null;
  const succeeded = resultOk !== "false" && resultOk !== null;

  return (
    <div
      className="bg-[var(--surface-app)] rounded-md border border-[var(--border-subtle)] overflow-hidden cursor-pointer
                  transition-colors duration-100 hover:border-[var(--border-default)]"
      onClick={() => setOpen(!open)}
    >
      {/* 折叠栏 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 select-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round"
             className={`text-[var(--text-tertiary)] transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
          <polyline points="9,18 15,12 9,6" />
        </svg>

        <span className={`flex-shrink-0 text-[11px] ${result ? (succeeded ? "text-[var(--status-success)]" : "text-[var(--status-error)]") : "text-[var(--status-warning)]"}`}>
          {result ? (succeeded ? "✓" : "✗") : "⏳"}
        </span>

        <span className="font-medium text-[11px] text-[var(--text-primary)]">
          {call.n || "executeCommand"}
        </span>

        {!open && command && (
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate ml-1">
            {command}
          </span>
        )}
      </div>

      {/* 展开内容 */}
      {open && (
        <div className="border-t border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
          {command && (
            <div className="px-3 py-1.5">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">命令</div>
              <pre className="text-[11px] font-mono text-[var(--terminal-green)] bg-[var(--surface-input)] rounded px-2 py-1
                             whitespace-pre-wrap break-all">{command}</pre>
            </div>
          )}
          {result && (() => {
            const output = jsonField(result.r, "output");
            if (!output) return null;
            return (
              <div className="px-3 py-1.5">
                <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">结果</div>
                <pre className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed
                                max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">{output}</pre>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/** 解析 JSON 字段 */
function jsonField(json: string | object | undefined | null, key: string): string {
  if (!json) return "";
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    if (typeof obj !== "object" || obj === null) return "";
    const val = (obj as Record<string, unknown>)[key];
    return val != null ? String(val) : "";
  } catch { return ""; }
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
