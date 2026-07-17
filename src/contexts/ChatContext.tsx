import { createContext, useContext, useReducer, useCallback, useEffect, type Dispatch, type ReactNode } from "react";
import type { ChatMessage, Conversation, StepEvent } from "../types";
import { listAgents, createSession, chatStreamUrl } from "../api/chat";
import type { AgentConfig } from "../api/chat";

// ===== State & Actions =====
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  selectedAgentId: string;
  sessionId: string | null;
  agents: AgentConfig[];
  loadingAgents: boolean;
  sending: boolean;
}

type ChatAction =
  | { type: "NEW_CONVERSATION" }
  | { type: "SEND_MESSAGE"; content: string; assistantId?: string }
  | { type: "APPEND_STREAM"; messageId: string; chunk: string }
  | { type: "APPEND_STEP"; messageId: string; step: StepEvent }
  | { type: "FINISH_STREAM"; messageId: string }
  | { type: "SET_MESSAGE_STATUS"; id: string; status: ChatMessage["status"] }
  | { type: "SELECT_AGENT"; agentId: string }
  | { type: "SET_CONVERSATION_TITLE"; title: string }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "REGENERATE" }
  | { type: "STOP_STREAMING" }
  | { type: "DELETE_CONVERSATION"; id: string }
  | { type: "SWITCH_CONVERSATION"; id: string }
  | { type: "SET_SESSION_ID"; sessionId: string }
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

const initialConversation = createConversation();

const initialState: ChatState = {
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  selectedAgentId: "general",
  sessionId: null,
  agents: [],
  loadingAgents: false,
  sending: false,
};

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
      };
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? { ...c, messages: [...c.messages, userMsg, aiMsg] }
            : c
        ),
      };
    }
    case "APPEND_STREAM":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.messageId
                    ? { ...m, content: m.content + action.chunk }
                    : m
                ),
              }
            : c
        ),
      };
    case "APPEND_STEP":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.messageId
                    ? { ...m, steps: [...(m.steps || []), action.step] }
                    : m
                ),
              }
            : c
        ),
      };
    case "FINISH_STREAM":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.messageId
                    ? { ...m, streaming: false }
                    : m
                ),
              }
            : c
        ),
      };
    case "SET_MESSAGE_STATUS": {
      const { id, status } = action;
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === id ? { ...m, status } : m
                ),
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
          c.id === state.activeConversationId
            ? { ...c, title: action.title }
            : c
        ),
      };
    case "CLEAR_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? { ...c, messages: [] }
            : c
        ),
      };
    case "REGENERATE": {
      const conv = state.conversations.find((c) => c.id === state.activeConversationId);
      if (!conv) return state;
      const msgs = [...conv.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
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
                  m.streaming ? { ...m, streaming: false, status: "sent" } : m
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
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId };
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
const ChatStateContext = createContext<ChatState>(initialState);
const ChatDispatchContext = createContext<Dispatch<ChatAction>>(() => {});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // 应用初始化时拉取智能体列表
  useEffect(() => {
    (async () => {
      dispatch({ type: "SET_LOADING_AGENTS", loading: true });
      try {
        const res = await listAgents();
        if (res.code === "0000" && res.data && res.data.length > 0) {
          dispatch({ type: "SET_AGENTS", agents: res.data });
          // Auto-select first agent if still on default
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
  }, []);

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

// ===== Actions Hook =====
export function useChatActions() {
  const state = useChatState();
  const dispatch = useChatDispatch();

  const sendMessage = useCallback(async (content: string, terminalSessionId?: string) => {
    // 1. 如果没有 session，先创建
    let sessionId = state.sessionId;
    if (!sessionId) {
      dispatch({ type: "SET_SENDING", sending: true });
      try {
        const res = await createSession({
          agentId: state.selectedAgentId,
          userId: "default",
        });
        if (res.code === "0000" && res.data) {
          sessionId = res.data.sessionId;
          dispatch({ type: "SET_SESSION_ID", sessionId });
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

    // 2. 预生成 assistant 消息 ID，传给 reducer 确保后续流事件能定位到它
    const assistantId = generateId();
    dispatch({ type: "SEND_MESSAGE", content, assistantId });

    // 3. 调用流式 SSE API
    dispatch({ type: "SET_SENDING", sending: true });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      // 4. 用 ReadableStream 解析 SSE
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events delimited by \n\n
        const events = buffer.split("\n\n");
        // Keep the last (possibly incomplete) event in the buffer
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;
              try {
                const data = JSON.parse(jsonStr);
                if (data.v) {
                  dispatch({
                    type: "APPEND_STREAM",
                    messageId: assistantId,
                    chunk: data.v,
                  });
                }
                // 解析工具调用步骤
                if (data.s) {
                  const steps = Array.isArray(data.s) ? data.s : [data.s];
                  for (const step of steps) {
                    if (step.t === "tool_call" || step.t === "tool_result") {
                      dispatch({
                        type: "APPEND_STEP",
                        messageId: assistantId,
                        step,
                      });
                    }
                  }
                }
              } catch {
                // Ignore parse errors for malformed SSE data
              }
            }
          }
        }
      }

      dispatch({ type: "FINISH_STREAM", messageId: assistantId });
    } catch (err) {
      console.error("对话流式请求失败", err);
      dispatch({ type: "SET_MESSAGE_STATUS", id: assistantId, status: "error" });
    } finally {
      dispatch({ type: "SET_SENDING", sending: false });
    }
  }, [state.sessionId, state.selectedAgentId, dispatch]);

  return { sendMessage };
}
