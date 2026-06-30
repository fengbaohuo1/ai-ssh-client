import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { ChatMessage, Conversation } from "../types";

// ===== State & Actions =====
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  selectedAgentId: string;
}

type ChatAction =
  | { type: "NEW_CONVERSATION" }
  | { type: "SEND_MESSAGE"; content: string }
  | { type: "APPEND_STREAM"; messageId: string; chunk: string }
  | { type: "FINISH_STREAM"; messageId: string }
  | { type: "SET_MESSAGE_STATUS"; id: string; status: ChatMessage["status"] }
  | { type: "SELECT_AGENT"; agentId: string }
  | { type: "SET_CONVERSATION_TITLE"; title: string }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "REGENERATE" }
  | { type: "STOP_STREAMING" }
  | { type: "DELETE_CONVERSATION"; id: string }
  | { type: "SWITCH_CONVERSATION"; id: string };

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
        id: generateId(),
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
    case "SET_MESSAGE_STATUS":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === state.activeConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.id ? { ...m, status: action.status } : m
                ),
              }
            : c
        ),
      };
    case "SELECT_AGENT":
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
      // Remove last assistant message
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
      // Don't delete if it's the only one
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
    default:
      return state;
  }
}

// ===== Context =====
const ChatStateContext = createContext<ChatState>(initialState);
const ChatDispatchContext = createContext<Dispatch<ChatAction>>(() => {});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
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
