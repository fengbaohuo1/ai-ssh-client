import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type { ChatMessage, Conversation, StepEvent, UsageInfo } from "../types";
import { listAgents, createSession, chatStreamUrl } from "../api/chat";
import { authHeaders } from "../api/client";
import type { AgentConfig } from "../api/chat";

// ===== Persistence =====
const STORAGE_KEY = "ai-ssh-chat-v1";

/** 持久化上限：步骤里的大输出（df -h、子智能体结论）不设上限会把 localStorage 撑爆 */
const MAX_PERSISTED_CONVERSATIONS = 20;
const MAX_PERSISTED_MESSAGES = 200;
const MAX_PERSISTED_STEP_TEXT = 2000;

interface PersistedChat {
  conversations: Conversation[];
  activeConversationId: string;
  selectedAgentId: string;
}

/** 步骤瘦身：长文本按字段截断 + 丢掉运行态（重启后不应再转圈） */
function sanitizeStep(step: StepEvent): StepEvent {
  const trimmed: StepEvent = {
    ...step,
    st: step.st === "running" ? "ok" : step.st,
  };
  if (trimmed.r) {
    trimmed.r = truncateTextFields(trimmed.r);
  }
  if (trimmed.a) {
    trimmed.a = truncateTextFields(trimmed.a);
  }
  return trimmed;
}

function truncateTextFields(source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.length > MAX_PERSISTED_STEP_TEXT) {
      result[key] = `${value.slice(0, MAX_PERSISTED_STEP_TEXT)}\n…[已截断]`;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** 序列化前剥离流式标记与运行态——重启恢复的消息一律是"已完成"状态 */
function sanitizeForStorage(conversations: Conversation[]): Conversation[] {
  return conversations.slice(-MAX_PERSISTED_CONVERSATIONS).map((c) => ({
    ...c,
    messages: c.messages.slice(-MAX_PERSISTED_MESSAGES).map((m) => ({
      ...m,
      streaming: false,
      thinking: false,
      status: m.status === "sending" ? "sent" : m.status,
      steps: m.steps?.map(sanitizeStep),
    })),
  }));
}

function loadPersisted(): PersistedChat | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChat;
    if (!Array.isArray(parsed.conversations) || parsed.conversations.length === 0) return null;
    return {
      conversations: sanitizeForStorage(parsed.conversations),
      activeConversationId: parsed.activeConversationId,
      selectedAgentId: parsed.selectedAgentId,
    };
  } catch {
    return null;
  }
}

// ===== State & Actions =====
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  selectedAgentId: string;
  agents: AgentConfig[];
  loadingAgents: boolean;
  sending: boolean;
}

type ChatAction =
  | { type: "NEW_CONVERSATION" }
  | { type: "SEND_MESSAGE"; content: string; assistantId?: string; appendUser?: boolean }
  | { type: "APPEND_STREAM"; messageId: string; chunk: string }
  | { type: "UPSERT_STEP"; messageId: string; step: StepEvent }
  | { type: "SET_THINKING"; messageId: string; thinking: boolean }
  | { type: "SET_USAGE"; messageId: string; usage: UsageInfo }
  | { type: "SET_ERROR"; messageId: string; errorText: string }
  | { type: "FINISH_STREAM"; messageId: string; stopReason?: string; status?: ChatMessage["status"] }
  | { type: "SET_MESSAGE_STATUS"; id: string; status: ChatMessage["status"] }
  | { type: "SELECT_AGENT"; agentId: string }
  | { type: "SET_CONVERSATION_TITLE"; title: string }
  | { type: "AUTO_TITLE"; title: string }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "DROP_LAST_ASSISTANT" }
  | { type: "STOP_STREAMING" }
  | { type: "DELETE_CONVERSATION"; id: string }
  | { type: "SWITCH_CONVERSATION"; id: string }
  | { type: "SET_CONVERSATION_SESSION"; id: string; sessionId: string }
  | { type: "LOAD_HISTORY"; conversation: Conversation }
  | { type: "SET_AGENTS"; agents: AgentConfig[] }
  | { type: "SET_LOADING_AGENTS"; loading: boolean }
  | { type: "SET_SENDING"; sending: boolean }
  | { type: "SET_AGENT_ID"; agentId: string };

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function createConversation(): Conversation {
  return {
    id: generateId(),
    title: "新对话",
    messages: [],
    createdAt: Date.now(),
  };
}

