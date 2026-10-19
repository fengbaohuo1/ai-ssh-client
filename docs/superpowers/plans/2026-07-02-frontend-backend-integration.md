# 前后端对接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ai-ssh-client 从 mock 数据切换为调用 ai-ssh-server 后端 API，实现 SSH 连接的增删查改、连接/断开等完整功能链路

**Architecture:**
- 客户端通过 HTTP 调用 Spring Boot 后端的 REST API（6 个端点）
- 客户端新增 `src/api/` 层封装 fetch 调用，SshContext 从 mock 数据改为调用 API
- 开发阶段通过 Vite proxy 转发 `/api` → Spring Boot（localhost:8080），生产环境通过 Tauri WebView 直连（CORS 已在后端开启）
- xterm 终端集成 JSch SSH 通道（当前先调后端 connect/disconnect API 打通管理流程，终端交互后续实现）

**Tech Stack:**
- 前端: React 19 + TypeScript + Vite + Tauri 2
- 后端: Spring Boot 4.1 + MyBatis-Plus + JSch
- 网络: fetch + Vite proxy（dev）/ 直连 CORS（prod）

## Global Constraints

- 类型转换：后端 `authType`(1=password, 2=private_key) ↔ 前端 `authMethod`("password"/"key")，后端 `status`(0/1/2/3) ↔ 前端状态枚举
- 凭证脱敏：后端响应不返回 password、privateKey，前端编辑回填时不能拿到旧密码
- 后端统一响应格式：`{code: string, info: string, data: T}`
- 当前用户固定为 `default`（userId 字段尚未有登录系统）
- 当前开发 userId 固定为 "default"
- 所有 API 调用异常都要处理 loading/error 状态

---

### Task 1: 新增 API 客户端层

**Files:**
- Create: `src/api/client.ts` — 基础 fetch 封装
- Create: `src/api/ssh.ts` — SSH 连接相关的 API 调用

**Interfaces:**
- Consumes: 后端 `SshConnectionCreateRequestDTO` / `SshConnectionResponseDTO` / `Response<T>` 格式
- Produces: `createConnection`, `connect`, `disconnect`, `listConnections`, `getConnectionDetail`, `deleteConnection` 六个 async 函数

- [ ] **Step 1: 创建基础 fetch 封装**

```typescript
// src/api/client.ts
const BASE_URL = import.meta.env.DEV ? "" : "http://localhost:8080";

export interface ApiResponse<T> {
  code: string;
  info: string;
  data: T | null;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}
```

- [ ] **Step 2: 创建 SSH API 模块**

```typescript
// src/api/ssh.ts
import { apiGet, apiPost, apiDelete } from "./client";

/** 创建请求参数（与后端 SshConnectionCreateRequestDTO 对齐） */
export interface CreateConnectionRequest {
  connectionName: string;
  host: string;
  port: number;
  username: string;
  authType: number; // 1=密码, 2=私钥
  password?: string;
  privateKey?: string;
  userId: string;
  // 高级配置（可选）
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

/** 连接响应 */
export interface ConnectionResponse {
  connectionId: string;
  connectionName: string;
  host: string;
  port: number;
  username: string;
  authType: number;
  status: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

export async function createConnection(data: CreateConnectionRequest) {
  return apiPost<ConnectionResponse>("/api/v1/ssh/connection/create", data);
}

export async function connect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/connect`);
}

export async function disconnect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/disconnect`);
}

export async function listConnections(userId: string) {
  return apiGet<ConnectionResponse[]>(`/api/v1/ssh/connection/list?userId=${encodeURIComponent(userId)}`);
}

export async function getConnectionDetail(connectionId: string) {
  return apiGet<ConnectionResponse>(`/api/v1/ssh/connection/${connectionId}`);
}

export async function deleteConnection(connectionId: string) {
  return apiDelete<void>(`/api/v1/ssh/connection/${connectionId}`);
}
```

- [ ] **Step 3: 配置 Vite proxy（dev）**

修改 `vite.config.ts`，增加 proxy 配置：

```typescript
server: {
  port: 1420,
  strictPort: true,
  host: host || false,
  hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
  proxy: {
    "/api": {
      target: "http://localhost:8080",
      changeOrigin: true,
    },
  },
  watch: {
    ignored: ["**/src-tauri/**"],
  },
},
```

- [ ] **Step 4: 验证 proxy 连通**

