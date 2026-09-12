import { useMemo } from "react";
import type { ChatMessage } from "../../types";
import { MarkdownText } from "./markdown";
import StepTrace from "./steps/StepTrace";
import { interleaveSteps } from "./steps/stepTree";

interface Props {
  message: ChatMessage;
}

export default function AiChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  const segments = useMemo(
    () => (isUser ? [] : interleaveSteps(message.content, message.steps || [])),
    [isUser, message.content, message.steps]
  );

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

  return (
    <div className="flex justify-start">
      <div className="w-full min-w-0 text-xs leading-relaxed">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <div key={`t-${i}`} className="prose-custom break-words">
              <MarkdownText>{seg.content}</MarkdownText>
            </div>
          ) : (
            <StepTrace key={`trace-${i}`} steps={seg.steps} />
          )
        )}

        {/* 空泡期/思考中：后端 thinking 事件之后的等待有明确反馈，而不是一片空白 */}
        {message.thinking && !message.content ? (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] py-1">
            <span className="w-2.5 h-2.5 rounded-full border border-[var(--text-tertiary)] border-t-[var(--accent-bg)] animate-spin" />
            正在分析…
          </div>
        ) : null}

        {/* Streaming cursor */}
        {message.streaming && message.content ? (
          <span className="inline-block w-1.5 h-3.5 bg-[var(--text-primary)] ml-0.5 animate-pulse align-middle rounded-sm" />
        ) : null}

        {/* 错误（后端 error 步骤 / 请求失败）：原因必须看得见 */}
        {message.errorText ? (
          <div className="mt-1.5 rounded-md border border-[var(--status-error)]/40 bg-[var(--status-error)]/5 px-2.5 py-1.5">
            <div className="text-[10px] text-[var(--status-error)] mb-0.5">执行失败</div>
            <div className="text-[11px] text-[var(--text-secondary)] break-words">{message.errorText}</div>
          </div>
        ) : null}

        {/* 状态行：时间 + token/缓存 + 中断提示 */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[10px] text-[var(--text-tertiary)]">{formatTime(message.timestamp)}</span>

          {message.status === "stopped" ? (
            <span className="text-[10px] text-[var(--status-warning)]">已停止</span>
          ) : null}
          {message.stopReason && message.stopReason !== "completed" && message.status !== "stopped" ? (
            <span className="text-[10px] text-[var(--status-warning)]">
              本轮中断（{message.stopReason === "error" ? "执行错误" : message.stopReason}）
            </span>
          ) : null}

          {message.usage && message.usage.totalTokens > 0 ? (
            <span
              className="text-[10px] text-[var(--text-tertiary)]"
              title={`本回合累计：输入 ${message.usage.promptTokens} · 输出 ${message.usage.completionTokens} · 缓存命中 ${message.usage.cachedTokens}`}
            >
              ↑{formatTokens(message.usage.promptTokens)} ↓{formatTokens(message.usage.completionTokens)}
              {message.usage.cachedTokens > 0 ? (
                <span className="text-[var(--status-success)]"> · 缓存 {formatTokens(message.usage.cachedTokens)}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 1200 → 1.2K（token 数太长的可读性问题） */
function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}K`;
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
