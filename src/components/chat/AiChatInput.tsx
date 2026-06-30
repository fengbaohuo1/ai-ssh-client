import { useState, useRef, useCallback } from "react";
import { useChatDispatch } from "../../contexts/ChatContext";

export default function AiChatInput() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useChatDispatch();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    dispatch({ type: "SEND_MESSAGE", content: trimmed });
    setInput("");

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 150); // max 6 行 ≈ 150px
    el.style.height = `${newHeight}px`;
  }, []);

  return (
    <div className="border-t border-[#3c3c3c] p-3">
      <div className="flex items-end gap-2 bg-[#3c3c3c] rounded-lg px-3 py-2">
        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入命令或问题... (Enter 发送, Shift+Enter 换行)"
          className="flex-1 bg-transparent text-[#cccccc] text-xs outline-none resize-none
                     placeholder:text-[#858585] min-h-[20px] max-h-[150px]"
          rows={1}
        />

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex items-center justify-center w-7 h-7 rounded
                     bg-[#0078d4] hover:bg-[#0066b3] text-white
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors flex-shrink-0"
          title="发送"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
