# SSH 终端体验修复与增强计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 4 个终端体验问题：切换标签页不丢失状态、连接状态不显示断开信息、连接状态切换开关、标签页归属明确

**Architecture:** 全部为前端改动，不涉及后端。核心思路是 TerminalPanel 改为同时渲染所有标签页（仅隐藏非活跃的），防止 xterm/WebSocket 实例被销毁。SshServerItem 增加切换开关替代小圆点。

**Tech Stack:** React 19 + TypeScript + xterm + WebSocket

## Global Constraints

- 所有 TerminalView 实例始终挂载（非活跃的用 CSS `display:none` 隐藏）
- WebSocket 连接只在标签页关闭时断开，切换不中断
- SSH 列表的切换开关：点击连接状态开关可一键连接/断开
- 终端标签页显示服务器名称，新建空终端（无 serverId）标记为"本地终端"

---

### Task 1: TerminalPanel 改为全部渲染

**Files:**
- Modify: `src/components/terminal/TerminalPanel.tsx`

**Problem:** `TerminalPanel` 通过 `tabs.find(t => t.id === activeTabId)` 只取当前活跃标签，用 `key={activeTab.id}` 渲染，切换标签时 TerminalView 被卸载，WebSocket 和 xterm 实例全部丢失。

**Solution:** 渲染所有标签页，非活跃的用 `display: none` 隐藏。

- [ ] **Step 1: 修改 TerminalPanel**

