# AI 对话对接 + SSH 终端 WebSocket 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端调通全部后端接口 — AI 对话能收发消息（含流式），SSH 终端能真正输入命令看到输出

**Architecture:**
- AI 对话：前端新增 API 客户端调后端 4 个端点，ChatContext 从本地模拟改为真实调用，流式用 SSE（EventSource）
- SSH 终端：后端新增 WebSocket 端点桥接 JSch ChannelShell，前端 xterm 通过 WebSocket 收发 I/O

**Tech Stack:**
- 前端: React 19 + TypeScript + EventSource (SSE) + WebSocket API
- 后端: Spring Boot 4.1 + spring-boot-starter-websocket + JSch ChannelShell
- SSE path: `POST /api/v1/chat_stream` → SseEmitter
- WebSocket path: `ws://host/ws/terminal/{connectionId}`

## Global Constraints

- 后端统一响应：`{code, info, data}`
- SSE 事件格式：`{"v":"content文本","s":[步骤JSON数组]}`
- WebSocket 消息格式：前端→后端为纯文本命令，后端→前端为 UTF-8 终端输出
- userId 固定为 "default"
- 所有异步调用需处理 loading/error 状态

---

### Task 1: 新增 AI 对话 API 客户端

**Files:**
- Create: `src/api/chat.ts`

**Interfaces:**
- Consumes: 后端 `IAgentService` 的 4 个端点
- Produces: `listAgents`, `createSession`, `chat`, `chatStream` 四个函数

- [ ] **Step 1: 定义 DTO 接口和 API 函数**

```typescript
// src/api/chat.ts
import { apiGet, apiPost } from "./client";
import type { ApiResponse } from "./client";

/** 智能体配置 */
export interface AgentConfig {
  agentId: string;
  agentName: string;
  agentDesc: string;
}

/** 创建会话请求 */
export interface CreateSessionRequest {
  agentId: string;
  userId: string;
}

/** 创建会话响应 */
export interface CreateSessionResponse {
  sessionId: string;
}

/** 对话请求 */
export interface ChatRequest {
  agentId: string;
  userId: string;
  sessionId: string;
  message: string;
}

/** 对话响应（非流式） */
export interface ChatResponse {
  content: string;
  steps?: string;
}

/** 获取智能体配置列表 */
export async function listAgents() {
  return apiGet<AgentConfig[]>("/api/v1/query_ai_agent_config_list");
}

/** 创建会话 */
export async function createSession(data: CreateSessionRequest) {
  return apiPost<CreateSessionResponse>("/api/v1/create_session", data);
}

/** 非流式对话 */
export async function chat(data: ChatRequest) {
  return apiPost<ChatResponse>("/api/v1/chat", data);
}

/** 流式对话 — 返回 SSE URL，前端用 EventSource 消费 */
export function chatStreamUrl(): string {
  // 开发模式走 Vite proxy，生产环境直连
  const base = import.meta.env.DEV ? "" : "http://localhost:8091";
  return `${base}/api/v1/chat_stream`;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 3: 提交**

```bash
git add src/api/chat.ts
git commit -m "feat: add AI chat API client layer"
```

---

### Task 2: 重构 ChatContext——接入真实对话 API

**Files:**
- Modify: `src/contexts/ChatContext.tsx` — 加入 API 调用逻辑
- Modify: `src/types/index.ts` — 可选：补充 AgentOption 类型

**Interfaces:**
- Consumes: `src/api/chat.ts` 的四个函数
- Produces: 支持发送→后端→接收的完整对话流（含 SSE 流式）

- [ ] **Step 1: 分析当前 ChatContext 结构**

当前 ChatContext：
- `SEND_MESSAGE`: 仅本地添加 user msg + 空 assistant msg，标记 streaming=true
- `APPEND_STREAM`: 追加 chunk 到 assistant msg
- `FINISH_STREAM`: 关闭 streaming
- 没有真正的 API 调用

需要新增：
- 发送时先 `createSession`（如果当前没有 sessionId）
- 然后调 `chat`（非流式）或 `chatStream`（流式）
- 接收到完整响应后更新消息

- [ ] **Step 2: 修改 ChatState 加入 sessionId**

```typescript
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  selectedAgentId: string;
  sessionId: string | null;  // ← 新增：后端会话 ID
  agents: AgentConfig[];     // ← 新增：智能体列表
  loadingAgents: boolean;    // ← 新增
  sending: boolean;          // ← 新增：是否正在发送
}
```

- [ ] **Step 3: 新增 action 类型**

```typescript
type ChatAction =
  // ... 保留原有
  | { type: "SET_SESSION_ID"; sessionId: string }
  | { type: "SET_AGENTS"; agents: AgentConfig[] }
  | { type: "SET_LOADING_AGENTS"; loading: boolean }
  | { type: "SET_SENDING"; sending: boolean }
  | { type: "SET_AGENT_ID"; agentId: string };  // 替换 SELECT_AGENT
