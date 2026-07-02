# SSH 独立终端标签页架构重构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每个 SSH 连接拥有自己的终端标签页导航，tab 不跨服务器共享，"+"新建终端为当前选中 SSH 创建新会话

**Architecture:** 终端状态按 serverId 分组存储。左侧点击 SSH 服务器时，右侧终端区域切换为该服务器的标签页。移除全局共享的 tab 列表。

**Tech Stack:** React 19 + TypeScript + Zustand

## Global Constraints

- TerminalContext 按 serverId 分组存储 tabs
- 左侧点击 SSH 服务器时，右侧显示该服务器的终端标签页
- 每个 SSH 连接独立管理自己的 xterm/WebSocket 实例
- "+"按钮创建当前选中服务器的终端会话
- 无 serverId 的终端（本地终端）单独分组显示

---

### Task 1: 重构 TerminalContext——按 serverId 分组

**Files:**
- Modify: `src/contexts/TerminalContext.tsx`
- Modify: `src/types/index.ts` — TerminalTab 不修改，新增分组概念

**Problem:** 当前 TerminalState 是一个扁平 `tabs[]`，所有服务器共用。需要改为按 serverId 分组的 tabs。

**Solution:** 新增 `serverTabs: Record<string, TerminalTab[]>` + `activeServerId: string | null`。每个 serverId 维护自己的 tab 列表。

- [ ] **Step 1: 重写 TerminalState**

```typescript
import type { TerminalTab } from "../types";

interface TerminalState {
  serverTabs: Record<string, TerminalTab[]>;  // serverId → tabs
  activeServerId: string | null;              // 当前选中的服务器
  activeTabId: string | null;                 // 当前选中的标签页 ID
  // 无 server 的独立终端
  localTabs: TerminalTab[];
  activeLocalTabId: string | null;
}

type TerminalAction =
  | { type: "SET_ACTIVE_SERVER"; serverId: string }
  | { type: "OPEN_SERVER_TAB"; serverId: string; serverName: string }
  | { type: "CLOSE_SERVER_TAB"; serverId: string; tabId: string }
  | { type: "SET_ACTIVE_TAB"; tabId: string }
  | { type: "OPEN_LOCAL_TAB"; serverName: string }
  | { type: "CLOSE_LOCAL_TAB"; tabId: string }
  | { type: "UPDATE_TAB_STATUS"; tabId: string; status: TerminalTab["status"]; errorMessage?: string }
  | { type: "RESET_SERVER_TABS"; serverId: string };  // 断开连接后清空
```

- [ ] **Step 2: 实现 reducer**

```typescript
let nextTabId = 1;

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case "SET_ACTIVE_SERVER":
      return { ...state, activeServerId: action.serverId, activeTabId: null };

    case "OPEN_SERVER_TAB": {
      const newTab: TerminalTab = {
        id: `term-${nextTabId++}`,
        serverId: action.serverId,
        serverName: action.serverName,
        status: "disconnected",
      };
      const existing = state.serverTabs[action.serverId] || [];
      return {
        ...state,
        serverTabs: {
          ...state.serverTabs,
          [action.serverId]: [...existing, newTab],
        },
        activeTabId: newTab.id,
      };
    }

    case "CLOSE_SERVER_TAB": {
      const tabs = (state.serverTabs[action.serverId] || []).filter(t => t.id !== action.tabId);
      const newTabs = { ...state.serverTabs, [action.serverId]: tabs };
      if (tabs.length === 0) delete newTabs[action.serverId];
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        newActiveId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return { ...state, serverTabs: newTabs, activeTabId: newActiveId };
    }

    case "SET_ACTIVE_TAB":
      return { ...state, activeTabId: action.tabId };

    case "UPDATE_TAB_STATUS":
      return {
        ...state,
        serverTabs: Object.fromEntries(
          Object.entries(state.serverTabs).map(([sid, tabs]) => [
            sid,
            tabs.map(t => t.id === action.tabId ? { ...t, status: action.status, errorMessage: action.errorMessage } : t),
          ])
        ),
        localTabs: state.localTabs.map(t =>
          t.id === action.tabId ? { ...t, status: action.status, errorMessage: action.errorMessage } : t
        ),
      };

    // localTabs 处理（原有逻辑适配）
    default:
      return state;
  }
}
```

- [ ] **Step 3: 保留原有 action 兼容**

