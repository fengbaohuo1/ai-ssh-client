import { useEffect, useMemo, useState } from "react";
import type { StepEvent } from "../../../types";
import { MarkdownText } from "../markdown";
import { buildStepTree, type StepNode } from "./stepTree";

/**
 * 运行轨迹（Agent Trace）——把 SSE 步骤流渲染成一棵可折叠的树（树形逻辑见 stepTree.ts）。
 *
 * <p>三种卡片，由后端字段直接决定，不做形状猜测：
 * <pre>
 *   k=agent 或 带 request 的 tool_call  → 派发卡片（子智能体名 + 任务指令 + 子步骤 + 结论）
 *   带 tasks 的 tool_call               → 计划卡片（任务表：状态/依赖/耗时）
 *   其余 tool_call                      → 命令卡片（命令 + 输出 + 耗时）
 *   tool_result                         → 不单独成卡：按 id 合并进对应的调用卡片
 * </pre>
 */

/** 运行中步骤的实时秒数（终态用后端给的 ms；只有运行中的卡片会每秒重渲染） */
function useElapsedSeconds(step: StepEvent): number | null {
  const running = step.st === "running" && step.ms == null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (step.ms != null) return step.ms / 1000;
  return running ? (now - step.ts) / 1000 : null;
}

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "";
  if (seconds < 0.1) return "<0.1s"; // 校验类失败是毫秒级：显示 0.0s 反而像没数据
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

/** 状态点：运行中转圈 / 成功对勾 / 失败叉 */
function StatusDot({ step }: { step: StepEvent }) {
  if (step.st === "error") {
    return <span className="text-[11px] text-[var(--status-error)] flex-shrink-0">✗</span>;
  }
  if (step.st === "running") {
    return (
      <span
        className="w-2.5 h-2.5 rounded-full border border-[var(--text-tertiary)] border-t-[var(--accent-bg)]
                   animate-spin flex-shrink-0"
      />
    );
  }
  return <span className="text-[11px] text-[var(--status-success)] flex-shrink-0">✓</span>;
}

/** 状态胶囊文案 */
function statusLabel(step: StepEvent): { text: string; className: string } | null {
  if (step.st === "running") {
    return { text: "运行中", className: "text-[var(--status-info)]" };
  }
  if (step.st === "error") {
    return { text: "失败", className: "text-[var(--status-error)]" };
  }
  return null;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

/** 复制按钮（命令/输出/结论都用它，统一交互） */
function CopyButton({ value, title }: { value: string; title: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* 剪贴板不可用（无权限）时静默：不打断阅读 */
        }
      }}
      title={title}
      className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

/** 折叠箭头 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={`text-[var(--text-tertiary)] transition-transform duration-150 flex-shrink-0 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

interface TraceProps {
  steps: StepEvent[];
  /** 默认展开：运行中的卡片自动展开，让用户看到"它正在干什么" */
  defaultOpenRunning?: boolean;
}

/** 运行轨迹入口：一组根步骤 → 树 */
export default function StepTrace({ steps, defaultOpenRunning = true }: TraceProps) {
  const roots = useMemo(() => buildStepTree(steps), [steps]);
  if (roots.length === 0) return null;
  return (
    <div className="my-1.5 space-y-1">
      {roots.map((node) => (
        <StepNodeCard key={node.step.id} node={node} depth={0} defaultOpenRunning={defaultOpenRunning} />
      ))}
    </div>
  );
}