```

- [ ] **Step 4: 修改 SEND_MESSAGE 处理逻辑**

`SEND_MESSAGE` 改为 async action（或由组件触发）。一种简洁方案是在 `ChatContext` 中暴露 `useChatActions` hook：

```typescript
export function useChatActions() {
  const state = useChatState();
  const dispatch = useChatDispatch();

  const sendMessage = useCallback(async (content: string) => {
    // 1. 如果没有 session，先创建
    let sessionId = state.sessionId;
    if (!sessionId) {
      const res = await createSession({ agentId: state.selectedAgentId, userId: "default" });
      if (res.code === "0000" && res.data) {
        sessionId = res.data.sessionId;
        dispatch({ type: "SET_SESSION_ID", sessionId });
      } else {
        dispatch({ type: "SET_MESSAGE_STATUS", id: "...", status: "error" });
        return;
      }
    }

    // 2. 添加用户消息
    dispatch({ type: "SEND_MESSAGE", content });

    // 3. 调流式 /chat_stream
    dispatch({ type: "SET_SENDING", sending: true });
    try {
      const url = chatStreamUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: state.selectedAgentId,
          userId: "default",
          sessionId,
          message: content,
        }),
      });

      // 4. 用 EventSource 或 ReadableStream 处理 SSE
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.v) {
                dispatch({ type: "APPEND_STREAM", messageId: lastAiMsgId, chunk: data.v });
              }
              if (data.s) {
                // 可选的步骤信息
              }
            } catch { /* 忽略解析错误 */ }
          }
        }
      }

      dispatch({ type: "FINISH_STREAM", messageId: lastAiMsgId });
    } catch (err) {
      dispatch({ type: "SET_MESSAGE_STATUS", id: lastAiMsgId, status: "error" });
    } finally {
      dispatch({ type: "SET_SENDING", sending: false });
    }
  }, [state.sessionId, state.selectedAgentId, dispatch]);

  return { sendMessage };
}
```

> 注意：上面的 `lastAiMsgId` 需要在 dispatch SEND_MESSAGE 后从新 state 中获取。可以改 `SEND_MESSAGE` 返回 messageId，或者在 reducer 里预创建 assistantMsg 并返回 id。

- [ ] **Step 5: 应用初始化时拉取智能体列表**

```typescript
// ChatProvider 中
useEffect(() => {
  (async () => {
    dispatch({ type: "SET_LOADING_AGENTS", loading: true });
    try {
      const res = await listAgents();
      if (res.code === "0000" && res.data && res.data.length > 0) {
        dispatch({ type: "SET_AGENTS", agents: res.data });
      }
    } catch (err) {
      console.error("获取智能体列表失败", err);
    } finally {
      dispatch({ type: "SET_LOADING_AGENTS", loading: false });
    }
  })();
}, []);
```

- [ ] **Step 6: 更新 AiChatInput 使用真实发送**

当前 `AiChatInput` 的 `handleSend` 调用 `dispatch({ type: "SEND_MESSAGE", content })`，改为调用 `sendMessage(content)`：

```typescript
const { sendMessage } = useChatActions();

