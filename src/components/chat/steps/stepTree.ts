import type { StepEvent } from "../../../types";

/**
 * 运行轨迹的纯逻辑：扁平步骤 → 树 → 与正文交错的分段。
 *
 * <p>单独成模块（不引 React）的原因：这段逻辑是"协议 → 界面"的全部翻译，
 * 必须能脱离浏览器直接用真实 SSE 数据验证（脚本见 `.smoke6/check-render.mjs`）。
 */

/** 一棵步骤树：节点 = 一条步骤，children = 挂在它下面的步骤 */
export interface StepNode {
  step: StepEvent;
  children: StepNode[];
}

/** 渲染分段：正文段 或 运行轨迹段 */
export type Segment = { type: "text"; content: string } | { type: "trace"; steps: StepEvent[] };

/**
 * 结果步骤按 id 合并进调用步骤：同 id 的结果就是那条调用步骤本身（前端 upsert 语义的纯函数版）。
 * 结果到达顺序不保证（批量派发并发），所以只能认 id，不能按位置配对。
 *
 * <p><b>脊柱字段取首次出现的值</b>（{@code t/ts/contentOffset}）：一条步骤的"身份"是它的调用，
 * 结果只是把 r/st/ms 补进来。若让后到的 {@code tool_result} 覆盖 {@code t}，
 * 卡片会因为这个类型被当成"纯结果"而整张消失——冒烟时真踩过。
 */
export function mergeResults(steps: StepEvent[]): Map<string, StepEvent> {
  const merged = new Map<string, StepEvent>();
  for (const step of steps) {
    const existing = merged.get(step.id);
    merged.set(
      step.id,
      existing
        ? {
            ...existing,
            ...step,
            t: existing.t,
            ts: existing.ts,
            contentOffset: existing.contentOffset,
          }
        : step
    );
  }
  return merged;
}

/** 扁平步骤 → 树（p = 父步骤 id；自引用/找不到父节点的一律当根） */
export function buildStepTree(steps: StepEvent[]): StepNode[] {
  const nodes = new Map<string, StepNode>();
  for (const step of steps) {
    if (step.t === "tool_result") continue; // 结果已合并进调用卡片，不单独占位
    nodes.set(step.id, { step, children: [] });
  }

  const roots: StepNode[] = [];
  for (const step of steps) {
    const node = nodes.get(step.id);
    if (!node) continue;
    // 自引用（单派发：任务 id == 父工具调用 id）不算父子关系，否则会自己套自己
    const parent = step.p && step.p !== step.id ? nodes.get(step.p) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByTime = (list: StepNode[]) => list.sort((a, b) => a.step.ts - b.step.ts);
  sortByTime(roots);
  for (const node of nodes.values()) {
    sortByTime(node.children);
  }
  return roots;
}

/** 收集一棵子树（根 + 所有后代）的步骤，交给渲染层重建层级 */
export function collectSubtree(root: StepEvent, all: StepEvent[]): StepEvent[] {
  const collected: StepEvent[] = [];
  const walk = (step: StepEvent) => {
    collected.push(step);
    for (const candidate of all) {
      if (candidate.p === step.id && candidate.id !== step.id) {
        walk(candidate);
      }
    }
  };
  walk(root);
  return collected;
}

/**
 * 把消息按步骤的 contentOffset 切开，运行轨迹穿插在对应正文之间。
 *
 * <p>只对**根步骤**取锚点：子智能体的命令属于派发卡片内部，不参与正文分割
 * （否则正文会被子步骤的插入点切得七零八落）。
 */
export function interleaveSteps(content: string, steps: StepEvent[]): Segment[] {
  if (!steps || steps.length === 0) return [{ type: "text", content }];

  const unified = [...mergeResults(steps).values()];
  const roots = buildStepTree(unified);
  if (roots.length === 0) return [{ type: "text", content }];

  const anchored = roots
    .map((node) => ({ node, offset: Math.min(node.step.contentOffset ?? 0, content.length) }))
    .sort((a, b) => a.offset - b.offset);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const { node, offset } of anchored) {
    if (offset > cursor) {
      segments.push({ type: "text", content: content.slice(cursor, offset) });
    }
    const subtree = collectSubtree(node.step, unified);
    const previous = segments[segments.length - 1];
    // 同一锚点（offset 未前进）的多个根步骤合并成一个轨迹块：一次多命令时都在同一处
    if (previous && previous.type === "trace" && offset <= cursor) {
      previous.steps.push(...subtree);
    } else {
      segments.push({ type: "trace", steps: subtree });
    }
    cursor = Math.max(cursor, offset);
  }

  if (cursor < content.length) {
    segments.push({ type: "text", content: content.slice(cursor) });
  }
  return segments;
}

/** 树 → 便于阅读的文本（调试与冒烟脚本共用） */
export function describeTree(nodes: StepNode[], depth = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const s = node.step;
    const bits = [
      `${"  ".repeat(depth)}- ${s.t}`,
      s.n ? `n=${s.n}` : "",
      s.k ? `k=${s.k}` : "",
      s.st ? `st=${s.st}` : "",
      s.ms != null ? `ms=${s.ms}` : "",
      s.ag ? `ag=${s.ag}` : "",
      s.a?.command ? `cmd=${s.a.command}` : "",
    ].filter(Boolean);
    lines.push(bits.join(" "));
    lines.push(...describeTree(node.children, depth + 1));
  }
  return lines;
}