```tsx
// src/components/terminal/TerminalPanel.tsx
import { useTerminalState } from "../../contexts/TerminalContext";
import TerminalTabs from "./TerminalTabs";
import TerminalView from "./TerminalView";

export default function TerminalPanel() {
  const { tabs, activeTabId } = useTerminalState();

  return (
    <div className="flex flex-col h-full bg-[var(--surface-app)]">
      <TerminalTabs />

      <div className="flex-1 relative">
        {tabs.length === 0 ? (
          /* Empty state */
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-input)] flex items-center justify-center mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   className="text-[var(--text-secondary)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M6 7l4 4-4 4" />
                <line x1="13" y1="15" x2="17" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-primary)] mb-1 font-medium">终端</p>
            <p className="text-xs text-[var(--text-secondary)]">
              从左侧双击服务器以连接，或点击上方 + 新建终端
            </p>
          </div>
        ) : (
          /* 渲染所有标签页，非活跃的隐藏 */
          tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: tab.id === activeTabId ? "block" : "none" }}
            >
              <TerminalView tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 3: 提交**

```bash
git add src/components/terminal/TerminalPanel.tsx
git commit -m "fix: 终端标签页切换不再销毁 xterm/WebSocket 实例"
```

---

### Task 2: 移除初始断连消息

**Files:**
- Modify: `src/hooks/useTerminalWebSocket.ts`

**Problem:** WebSocket 的 `onclose` 每次连接关闭都会输出 `[连接已断开]`，包括初始建立连接时的瞬断或标签页切换导致的关闭。需要区分"有意断开"和"意外断开"。

- [ ] **Step 1: 优化 useTerminalWebSocket**

```typescript
// src/hooks/useTerminalWebSocket.ts — 关键修改
import { useRef, useCallback, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";

export function useTerminalWebSocket(
  terminalRef: RefObject<Terminal | null>,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalRef = useRef(false); // ← 新增：标记有意断开

  const connectWs = useCallback(() => {
    if (!connectionId) return;

    const url = `ws://localhost:8091/ws/terminal/${connectionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    intentionalRef.current = false; // ← 重置标记

    ws.onopen = () => {
      onStatusChange?.("connected");
      terminalRef.current?.focus();
    };

    ws.onmessage = (event) => {
      terminalRef.current?.write(event.data);
    };

    ws.onclose = () => {
      onStatusChange?.("disconnected");
      // ← 只有意外断开才显示消息
      if (!intentionalRef.current) {
        terminalRef.current?.write("\r\n\x1b[31m[连接已断开]\x1b[0m\r\n");
      }
    };

    ws.onerror = () => {
      onStatusChange?.("error");
    };
  }, [connectionId, terminalRef, onStatusChange]);

  const sendData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const disconnectWs = useCallback(() => {
    intentionalRef.current = true; // ← 标记为有意断开
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData, disconnectWs };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/hooks/useTerminalWebSocket.ts
git commit -m "fix: 区分有意/意外断开，避免误显断开信息"
```

---

### Task 3: SSH 列表增加滑动开关

**Files:**
- Modify: `src/components/ssh/SshServerItem.tsx`

**Problem:** 当前连接状态用一个小圆点表示，不够直观。需要替换为一个可点击的滑动开关（Toggle Switch），点击可直接连接/断开。

- [ ] **Step 1: 替换状态小圆点为滑动开关**

将 SshServerItem 中的状态圆点替换为一个 CSS toggle switch：

```tsx
// SshServerItem.tsx — 替换连接状态圆点部分

// 将之前的小圆点 div 替换为：
<button
  onClick={async (e) => {
    e.stopPropagation();
    if (isConnected) {
      await disconnectServer(server.id);
    } else {
      const res = await connectServer(server.id);
      if (res?.code === "0000") {
        terminalDispatch({ type: "OPEN_TAB", serverId: server.id, serverName: server.name });
      }
    }
  }}
  className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
    isConnected
      ? "bg-[var(--status-success)]"
      : "bg-[var(--text-tertiary)]"
  }`}
  title={isConnected ? "点击断开" : "点击连接"}
>
  <div
    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
      isConnected ? "translate-x-4" : "translate-x-0"
    }`}
  />
</button>
```

Toggle Switch CSS 要点：
- 容器：`w-9 h-5 rounded-full`，连接时绿色背景，未连接时灰色
- 滑块：`w-4 h-4 rounded-full bg-white`，连接时 `translate-x-4`（滑到右边）
- `stopPropagation` 阻止触发双击打开终端

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ssh/SshServerItem.tsx
git commit -m "feat: SSH 列表连接状态改为滑动开关"
```

---

### Task 4: 终端标签页归属明确化

**Files:**
- Modify: `src/components/terminal/TerminalTabs.tsx`

**Problem:** 标签页只显示 `serverName`，但当有多个 SSH 终端时，用户难以区分。新建的空白终端（无 serverId）显示为"终端 N"也难以判断用途。需要让每个 SSH 连接的标签页更清晰，并在标签页上显示 SSH 标识。

- [ ] **Step 1: 增强 TerminalTabs 显示**

```tsx
// TerminalTabs.tsx — 标签页显示增强

// 在每个标签的 serverName 旁增加 SSH 标识图标
// 有 serverId 的显示 SSH 图标，无 serverId 的显示终端图标

// 修改标签渲染部分（Tab 按钮内，serverName 前面）：
{tab.serverId ? (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" />
  </svg>
) : (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path d="M6 7l4 4-4 4" />
    <line x1="13" y1="15" x2="17" y2="15" />
  </svg>
)}

{/* 服务器名称或终端名称 */}
<span className="truncate max-w-[120px]">
  {tab.serverName || `终端 ${tab.id.replace("term-", "")}`}
</span>
```

同时，修改新建空白终端的 serverName，使其默认可区分：

```typescript
// TerminalContext.tsx — OPEN_TAB 中，无 serverId 时使用不同名称
case "OPEN_TAB": {
  const newTab: TerminalTab = {
    id: `term-${nextTabId++}`,
    serverId: action.serverId,
    serverName: action.serverName,
    status: "disconnected",
  };
  return {
    tabs: [...state.tabs, newTab],
    activeTabId: newTab.id,
  };
}
```

无 serverId 的终端已在组件层面显示为"终端 N"，无需修改 context。

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/terminal/TerminalTabs.tsx
git commit -m "feat: 终端标签页增加 SSH 图标标识，归属更清晰"
```

---

## 完整文件变更清单

| # | 文件 | 操作 |
|---|---|---|
| 1 | `src/components/terminal/TerminalPanel.tsx` | **修改** — 全部标签页渲染，非活跃隐藏 |
| 2 | `src/hooks/useTerminalWebSocket.ts` | **修改** — 区分有意/意外断开 |
| 3 | `src/components/ssh/SshServerItem.tsx` | **修改** — 状态圆点→滑动开关 |
| 4 | `src/components/terminal/TerminalTabs.tsx` | **修改** — 标签页增加 SSH 图标 |

---

## 验证方式

1. 双击 SSH 服务器 → 终端打开，不显示"[连接已断开]"消息
2. 切换终端标签页 → 之前的终端状态保留，命令历史可见
3. SSH 列表有滑动开关，绿色=已连接，灰色=未连接，点击可切换
4. 终端标签页有 SSH 图标，一眼看出归属