const handleSend = useCallback(() => {
  const trimmed = input.trim();
  if (!trimmed || isStreaming) return;
  sendMessage(trimmed);
  setInput("");
}, [input, isStreaming, sendMessage]);
```

- [ ] **Step 7: 提交**

```bash
git add src/contexts/ChatContext.tsx src/types/index.ts src/components/chat/AiChatInput.tsx
git commit -m "feat: integrate AI chat API with streaming support"
```

---

### Task 3: 后端新增 WebSocket 终端支持

**Files:**
- Modify: `ai-ssh-server-trigger/pom.xml` — 添加 websocket 依赖
- Create: `trigger/http/websocket/SshTerminalWebSocketHandler.java` — WebSocket 处理器
- Create: `trigger/http/websocket/WebSocketConfig.java` — 注册端点
- Read: `infrastructure/adapter/port/SshSessionPort.java` — 已有 getSession 方法

- [ ] **Step 1: 添加 WebSocket 依赖**

```xml
<!-- ai-ssh-server-trigger/pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

- [ ] **Step 2: 创建 WebSocket 配置类**

```java
// ai-ssh-server-trigger/src/main/java/.../trigger/http/websocket/WebSocketConfig.java
@Configuration
public class WebSocketConfig implements WebSocketConfigurer {

    @Resource
    private SshTerminalWebSocketHandler terminalHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(terminalHandler, "/ws/terminal/{connectionId}")
                .setAllowedOrigins("*");
    }
}
```

- [ ] **Step 3: 创建 WebSocket 处理器**

核心逻辑：建立连接时获取 JSch Session → 打开 ChannelShell → 双向桥接 I/O。

```java
// SshTerminalWebSocketHandler.java
@Slf4j
@Component
public class SshTerminalWebSocketHandler extends TextWebSocketHandler {

    @Resource
    private SshSessionPort sshSessionPort;

    @Override
    public void afterConnectionEstablished(WebSocketSession wsSession) {
        String connectionId = /* 从路径中提取 */;
        Session jschSession = sshSessionPort.getSession(connectionId);
        if (jschSession == null || !jschSession.isConnected()) {
            wsSession.close(/* 错误关闭 */);
            return;
        }

        // 打开 ChannelShell
        ChannelShell channel = (ChannelShell) jschSession.openChannel("shell");
        channel.setPtyType("xterm-256color");
        channel.connect();

        // 启动线程：读取 ChannelShell 输出流 → WebSocket
        InputStream inputStream = channel.getInputStream();
        // 每个 wsSession 绑定 channel、inputStream、outputStream

        // 保存到 Map<wsSessionId, Channel>
    }

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) {
        // 用户键盘输入 → JSch ChannelShell 的 OutputStream
        ChannelShell channel = channelMap.get(wsSession.getId());
        channel.getOutputStream().write(message.getPayload().getBytes());
        channel.getOutputStream().flush();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
        // 关闭 ChannelShell
        ChannelShell channel = channelMap.remove(wsSession.getId());
        if (channel != null) channel.disconnect();
    }
}
```

- [ ] **Step 4: 编译验证**

```bash
cd D:/study/ai-ssh/ai-ssh-server
mvn compile -pl ai-ssh-server-trigger -am
```

Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add ai-ssh-server-trigger/pom.xml ai-ssh-server-trigger/src/.../websocket/
git commit -m "feat: add WebSocket terminal endpoint bridging JSch ChannelShell"
```

---

### Task 4: 前端 xterm 对接 WebSocket 终端

**Files:**
- Create: `src/hooks/useTerminalWebSocket.ts` — WebSocket 连接管理
- Modify: `src/components/terminal/TerminalView.tsx` — 接入真实终端
- Modify: `src/components/terminal/TerminalPanel.tsx` — 可选优化

- [ ] **Step 1: 创建 WebSocket Hook**

```typescript
// src/hooks/useTerminalWebSocket.ts
import { useEffect, useRef, useCallback } from "react";
import type { Terminal } from "@xterm/xterm";