/** 用首条用户消息生成标题（服务端标题只在历史侧栏用；这里要即时可见） */
function titleFromMessage(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 24 ? `${flat.slice(0, 24)}…` : flat || "新对话";
}

function initState(): ChatState {
  const persisted = loadPersisted();
  if (persisted) {
    return {
      conversations: persisted.conversations,
      activeConversationId: persisted.activeConversationId,
      selectedAgentId: persisted.selectedAgentId,
      agents: [],
      loadingAgents: false,
      sending: false,
    };
  }
  const initialConversation = createConversation();
  return {
    conversations: [initialConversation],
    activeConversationId: initialConversation.id,
    selectedAgentId: "general",
    agents: [],
    loadingAgents: false,
    sending: false,
  };
}

/** 在活动对话里就地更新一条消息 */
function mapActiveMessage(
  state: ChatState,
  messageId: string,
  update: (message: ChatMessage) => ChatMessage
): ChatState {
  return {
    ...state,
    conversations: state.conversations.map((c) =>
      c.id === state.activeConversationId
        ? {
            ...c,
            messages: c.messages.map((m) => (m.id === messageId ? update(m) : m)),
          }
        : c
    ),
  };
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "NEW_CONVERSATION": {
      const conv = createConversation();
      return {
        ...state,
        conversations: [...state.conversations, conv],
        activeConversationId: conv.id,
      };
    }
    case "SEND_MESSAGE": {
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: action.content,
        timestamp: Date.now(),
        status: "sent",
      };
      const aiMsg: ChatMessage = {
        id: action.assistantId || generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        streaming: true,
        thinking: true, // 空泡期显示"正在分析"，首个分片/步骤到达即清除
      };
      const appended = action.appendUser === false ? [aiMsg] : [userMsg, aiMsg];
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? { ...c, messages: [...c.messages, ...appended] }
            : c
        ),
      };
    }
    case "APPEND_STREAM":
      return mapActiveMessage(state, action.messageId, (m) => ({
        ...m,
        content: m.content + action.chunk,
        thinking: false,
      }));
    case "UPSERT_STEP":
      return mapActiveMessage(state, action.messageId, (m) => {
        const steps = m.steps || [];
        const index = steps.findIndex((s) => s.id === action.step.id);
        // 同一 id 只保留一条：后到的字段覆盖先生成的步骤（结果补进调用卡片），
        // 并发/乱序到达也不会出现重复卡片或张冠李戴
        // 注意 t/ts/contentOffset 取**首次**的值：步骤的身份是它的调用，
        // 若让后到的 tool_result 覆盖 t，卡片会因类型变成"纯结果"而整张消失（冒烟踩过）
        const nextStep: StepEvent =
          index >= 0
            ? {
                ...steps[index],
                ...action.step,
                t: steps[index].t,
                ts: steps[index].ts,
                contentOffset: steps[index].contentOffset,
              }
            : { ...action.step, contentOffset: m.content.length };
        return {
          ...m,
          thinking: false,
          steps: index >= 0
            ? steps.map((s, i) => (i === index ? nextStep : s))
            : [...steps, nextStep],
        };
      });
    case "SET_THINKING":
      return mapActiveMessage(state, action.messageId, (m) => ({ ...m, thinking: action.thinking }));
    case "SET_USAGE":
      return mapActiveMessage(state, action.messageId, (m) => ({ ...m, usage: action.usage }));
    case "SET_ERROR":
      return mapActiveMessage(state, action.messageId, (m) => ({
        ...m,
        status: "error",
        errorText: action.errorText,
        streaming: false,
        thinking: false,
      }));
    case "FINISH_STREAM":
      return mapActiveMessage(state, action.messageId, (m) => ({
        ...m,
        streaming: false,
        thinking: false,
        stopReason: action.stopReason ?? m.stopReason,
        status: action.status ?? (m.status === "error" ? "error" : "sent"),
      }));
    case "SET_MESSAGE_STATUS": {
      const { id, status } = action;
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)),
              }
            : c
        ),
      };
    }
    case "SELECT_AGENT":
    case "SET_AGENT_ID":
      return { ...state, selectedAgentId: action.agentId };
    case "SET_CONVERSATION_TITLE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId ? { ...c, title: action.title } : c
        ),
      };
    case "AUTO_TITLE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId && (c.title === "新对话" || !c.title)
            ? { ...c, title: action.title }
            : c
        ),
      };
    case "CLEAR_CONVERSATION":
      // 同时解绑后端会话：否则界面空了、模型还记得（下一句会把旧上下文带回来）
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId ? { ...c, messages: [], sessionId: undefined } : c
        ),
      };
    case "DROP_LAST_ASSISTANT": {
      const conv = state.conversations.find((c) => c.id === state.activeConversationId);
      if (!conv) return state;
      const msgs = [...conv.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs.pop();
      }
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId ? { ...c, messages: msgs } : c
        ),
      };
    }
    case "STOP_STREAMING":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.streaming ? { ...m, streaming: false, thinking: false, status: "stopped" } : m
                ),
              }
            : c
        ),
      };
    case "DELETE_CONVERSATION": {
      const remaining = state.conversations.filter((c) => c.id !== action.id);
      if (remaining.length === 0) return state;
      return {
        ...state,
        conversations: remaining,
        activeConversationId:
          state.activeConversationId === action.id
            ? remaining[remaining.length - 1].id
            : state.activeConversationId,
      };
    }
    case "SWITCH_CONVERSATION":
      return { ...state, activeConversationId: action.id };
    case "SET_CONVERSATION_SESSION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id ? { ...c, sessionId: action.sessionId } : c
        ),
      };
    case "LOAD_HISTORY": {
      // 历史会话载入：同一后端会话只保留一个本地对话，存在则直接切换
      const existing = state.conversations.find(
        (c) => c.sessionId === action.conversation.sessionId
      );
      if (existing) {
        return { ...state, activeConversationId: existing.id };
      }
      return {
        ...state,
        conversations: [...state.conversations, action.conversation],
        activeConversationId: action.conversation.id,
      };
    }
    case "SET_AGENTS":
      return { ...state, agents: action.agents };
    case "SET_LOADING_AGENTS":
      return { ...state, loadingAgents: action.loading };
    case "SET_SENDING":
      return { ...state, sending: action.sending };
    default:
      return state;
  }
}