Run: `curl -s http://localhost:1420/api/v1/ssh/connection/list?userId=default | head -20`
Expected: 代理到后端，返回 JSON 响应（code/info/data 结构），而非 404

---

### Task 2: 对齐前后端类型

**Files:**
- Modify: `src/types/index.ts` — 更新 `SshServer` 类型与后端对齐

- [ ] **Step 1: 重写 `src/types/index.ts`**

```typescript
// SSH 服务器（前端展示层，融合后端响应 + 本地元数据）
export interface SshServer {
  id: string;                          // ← connectionId（后端主标识）
  name: string;                        // ← connectionName
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";     // ← 转换自 authType（1→password, 2→key）
  password?: string;                   // 仅创建时发送，后端不返回
  tags?: string[];                     // 仅前端本地使用，与服务端无关
  lastConnected?: number;              // ← 由 status=1 时本地记录
  // 后端同步字段（不为 undefined 时表示已从服务端同步）
  status: number;                      // 0=未连接,1=已连接,2=连接中,3=连接失败
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 2: 添加类型转换工具函数**

```typescript
// src/types/index.ts 追加

export function authMethodToType(method: "password" | "key"): number {
  return method === "password" ? 1 : 2;
}

export function authTypeToMethod(type: number): "password" | "key" {
  return type === 2 ? "key" : "password";
}

export function statusLabel(status: number): string {
  switch (status) {
    case 0: return "未连接";
    case 1: return "已连接";
    case 2: return "连接中";
    case 3: return "连接失败";
    default: return "未知";
  }
}
```

---

### Task 3: 重构 SshContext——接入真实 API

**Files:**
- Modify: `src/contexts/SshContext.tsx` — 替换 mock 数据为 API 调用
- Delete: `src/data/mockServers.ts`（不再需要）

**Interfaces:**
- Consumes: `src/api/ssh.ts` 的六个 API 函数
- Produces: 新增 `SET_SERVERS`, `SET_LOADING`, `SET_ERROR` action 类型；原有 action 触发 API 调用

- [ ] **Step 1: 新增加载/错误状态 + 重写 reducer**

在 SshState 中加入 `loading: boolean` 和 `error: string | null`，初始 servers 改为 `[]`。

```typescript
interface SshState {
  servers: SshServer[];
  filterText: string;
  editingServer: SshServer | null;
  isDialogOpen: boolean;
  loading: boolean;
  error: string | null;
}