export function useTerminalWebSocket(
  terminal: Terminal | null,
  connectionId: string,
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    if (!connectionId) return;

    const base = import.meta.env.DEV ? "localhost:8091" : "localhost:8091";
    const protocol = import.meta.env.DEV ? "ws" : "ws";
    const url = `${protocol}://${base}/ws/terminal/${connectionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      onStatusChange?.("connected");
      terminal?.focus();
    };

    ws.onmessage = (event) => {
      terminal?.write(event.data);
    };

    ws.onclose = () => {
      onStatusChange?.("disconnected");
      terminal?.write("\r\n\x1b[31m[连接已断开]\x1b[0m\r\n");
    };

    ws.onerror = () => {
      onStatusChange?.("error");
    };
  }, [connectionId, terminal, onStatusChange]);

  const sendData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const disconnectWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connectWs, sendData, disconnectWs };
}
```

- [ ] **Step 2: 修改 TerminalView——xterm 对接 WebSocket**

```typescript
// src/components/terminal/TerminalView.tsx — 关键修改
export default function TerminalView({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminal: terminalRef, fitAddon } = useTerminal(containerRef);
  const dispatch = useTerminalDispatch();
  const terminal = terminalRef.current;

  const { connectWs, sendData, disconnectWs } = useTerminalWebSocket(
    terminal,
    tab.serverId || "",
    (status) => {
      dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status });
    }
  );

  // 挂载时建立 WebSocket 连接
  useEffect(() => {
    if (terminal && tab.serverId && tab.status !== "connected") {
      dispatch({ type: "UPDATE_TAB_STATUS", id: tab.id, status: "connecting" });
      connectWs();

      // 注册 xterm onData → WebSocket send
      const disposable = terminal.onData((data) => {
        sendData(data);
      });

      return () => {
        disposable.dispose();
        disconnectWs();
      };
    }
  }, [terminal, tab.serverId]);
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useTerminalWebSocket.ts src/components/terminal/TerminalView.tsx
git commit -m "feat: connect xterm to WebSocket for real SSH terminal I/O"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 启动后端**

```bash
cd D:/study/ai-ssh/ai-ssh-server
mvn install -DskipTests
mvn spring-boot:run -pl ai-ssh-server-app
```

Expected: 启动在 8091 端口

- [ ] **Step 2: 测试 AI Chat API**

```bash
# 获取智能体列表
curl -s http://localhost:8091/api/v1/query_ai_agent_config_list | head -50

# 创建会话
curl -s -X POST http://localhost:8091/api/v1/create_session \
  -H "Content-Type: application/json" \
  -d '{"agentId":"...","userId":"default"}'

# 非流式对话
curl -s -X POST http://localhost:8091/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"agentId":"...","userId":"default","sessionId":"...","message":"你好"}'
```

- [ ] **Step 3: 启动前端**

```bash
cd D:/study/ai-ssh/ai-ssh-client
npm run dev
```

- [ ] **Step 4: 浏览器测试**

1. SSH 服务器列表应正常加载
2. 创建新 SSH 连接并双击 → 终端应显示真实 SSH 提示符
3. AI 对话面板应能发送消息并收到回复（流式输出）

---

## 完整文件变更清单

| # | 项目 | 文件 | 操作 |
|---|---|---|---|
| 1 | client | `src/api/chat.ts` | **新增** |
| 2 | client | `src/contexts/ChatContext.tsx` | **重写** |
| 3 | client | `src/types/index.ts` | **修改** |
| 4 | client | `src/components/chat/AiChatInput.tsx` | **修改** |
| 5 | client | `src/hooks/useTerminalWebSocket.ts` | **新增** |
| 6 | client | `src/components/terminal/TerminalView.tsx` | **重写** |
| 7 | server | `ai-ssh-server-trigger/pom.xml` | **修改** |
| 8 | server | `.../trigger/http/websocket/WebSocketConfig.java` | **新增** |
| 9 | server | `.../trigger/http/websocket/SshTerminalWebSocketHandler.java` | **新增** |

---

## 未在本次范围

1. **SFTP 文件传输** — 后端无相关接口
2. **用户登录/鉴权** — userId 固定为 "default"
3. **对话历史持久化** — 后端已有 session 管理，但前端未做历史加载