// ===== Context =====
const ChatStateContext = createContext<ChatState>(initState());
const ChatDispatchContext = createContext<Dispatch<ChatAction>>(() => {});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, undefined, initState);

  // 应用初始化时拉取智能体列表
  useEffect(() => {
    (async () => {
      dispatch({ type: "SET_LOADING_AGENTS", loading: true });
      try {
        const res = await listAgents();
        if (res.code === "0000" && res.data && res.data.length > 0) {
          dispatch({ type: "SET_AGENTS", agents: res.data });
          if (state.selectedAgentId === "general") {
            dispatch({ type: "SET_AGENT_ID", agentId: res.data[0].agentId });
          }
        }
      } catch (err) {
        console.error("获取智能体列表失败", err);
      } finally {
        dispatch({ type: "SET_LOADING_AGENTS", loading: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 会话持久化：对话列表（含后端 sessionId）与消息写入 localStorage，
  // 重启后 chat_stream 带旧 sessionId → 后端复用/重建会话并冷启动恢复 DB 历史
  useEffect(() => {
    const persisted: PersistedChat = {
      conversations: sanitizeForStorage(state.conversations),
      activeConversationId: state.activeConversationId,
      selectedAgentId: state.selectedAgentId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (err) {
      console.warn("会话持久化失败", err);
    }
  }, [state.conversations, state.activeConversationId, state.selectedAgentId]);

  return (
    <ChatStateContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>
        {children}
      </ChatDispatchContext.Provider>
    </ChatStateContext.Provider>
  );
}

export function useChatState() {
  return useContext(ChatStateContext);
}

export function useChatDispatch() {
  return useContext(ChatDispatchContext);
}

// ===== SSE 解析（标准事件流：事件以空行分隔，data 行可多条） =====

/** 一个 SSE 事件块 → data 文本（多行 data 按规范以 \n 连接） */
function sseDataOf(eventBlock: string): string {
  const dataLines: string[] = [];
  for (const line of eventBlock.split("\n")) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  return dataLines.join("\n");
}

/** 后端步骤 → 前端步骤（补 id/ts，容忍旧后端缺字段） */
function normalizeStep(raw: Record<string, unknown>, fallbackId: string): StepEvent {
  const id = typeof raw.id === "string" && raw.id ? raw.id : fallbackId;
  return {
    id,
    p: typeof raw.p === "string" ? raw.p : undefined,
    t: raw.t as StepEvent["t"],
    k: raw.k as StepEvent["k"],
    n: typeof raw.n === "string" ? raw.n : undefined,
    a: (raw.a as Record<string, unknown>) || undefined,
    r: (raw.r as Record<string, unknown>) || undefined,
    st: (raw.st as StepEvent["st"]) || (raw.t === "tool_result" ? "ok" : "running"),
    ms: typeof raw.ms === "number" ? raw.ms : undefined,
    att: typeof raw.att === "number" ? raw.att : undefined,
    maxAtt: typeof raw.maxAtt === "number" ? raw.maxAtt : undefined,
    ag: typeof raw.ag === "string" ? raw.ag : undefined,
    m: typeof raw.m === "string" ? raw.m : undefined,
    ts: Date.now(),
  };
}

// ===== Actions Hook =====
export function useChatActions() {
  const state = useChatState();
  const dispatch = useChatDispatch();

  /** 正在进行的流（停止按钮据此真正中断请求，而不只是改本地标志位） */
  const abortRef = useRef<AbortController | null>(null);
  const streamingMessageRef = useRef<string | null>(null);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "STOP_STREAMING" });
    dispatch({ type: "SET_SENDING", sending: false });
  }, [dispatch]);

  /**
   * 发送一条消息并消费 SSE 流（唯一入口：输入框 / 快捷提示 / 重新生成都走这里）。
   *
   * @param content 用户消息
   * @param terminalSessionId 绑定的 SSH 连接（AI 要操作哪台服务器）
   * @param appendUser 是否追加一条用户气泡（重新生成时为 false：用户消息还在）
   */
  const sendMessage = useCallback(
    async (content: string, terminalSessionId?: string, appendUser = true) => {
      const activeConv = state.conversations.find((c) => c.id === state.activeConversationId);
      let sessionId = activeConv?.sessionId;
      if (!sessionId) {
        dispatch({ type: "SET_SENDING", sending: true });
        try {
          const res = await createSession({
            agentId: state.selectedAgentId,
            userId: "default",
          });
          if (res.code === "0000" && res.data) {
            sessionId = res.data.sessionId;
            if (activeConv) {
              dispatch({ type: "SET_CONVERSATION_SESSION", id: activeConv.id, sessionId });
            }
          } else {
            console.error("创建会话失败", res);
            dispatch({ type: "SET_SENDING", sending: false });
            return;
          }
        } catch (err) {
          console.error("创建会话异常", err);
          dispatch({ type: "SET_SENDING", sending: false });
          return;
        }
      }

      const assistantId = generateId();
      dispatch({ type: "SEND_MESSAGE", content, assistantId, appendUser });
      if (appendUser) {
        dispatch({ type: "AUTO_TITLE", title: titleFromMessage(content) });
      }
      dispatch({ type: "SET_SENDING", sending: true });

      const controller = new AbortController();
      abortRef.current = controller;
      streamingMessageRef.current = assistantId;

      /** 后端步骤 → 状态更新（thinking/usage/done/error 各有归属，工具类走 UPSERT_STEP） */
      const applyStep = (raw: Record<string, unknown>) => {
        switch (raw.t) {
          case "thinking":
            dispatch({ type: "SET_THINKING", messageId: assistantId, thinking: true });
            break;
          case "usage":
            dispatch({
              type: "SET_USAGE",
              messageId: assistantId,
              usage: {
                promptTokens: Number(raw.pt) || 0,
                completionTokens: Number(raw.ct) || 0,
                totalTokens: Number(raw.tt) || 0,
                cachedTokens: Number(raw.cached) || 0,
              },
            });
            break;
          case "error":
            dispatch({
              type: "SET_ERROR",
              messageId: assistantId,
              errorText: typeof raw.m === "string" ? raw.m : "未知错误",
            });
            break;
          case "done":
            dispatch({
              type: "FINISH_STREAM",
              messageId: assistantId,
              stopReason: typeof raw.sr === "string" ? raw.sr : undefined,
            });
            break;
          case "tool_call":
          case "tool_result":
            dispatch({
              type: "UPSERT_STEP",
              messageId: assistantId,
              step: normalizeStep(raw, `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
            });
            break;
          default:
            break; // 未知类型静默忽略（前后端版本错位时不炸）
        }
      };

      try {
        const body: Record<string, string> = {
          agentId: state.selectedAgentId,
          userId: "default",
          sessionId,
          message: content,
        };
        if (terminalSessionId) {
          body.terminalSessionId = terminalSessionId;
        }

        const response = await fetch(chatStreamUrl(), {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("响应无内容");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const eventBlock of events) {
            const data = sseDataOf(eventBlock);
            if (!data) continue;
            let payload: { v?: string; s?: unknown };
            try {
              payload = JSON.parse(data);
            } catch {
              continue; // 半截/畸形 JSON：跳过而不是中断整条流
            }
            if (payload.v) {
              dispatch({ type: "APPEND_STREAM", messageId: assistantId, chunk: payload.v });
            }
            if (payload.s) {
              const steps = Array.isArray(payload.s) ? payload.s : [payload.s];
              for (const step of steps) {
                if (step && typeof step === "object") {
                  applyStep(step as Record<string, unknown>);
                }
              }
            }
          }
        }

        // 流自然结束（done 已提前收尾时这里是幂等的）
        dispatch({ type: "FINISH_STREAM", messageId: assistantId });
      } catch (err) {
        if (controller.signal.aborted) {
          // 用户主动停止：保留已收到的内容，标记 stopped（不是失败）
          dispatch({ type: "FINISH_STREAM", messageId: assistantId, status: "stopped" });
        } else {
          console.error("对话流式请求失败", err);
          dispatch({ type: "SET_MESSAGE_STATUS", id: assistantId, status: "error" });
          dispatch({ type: "SET_ERROR", messageId: assistantId, errorText: String(err) });
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          streamingMessageRef.current = null;
        }
        dispatch({ type: "SET_SENDING", sending: false });
      }
    },
    [state.conversations, state.activeConversationId, state.selectedAgentId, dispatch]
  );

  /** 重新生成：丢掉最后一条回答，用上一条用户消息重发（不再只是删除） */
  const regenerate = useCallback(
    (terminalSessionId?: string) => {
      const conv = state.conversations.find((c) => c.id === state.activeConversationId);
      const lastUser = [...(conv?.messages || [])].reverse().find((m) => m.role === "user");
      if (!lastUser) return;
      dispatch({ type: "DROP_LAST_ASSISTANT" });
      sendMessage(lastUser.content, terminalSessionId, false);
    },
    [state.conversations, state.activeConversationId, sendMessage, dispatch]
  );

  return { sendMessage, stopStreaming, regenerate };
}
