import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import AiChatMessages from "./AiChatMessages";
import AiChatInput from "./AiChatInput";

export default function AiChatPanel() {
  const { conversations, activeConversationId } = useChatState();
  const dispatch = useChatDispatch();

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-l border-[var(--border-default)]">
      {/* Header — title + new conversation only */}
      <div className="flex items-center justify-between px-4 h-[42px] border-b border-[var(--border-default)] shrink-0">
        <div className="flex-1 min-w-0 mr-2">
          <input
            type="text"
            value={activeConversation?.title || "新对话"}
            onChange={(e) =>
              dispatch({ type: "SET_CONVERSATION_TITLE", title: e.target.value })
            }
            className="bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none
                       border-b border-transparent hover:border-[var(--border-default)]
                       focus:border-[var(--border-focus)] w-full truncate px-1 py-0.5 transition-colors"
          />
        </div>

        <button
          onClick={() => dispatch({ type: "NEW_CONVERSATION" })}
          className="flex items-center justify-center w-7 h-7 rounded-md
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                     hover:bg-[var(--surface-hover)] transition-colors flex-shrink-0"
          title="新建对话"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <AiChatMessages />
      </div>

      {/* Input */}
      <AiChatInput />
    </div>
  );
}
