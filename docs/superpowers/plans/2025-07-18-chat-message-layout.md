# 聊天消息布局重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 消息从「带背景色的气泡」改为「无气泡 + 步骤按 contentOffset 穿插」

**Architecture:** 只改 `AiChatMessage.tsx` 一个文件，在渲染层把 `message.content` 按各 step 的 `contentOffset` 切割成 N+1 段，步骤卡片穿插在对应的段落之间。不改 ChatContext、不碰后端。

**Tech Stack:** React 18 + TypeScript + Tailwind v4 + ReactMarkdown

## Global Constraints

- 不改 `ChatContext.tsx` 的状态管理逻辑
- 不改后端 SSE 数据格式
- 不改 `ToolCallItem` 内部样式
- 不改 `StepEvent` 类型定义
- 不改 `AiChatMessages.tsx`（容器只负责排列）
- 用户气泡完全不受影响

---

### Task 1: 实现 `interleaveSteps` 工具函数 + 重构 AiChatMessage 渲染

**Files:**
- Modify: `src/components/chat/AiChatMessage.tsx`

**Interfaces:**
- Produces: `interleaveSteps(content, steps)` → `Segment[]`，其中 `Segment = { type: "text", content } | { type: "step", step }`

- [ ] **Step 1: 添加 `interleaveSteps` 函数**

在 AiChatMessage.tsx 文件顶部（import 之后、`Props` 接口之前）添加：

```typescript
/** 将文本按步骤的 contentOffset 切割，步骤卡片穿插在对应段落之间 */
type Segment =
  | { type: "text"; content: string }
  | { type: "step"; step: StepEvent };

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
    cursor = Math.max(cursor, offset); // 同一 offset 的多步骤不重复插入文本
  }

  if (cursor < content.length) {
    segments.push({ type: "text", content: content.slice(cursor) });
  }

  return segments;
}
```

- [ ] **Step 2: 重构 `AiChatMessage` 渲染逻辑**

将现有的整体气泡渲染改为：用户保持气泡不变，AI 消息无气泡 + 步骤穿插。

找到 `export default function AiChatMessage` 整个函数体，替换为：

```typescript
export default function AiChatMessage({ message }: Props) {
  const isUser = message.role === "user";

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
```

**改动要点说明：**
- 用户消息：提取为独立分支，移除 `message.steps` 渲染、多余嵌套
- AI 消息：外层 `div` 只有 `flex justify-start`（位置占位），内层 `w-full min-w-0`（无背景、无边、无 max-width）
- `segments` 数组驱动渲染：文本段→`ReactMarkdown`，步骤段→`ToolCallItem`
- 步骤之间通过外层 `my-1` 保持间距
- `useMemo` 避免在文本流式更新时重复切割（steps 不变时跳过）

- [ ] **Step 3: 确认移除旧的 debug log**

确认已移除以下不再需要的调试代码：
  - `console.log("[ChatMsg] rendering steps:", ...)` 可以保留（对调试有用）
  - `console.log("[ToolCallItem] step=", ...)` 可以保留
  - `console.log("[jsonField] typeof=", ...)` 可以保留

- [ ] **Step 4: 验证编译通过**

```bash
cd D:/study/ai-ssh/ai-ssh-client && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/components/chat/AiChatMessage.tsx
git commit -m "refactor: AI 消息无气泡 + 步骤按 contentOffset 穿插布局"
```