原有 `OPEN_TAB` 改为根据是否有 serverId 分配到对应分组。`CLOSE_TAB`, `SET_ACTIVE_TAB` 按 tabId 查找所属分组。

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/contexts/TerminalContext.tsx
git commit -m "refactor: 终端状态按 serverId 分组存储"
```

---

### Task 2: 修改 TerminalPanel——按当前选中服务器显示标签页

**Files:**
- Modify: `src/components/terminal/TerminalPanel.tsx`
- Modify: `src/components/terminal/TerminalTabs.tsx`

**Problem:** 当前 Panel 渲染所有标签页。需要改为只渲染当前选中服务器的标签页（或无 server 的本地终端）。

- [ ] **Step 1: TerminalPanel 根据 activeServerId 选择显示**

```tsx
// TerminalPanel.tsx
export default function TerminalPanel() {
  const { serverTabs, activeServerId, localTabs, activeTabId } = useTerminalState();

  // 当前显示的 tabs：优先显示 activeServerId 的标签页
  const currentTabs = activeServerId
    ? (serverTabs[activeServerId] || [])
    : localTabs;

  const isEmpty = currentTabs.length === 0;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-app)]">
      {/* 只有有标签页时才显示 tab bar */}
      {!isEmpty && (
        <TerminalTabs
          tabs={currentTabs}
          activeTabId={activeTabId}
          serverId={activeServerId}
        />
      )}

      <div className="flex-1 relative">
        {isEmpty ? (
          /* Empty state */
          <EmptyTerminalState />
        ) : (
          currentTabs.map((tab) => (
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

- [ ] **Step 2: TerminalTabs 改为接收 props**

```tsx
// TerminalTabs.tsx - 改为 props 驱动而非从 context 读取
interface Props {
  tabs: TerminalTab[];
  activeTabId: string | null;
  serverId: string | null;
}

export default function TerminalTabs({ tabs, activeTabId, serverId }: Props) {
  const dispatch = useTerminalDispatch();

  const handleNewTab = () => {
    if (serverId) {
      // 为当前服务器新建标签页
      // 需要知道 serverName，可以从 tabs[0] 获取
      dispatch({ type: "OPEN_SERVER_TAB", serverId, serverName: tabs[0]?.serverName || "终端" });
    } else {
      dispatch({ type: "OPEN_LOCAL_TAB", serverName: `终端 ${tabs.length + 1}` });
    }
  };

  // ... 渲染 tabs
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/terminal/TerminalPanel.tsx src/components/terminal/TerminalTabs.tsx
git commit -m "refactor: TerminalPanel 按选中服务器显示对应标签页"
```

---

### Task 3: SSH 列表点击切换终端上下文

**Files:**
- Modify: `src/components/ssh/SshServerItem.tsx`

**Problem:** 点击 SSH 服务器时需要通知 TerminalContext 切换为它的标签页。并且"+"应该是为当前服务器开新终端。

- [ ] **Step 1: 点击服务器时设置 activeServerId**

在 `SshServerItem` 的点击事件中（或双击时），dispatch `SET_ACTIVE_SERVER`：

```tsx
const handleSelectServer = () => {
  terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
};

// 在 div 的 onClick 中调用
<div onClick={handleSelectServer} ...>
```

双开终端时自动设置 activeServerId + 开标签页：

```tsx
const handleDoubleClick = useCallback(async () => {
  // 先切换到该服务器的上下文
  terminalDispatch({ type: "SET_ACTIVE_SERVER", serverId: server.id });
  
  try {
    const res = await connectServer(server.id);
    if (res?.code === "0000") {
      terminalDispatch({
        type: "OPEN_SERVER_TAB",
        serverId: server.id,
        serverName: server.name,
      });
    }
  } catch (err) {
    console.error("连接失败", err);
  }
}, [server.id, server.name, connectServer, terminalDispatch]);
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ssh/SshServerItem.tsx
git commit -m "refactor: SSH 列表点击切换终端上下文"
```

---

### Task 4: 关闭所有标签页时自动断开 SSH

**Files:**
- Modify: `src/contexts/TerminalContext.tsx`

**Problem:** 用户关掉某个 SSH 服务器的所有终端标签页后，SSH 连接仍然存在，浪费资源。

**Solution:** 在 `CLOSE_SERVER_TAB` 或 `RESET_SERVER_TABS` 中，当某 serverId 的 tabs 数为 0 时，触发断开 SSH 连接。

- [ ] **Step 1: 在 CLOSE_SERVER_TAB 中判断并触发断开**

```typescript
case "CLOSE_SERVER_TAB": {
  const tabs = (state.serverTabs[action.serverId] || []).filter(t => t.id !== action.tabId);
  const newTabs = { ...state.serverTabs };

  if (tabs.length === 0) {
    delete newTabs[action.serverId];
    // 所有标签页都关了 → 触发断开 SSH 连接
    // 通过一个回调或副作用来处理
    if (action.onAllClosed) {
      action.onAllClosed(action.serverId);
    }
  } else {
    newTabs[action.serverId] = tabs;
  }

  let newActiveId = state.activeTabId;
  if (state.activeTabId === action.tabId) {
    newActiveId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
  }
  return { ...state, serverTabs: newTabs, activeTabId: newActiveId };
}
```

或者更简洁的方式：在 `TerminalTabs` 组件中，当关闭最后一个 tab 时直接调 `disconnectServer`：

```typescript
// TerminalTabs.tsx — 关闭标签页前判断
const handleCloseTab = (tabId: string) => {
  if (tabs.length === 1 && serverId) {
    // 这是最后一个标签页，关闭后自动断开 SSH
    disconnectServer(serverId);
  }
  dispatch({ type: "CLOSE_SERVER_TAB", serverId, tabId }); 
  // 注意需要兼容旧的 action 格式
};
```

- [ ] **Step 2: 提交**

```bash
git add src/contexts/TerminalContext.tsx src/components/terminal/TerminalTabs.tsx
git commit -m "feat: 关闭所有终端标签页时自动断开 SSH 连接"
```

---

### Task 5: 修复连接断开消息

**Files:**

**Files:**
- Modify: `src/hooks/useTerminalWebSocket.ts`

**Problem:** `intentionalRef` 修复可能未覆盖所有场景。需要更可靠的方案：不在 `connectWs` 时重置标记，或首次连接成功前不写消息。

- [ ] **Step 1: 改用连接状态标记**

```typescript
export function useTerminalWebSocket(
  terminalRef: RefObject<Terminal | null>,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false);  // 是否曾经连接成功过

  const connectWs = useCallback(() => {
    if (!connectionId) return;
    const url = `ws://localhost:8091/ws/terminal/${connectionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      hasConnectedRef.current = true;
      onStatusChange?.("connected");
      terminalRef.current?.focus();
    };

    ws.onclose = () => {
      onStatusChange?.("disconnected");
      // 只有曾经连接成功过但意外断开的，才显示断开消息
      if (hasConnectedRef.current) {
        terminalRef.current?.write("\r\n\x1b[31m[连接已断开]\x1b[0m\r\n");
      }
      hasConnectedRef.current = false;
    };

    ws.onerror = () => {
      onStatusChange?.("error");
    };
  }, [connectionId, terminalRef, onStatusChange]);

  const disconnectWs = useCallback(() => {
    hasConnectedRef.current = false;  // 标记为未连接过，避免 onclose 写消息
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData: ..., disconnectWs };
}
```

关键区别：`hasConnectedRef` 只在 `ws.onopen` 后设为 `true`。如果 WebSocket 从未成功打开（初始连接失败或关闭），不会写断开消息。`disconnectWs` 时重置为 `false`，保证有意断开也不写消息。

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useTerminalWebSocket.ts
git commit -m "fix: 改用 hasConnectedRef 防止初始连接失败时误写断开消息"
```

---

## 完整文件变更清单

| # | 文件 | 操作 |
|---|---|---|
| 1 | `src/contexts/TerminalContext.tsx` | **重写** — 按 serverId 分组 |
| 2 | `src/components/terminal/TerminalPanel.tsx` | **重写** — 按选中服务器显示 |
| 3 | `src/components/terminal/TerminalTabs.tsx` | **重写** — Props 驱动 |
| 4 | `src/components/ssh/SshServerItem.tsx` | **修改** — 点击切换上下文 |
| 5 | `src/hooks/useTerminalWebSocket.ts` | **修改** — hasConnectedRef |

---

## 验证方式

1. 左侧点击 SSH 服务器 → 右侧显示该服务器的标签页
2. 双击 SSH 服务器 → 终端连接成功，第一行无"[连接已断开]"
3. 点击"+" → 为当前服务器新增标签页
4. 切换左侧服务器 → 右侧切换为它的标签页
5. 切换服务器的标签页 → 终端状态不丢失