type SshAction =
  | { type: "SET_FILTER"; text: string }
  | { type: "OPEN_ADD_DIALOG" }
  | { type: "OPEN_EDIT_DIALOG"; server: SshServer }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_SERVERS"; servers: SshServer[] }
  | { type: "ADD_SERVER"; server: SshServer }
  | { type: "UPDATE_SERVER"; server: SshServer }
  | { type: "DELETE_SERVER"; id: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_SERVER_STATUS"; id: string; status: number };

const initialState: SshState = {
  servers: [],  // ← 不再使用 mockServers
  filterText: "",
  editingServer: null,
  isDialogOpen: false,
  loading: false,
  error: null,
};
```

- [ ] **Step 2: 创建异步 action hooks**

创建 `useSshActions` 或在 `SshProvider` 中暴露 `fetchServers`, `createServer`, `deleteServer` 等方法：

```typescript
// 在 SshContext.tsx 中新增
import { createConnection, listConnections, deleteConnection as apiDeleteConnection } from "../api/ssh";
import { authMethodToType, authTypeToMethod } from "../types";

export function useSshActions() {
  const dispatch = useSshDispatch();

  const fetchServers = useCallback(async (userId: string = "default") => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await listConnections(userId);
      if (res.code === "0000" && res.data) {
        const servers: SshServer[] = res.data.map((item: ConnectionResponse) => ({
          id: item.connectionId,
          name: item.connectionName,
          host: item.host,
          port: item.port,
          username: item.username,
          authMethod: authTypeToMethod(item.authType),
          status: item.status,
          userId: item.userId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          lastConnected: item.status === 1 ? Date.now() : undefined,
        }));
        dispatch({ type: "SET_SERVERS", servers });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [dispatch]);

  const addServer = useCallback(async (data: {
    name: string; host: string; port: number; username: string;
    authMethod: "password" | "key"; password?: string;
  }) => {
    try {
      const res = await createConnection({
        connectionName: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: authMethodToType(data.authMethod),
        password: data.password,
        userId: "default",
      });
      if (res.code === "0000" && res.data) {
        // 添加后重新拉取列表
        await fetchServers();
        dispatch({ type: "CLOSE_DIALOG" });
      } else {
        dispatch({ type: "SET_ERROR", error: res.info });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    }
  }, [dispatch, fetchServers]);

  const removeServer = useCallback(async (connectionId: string) => {
    try {
      const res = await apiDeleteConnection(connectionId);
      if (res.code === "0000") {
        dispatch({ type: "DELETE_SERVER", id: connectionId });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    }
  }, [dispatch]);

  return { fetchServers, addServer, removeServer };
}
```

- [ ] **Step 3: 应用初始化时加载服务器列表**

```typescript
// 在 SshProvider 中
export function SshProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sshReducer, initialState);

  // 挂载时从后端拉取
  useEffect(() => {
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const res = await listConnections("default");
        if (res.code === "0000" && res.data) {
          const servers: SshServer[] = res.data.map(/* 同上 */);
          dispatch({ type: "SET_SERVERS", servers });
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: String(err) });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    })();
  }, []);

  return (/* ... */);
}
```

- [ ] **Step 4: 更新 SshServerDialog——调用 API 而非本地 dispatch**

修改 `handleSubmit`：调用 `createConnection` API 而非单纯的 `dispatch({ type: "ADD_SERVER" })`。
编辑模式同样调用后端 API（当前后端无 update 端点，可先提示不可编辑或留待后续）。

对于编辑场景：因为后端不返回密码，编辑时如果密码字段为空则不更新密码。

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!name.trim() || !host.trim() || !username.trim()) return;

  if (isEdit) {
    // 当前后端无 update 端点，提示不可编辑
    alert("编辑功能暂未实现，请删除后重新添加");
    return;
  }

  try {
    const res = await createConnection({
      connectionName: name.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      authType: authMethodToType(authMethod),
      password: authMethod === "password" ? password : undefined,
      userId: "default",
    });
    if (res.code === "0000") {
      dispatch({ type: "CLOSE_DIALOG" });
      // 重新加载列表
      // 通过 SshProvider 的 fetch 或触发 refresh
    } else {
      alert(res.info);
    }
  } catch (err) {
    alert("创建失败: " + String(err));
  }
};
```

- [ ] **Step 5: 更新 SshServerItem——删除调 API**

修改 `handleDelete`：调用 `deleteConnection` API 成功后 dispatch `DELETE_SERVER`。
连接操作直接调后端 connect API（见 Task 4）。

```typescript
const handleDelete = async () => {
  if (showDeleteConfirm) {
    try {
      const res = await deleteConnection(server.id);
      if (res.code === "0000") {
        sshDispatch({ type: "DELETE_SERVER", id: server.id });
      }
    } catch (err) {
      console.error("删除失败", err);
    }
    closeMenu();
  } else {
    setShowDeleteConfirm(true);
  }
};
```

- [ ] **Step 6: 更新 SshServerList——显示 loading/error 状态**

在列表为空时区分 loading/无数据/error 三种状态：

```typescript
if (loading) {
  return <div className="flex items-center justify-center py-16">
    <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
  </div>;
}
if (error) { ... }
if (servers.length === 0) { /* 空状态 */ }
```

- [ ] **Step 7: 删除 `src/data/mockServers.ts`**

直接删除文件，不再 import。

---

### Task 4: 连接/断开操作调后端 API

**Files:**
- Modify: `src/components/ssh/SshServerItem.tsx` — 连接操作调 API
- Modify: `src/contexts/SshContext.tsx` — 新增 `connectionAction` hook

- [ ] **Step 1: 添加 connect/disconnect 方法到 actions**

```typescript
// SshContext.tsx 的 useSshActions 中追加
const connectServer = useCallback(async (connectionId: string) => {
  dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 2 }); // connecting
  try {
    const res = await connect(connectionId);
    if (res.code === "0000") {
      dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 1 }); // connected
    } else {
      dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 3 }); // failed
    }
  } catch {
    dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 3 });
  }
}, [dispatch]);

const disconnectServer = useCallback(async (connectionId: string) => {
  try {
    await disconnect(connectionId);
    dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 0 });
  } catch (err) {
    console.error("断开失败", err);
  }
}, [dispatch]);
```

