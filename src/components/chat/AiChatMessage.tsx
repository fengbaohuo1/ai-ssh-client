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
        {/* AI 消息：步骤按时间线穿插在文本中 */}
        {!isUser && message.steps && message.steps.length > 0 ? (
          <InterleavedContent content={message.content} steps={message.steps} />
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="prose-custom break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {normalizeContent(message.content) || ""}
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

// ===== 时间线穿插渲染 =====

/**
 * 将文本按步骤的 contentOffset 切段，步骤穿插在对应位置。
 * contentOffset 基于原始 content（未归一化），所以 cursor 也在原始 content 上移动。
 * 每个文本段单独归一化再渲染，避免破坏表格等 Markdown 格式。
 */
function InterleavedContent({ content, steps }: { content: string; steps: StepEvent[] }) {
  const sorted = [...steps].sort((a, b) => (a.contentOffset ?? 0) - (b.contentOffset ?? 0));

  const segments: React.ReactNode[] = [];
  let cursor = 0;

  for (const step of sorted) {
    const offset = step.contentOffset ?? 0;
    // 1) 原始 content 上截段，cursor/offset 对齐原始长度
    if (offset > cursor && cursor < content.length) {
      const raw = content.slice(cursor, Math.min(offset, content.length));
      if (raw.trim()) {
        segments.push(
          <div key={`t-${cursor}`} className="prose-custom break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {raw}
            </ReactMarkdown>
          </div>
        );
      }
    }
    cursor = Math.max(cursor, offset);
    // 2) 步骤卡片
    segments.push(<ToolCallSteps key={`s-${cursor}`} steps={[step]} />);
  }

  // 3) 剩余尾部
  if (cursor < content.length) {
    const rest = content.slice(cursor);
    segments.push(
      <div key={`t-${cursor}`} className="prose-custom break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {rest}
        </ReactMarkdown>
      </div>
    );
  }

  return <div className="space-y-1">{segments}</div>;
}

// ===== 可折叠的工具调用卡片 =====

/**
 * 解析 JSON 字段，支持普通 JSON 和 SshExecuteAdkTool 返回的带 output 字段的 Map JSON。
 */
function jsonField(json: string | object | undefined | null, key: string): string {
  if (!json) return "";
  try {
    // 后端现在发的是 JSON 对象（不再是字符串），需要兼容两种输入
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    const val = (obj as Record<string, unknown>)[key];
    if (val === null || val === undefined) return "";
    return String(val);
  } catch {
    return "";
  }
}

function ToolCallSteps({ steps }: { steps: StepEvent[] }) {
  return (
    <>
      {steps.map((step, i) => (
        <ToolCallItem key={i} step={step} />
      ))}
    </>
  );
}

function ToolCallItem({ step }: { step: StepEvent }) {
  const [open, setOpen] = useState(false);
  const isCall = step.t === "tool_call";

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
            {command || resultOutput}
          </span>
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

// ===== Content Normalization =====

/**
 * 归一化 LLM 输出内容：压缩连续的 \n\n Token 碎片为空格，
 * 避免每字一段的渲染问题。
 */
/**
 * 归一化 LLM 流式输出的换行符碎块（保护代码块和表格）。
 * - 代码块 ``` ``` 内部不动
 * - 表格行（以 | 开头）之间的换行保留
 * - 其他位置的连续 \n 合并为空格
 */
function normalizeContent(text: string): string {
  const blocks: string[] = [];
  // 1) 保护代码块
  let s = text.replace(/```[\s\S]*?```/g, (m) => {
    blocks.push(m);
    return `\0CODE${blocks.length - 1}\0`;
  });

  // 2) 保护表格（连续以 | 开头的行之间只保留 \n，不合并为空格）
  //    先统一换行符
  s = s.replace(/\r\n/g, '\n');
  //    把连续的表格行之间的空行干掉（表格行之间不需要 \n\n）
  s = s.replace(/(\n\|[^\n]*)\n{2,}(?=\|)/g, '$1\n');

  // 3) 其他位置的连续 \n 合并为空格
  s = s
    .replace(/\n{3,}/g, '\n\n')     // 3+ → 段落分隔
    .replace(/\n{2}/g, ' ')          // 2 → 空格（合并碎块）
    .replace(/ {2,}/g, ' ')
    .trim();

  // 4) 恢复代码块
  return s.replace(/\0CODE(\d+)\0/g, (_, idx) => blocks[parseInt(idx)] || "");
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
