import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import type { AgentOption } from "../../types";
import AiChatMessages from "./AiChatMessages";
import AiChatInput from "./AiChatInput";

const DEFAULT_AGENTS: AgentOption[] = [
  { id: "general", name: "通用助手", description: "通用的 AI 编程和运维助手" },
  { id: "ops", name: "运维专家", description: "专注 Linux 服务器运维和故障排查" },
  { id: "code", name: "代码审查", description: "代码质量分析和安全审查" },
];

export default function AiChatPanel() {
  const { conversations, activeConversationId, selectedAgentId } = useChatState();
  const dispatch = useChatDispatch();

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  return (
    <div className="flex flex-col h-full bg-[#252526] border-l border-[#3c3c3c]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3c3c3c] min-h-[40px]">
        {/* 标题 */}
        <div className="flex-1 min-w-0 mr-2">
          <input
            type="text"
            value={activeConversation?.title || "新对话"}
            onChange={(e) =>
              dispatch({ type: "SET_CONVERSATION_TITLE", title: e.target.value })
            }
            className="bg-transparent text-sm text-[#cccccc] outline-none border-b border-transparent
                       hover:border-[#3c3c3c] focus:border-[#0078d4] w-full truncate px-1 py-0.5"
          />
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 智能体选择 */}
          <select
            value={selectedAgentId}
            onChange={(e) =>
              dispatch({ type: "SELECT_AGENT", agentId: e.target.value })
            }
            className="bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-2 py-1 outline-none
                       border border-transparent focus:border-[#0078d4] cursor-pointer
                       max-w-[100px] truncate"
          >
            {DEFAULT_AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* 新建对话 */}
          <button
            onClick={() => dispatch({ type: "NEW_CONVERSATION" })}
            className="flex items-center justify-center w-7 h-7 rounded
                       text-[#858585] hover:text-[#cccccc] hover:bg-[#37373d]
                       transition-colors text-base leading-none"
            title="新建对话"
          >
            +
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-hidden">
        <AiChatMessages />
      </div>

      {/* 输入框 */}
      <AiChatInput />
    </div>
  );
}