- [ ] **Step 2: 更新 SshServerItem 的连接操作**

右键菜单的"连接"和双击操作改为调用 `connectServer`：

```typescript
const handleConnect = async () => {
  // 先调后端 connect API
  const res = await connect(server.id);
  if (res.code === "0000") {
    // 再打开终端 tab
    terminalDispatch({ type: "OPEN_TAB", serverId: server.id, serverName: server.name });
  }
  closeMenu();
};
```

右键菜单增加"断开"按钮（当 `isConnected` 时显示）：

```typescript
{isConnected && (
  <button onClick={handleDisconnect} className="...">
    断开
  </button>
)}
```

---

### Task 5: 完善终端集成

**Files:**
- Modify: `src/components/terminal/TerminalView.tsx` — 跳过连接（已有 mock 连接），直接显示终端

- [ ] **Step 1: 确认已连接则启动终端会话**

当前 `TerminalView` 在 status 为 `disconnected` 时直接显示欢迎信息。改为先调后端 connect（如果尚未连接）。

但更合理的流程是：双击服务器 → 调 connect API → 成功后开 tab（在 SshServerItem 完成）。TerminalView 只需关注显示终端 UI。

- [ ] **Step 2: 终端交互同步后端**

当前 xterm 只展示本地欢迎信息，与实际 SSH 通道未联通。后续需要接入 WebSocket 或通过 Tauri invoke 转发终端 IO，此步先标记为 TODO。

---

### Task 6: 端到端验证

**Files:**
- Verify: 启动后端 + 前端，验证完整链路

- [ ] **Step 1: 启动后端**

```bash
cd D:/study/ai-ssh/ai-ssh-server
mvn install -DskipTests
mvn spring-boot:run -pl ai-ssh-server-app
```

Expected: Spring Boot 启动在 `localhost:8080`

- [ ] **Step 2: 启动前端 dev server**

```bash
cd D:/study/ai-ssh/ai-ssh-client
npm run dev
```

Expected: Vite dev server 启动在 `localhost:1420`

- [ ] **Step 3: 测试获取列表**

```bash
curl -s http://localhost:1420/api/v1/ssh/connection/list?userId=default
```

Expected: 返回已有连接列表（腾讯云服务器等）

- [ ] **Step 4: 测试创建连接**

```bash
curl -s -X POST http://localhost:1420/api/v1/ssh/connection/create \
  -H "Content-Type: application/json" \
  -d '{"connectionName":"test","host":"192.0.2.10","port":22,"username":"root","authType":1,"password":"test123","userId":"default"}'
```

Expected: 返回新创建的 connection 信息

- [ ] **Step 5: 浏览器打开前端**

Open: `http://localhost:1420`
Expected: 左侧 SSH 列表从服务端加载，可创建/删除服务器

---

## 完整文件变更清单

| # | 文件 | 操作 |
|---|---|---|
| 1 | `src/api/client.ts` | **新增** — fetch 封装 |
| 2 | `src/api/ssh.ts` | **新增** — SSH API 调用 |
| 3 | `src/types/index.ts` | **修改** — SshServer 对齐后端 |
| 4 | `src/contexts/SshContext.tsx` | **重写** — 接入真实 API |
| 5 | `src/data/mockServers.ts` | **删除** |
| 6 | `src/components/ssh/SshServerDialog.tsx` | **修改** — 创建调 API |
| 7 | `src/components/ssh/SshServerItem.tsx` | **修改** — 连接/删除调 API |
| 8 | `src/components/ssh/SshServerList.tsx` | **修改** — 支持 loading/error |
| 9 | `vite.config.ts` | **修改** — 添加 proxy |
| 10 | `src/components/terminal/TerminalView.tsx` | **微调** — 标记后续集成点 |

---

## 未在本次范围

1. **终端 IO 联通** — xterm 目前仅显示本地内容，实际 SSH 输入输出需要通过 Tauri invoke 或 WebSocket 转发，不在本次范围
2. **密码加密存储** — 后端当前存储密文，但 connect 传密文给 JSch 会失败，需引入 AES 解密机制
3. **编辑功能** — 后端无 update 端点，编辑暂不可用
4. **用户认证** — 当前 userId 固定为 "default"
5. **标签（tags）** — 后端无 tags 字段，仅前端本地使用
