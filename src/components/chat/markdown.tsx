import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * 规整换行——密度区分 artifact 和段落：
 *   每 10 个有效字出现超过 1 个 \n\n → 全去掉（Spring AI artifact）
 *   否则 → 3+ \n 压缩为 \n\n（保留真实段落分隔）
 */
export function norm(s: string): string {
  const breaks = (s.match(/\n\n/g) || []).length;
  const len = s.replace(/\s/g, "").length || 1;
  if (breaks > 0 && len / breaks < 10) {
    return s.replace(/\n{2,}/g, "");
  }
  return s.replace(/\n{3,}/g, "\n\n");
}

/** 助手正文与子智能体结论共用的 markdown 渲染（同一套排版，避免两处样式漂移） */
export function MarkdownText({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {norm(children)}
    </ReactMarkdown>
  );
}

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