function StepNodeCard({
  node,
  depth,
  defaultOpenRunning,
}: {
  node: StepNode;
  depth: number;
  defaultOpenRunning: boolean;
}) {
  const { step, children } = node;
  const [open, setOpen] = useState(defaultOpenRunning && step.st === "running");
  const elapsed = useElapsedSeconds(step);

  const command = text(step.a?.command);
  const request = text(step.a?.request);
  const tasks = Array.isArray(step.a?.tasks) ? (step.a!.tasks as Array<Record<string, unknown>>) : null;
  const output = text(step.r?.output);
  const result = text(step.r?.result);
  const errorText = text(step.r?.error) || text(step.m);
  const isAgent = step.k === "agent" || (!!request && !command);
  const isPlan = !!tasks;
  const title = step.n || (isAgent ? "子智能体" : isPlan ? "批量派发" : "工具调用");
  const status = statusLabel(step);

  const headerLabel = command || request || (isPlan ? `${tasks!.length} 个任务` : "");

  return (
    <div className={depth > 0 ? "border-l border-[var(--border-subtle)] pl-2 ml-1" : ""}>
      <div
        className="bg-[var(--surface-app)] rounded-md border border-[var(--border-subtle)] overflow-hidden
                   transition-colors duration-100 hover:border-[var(--border-default)]"
      >
        {/* 折叠栏 */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none min-w-0"
          onClick={() => setOpen(!open)}
        >
          <Chevron open={open} />
          <StatusDot step={step} />

          {isAgent ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)] flex-shrink-0">
              子智能体
            </span>
          ) : isPlan ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)] flex-shrink-0">
              计划
            </span>
          ) : null}

          <span className="font-medium text-[11px] text-[var(--text-primary)] truncate flex-shrink-0 max-w-[45%]">
            {title}
          </span>

          {status ? (
            <span className={`text-[10px] flex-shrink-0 ${status.className}`}>{status.text}</span>
          ) : null}

          {step.att != null && step.att > 1 ? (
            <span className="text-[10px] text-[var(--status-warning)] flex-shrink-0">
              重试 {step.att}{step.maxAtt ? `/${step.maxAtt}` : ""}
            </span>
          ) : null}

          {!open && headerLabel ? (
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate ml-1">
              {headerLabel}
            </span>
          ) : null}

          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {elapsed != null ? (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                {formatSeconds(elapsed)}
              </span>
            ) : null}
            {children.length > 0 ? (
              <span className="text-[10px] text-[var(--text-tertiary)]">{children.length}</span>
            ) : null}
          </span>
        </div>

        {/* 展开内容 */}
        {open ? (
          <div className="border-t border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
            {/* 任务指令（派发） */}
            {request ? (
              <div className="px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">任务指令</div>
                  <CopyButton value={request} title="复制任务指令" />
                </div>
                <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--surface-input)]
                                rounded px-2 py-1 whitespace-pre-wrap break-all">{request}</pre>
              </div>
            ) : null}

            {/* 命令（工具） */}
            {command ? (
              <div className="px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">命令</div>
                  <CopyButton value={command} title="复制命令" />
                </div>
                <pre className="text-[11px] font-mono text-[var(--terminal-green)] bg-[var(--surface-input)]
                                rounded px-2 py-1 whitespace-pre-wrap break-all">{command}</pre>
              </div>
            ) : null}

            {/* 计划任务表 */}
            {isPlan ? (
              <div className="px-3 py-1.5 space-y-1">
                <div className="text-[10px] text-[var(--text-tertiary)]">任务</div>
                {tasks!.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-[var(--text-secondary)]">
                      {text(task.taskId) || `#${i + 1}`}
                    </span>
                    <span className="text-[var(--text-primary)] truncate">{text(task.agentName)}</span>
                    {Array.isArray(task.dependsOn) && task.dependsOn.length > 0 ? (
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        依赖 {task.dependsOn.map((d) => String(d)).join(", ")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {/* 子步骤（子智能体自己干了什么） */}
            {children.length > 0 ? (
              <div className="px-2 py-1.5 border-t border-[var(--border-subtle)]">
                {children.map((child) => (
                  <StepNodeCard
                    key={child.step.id}
                    node={child}
                    depth={depth + 1}
                    defaultOpenRunning={defaultOpenRunning}
                  />
                ))}
              </div>
            ) : null}

            {/* 输出（工具） */}
            {output ? (
              <div className="px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">输出</div>
                  <CopyButton value={output} title="复制输出" />
                </div>
                <pre className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed
                                max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">{output}</pre>
              </div>
            ) : null}

            {/* 结论（派发）/ 错误 */}
            {result ? (
              <div className="px-3 py-1.5 border-t border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">结论</div>
                <div className="text-[11px] max-h-[320px] overflow-y-auto">
                  <MarkdownText>{result}</MarkdownText>
                </div>
              </div>
            ) : null}

            {errorText ? (
              <div className="px-3 py-1.5 border-t border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--status-error)] mb-0.5">
                  {step.st === "error" ? "失败原因" : "说明"}
                </div>
                <pre className="text-[11px] font-mono text-[var(--status-error)] bg-[var(--surface-input)]
                                rounded px-2 py-1 whitespace-pre-wrap break-all">{errorText}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
