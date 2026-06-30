import { useState, useRef, useCallback } from "react";
import { useChatDispatch } from "../../contexts/ChatContext";

// ===== Model & Reasoning Effort Options =====
const LLM_MODELS = [
  { id: "claude-opus-4.8", name: "Claude Opus 4.8" },
  { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4.5", name: "Claude Haiku 4.5" },
];

const EFFORT_LEVELS = [
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
  { id: "xhigh", name: "极高" },
];

// ===== SVG Icons =====
function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13,2 13,9 20,9" />
    </svg>
  );
}

export default function AiChatInput() {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [model, setModel] = useState("claude-opus-4.8");
  const [effort, setEffort] = useState("medium");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useChatDispatch();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    dispatch({ type: "SEND_MESSAGE", content: trimmed });
    setInput("");
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
    const newHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${newHeight}px`;
  }, []);

  const selectClass =
    "bg-[var(--surface-input)] text-[var(--text-primary)] text-[11px] rounded-md px-2 py-1 outline-none " +
    "border border-transparent focus:border-[var(--border-focus)] cursor-pointer " +
    "hover:bg-[var(--surface-hover)] transition-colors";

  return (
    <div className="border-t border-[var(--border-default)]">
      {/* ===== 输入区 ===== */}
      <div className="p-3 pb-2">
        <div className="bg-[var(--surface-input)] rounded-xl px-3.5 py-2.5
                        border border-transparent focus-within:border-[var(--border-focus)] transition-colors duration-150">
          {/* Textarea */}
          <div className="overflow-y-auto max-h-[150px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleInput(); }}
              onKeyDown={handleKeyDown}
              placeholder="输入命令或问题... (Enter 发送, Shift+Enter 换行)"
              className="w-full bg-transparent text-[var(--text-primary)] text-xs outline-none resize-none
                         placeholder:text-[var(--text-tertiary)] min-h-[20px] overflow-hidden"
              rows={1}
            />
          </div>

          {/* ===== 工具栏行 ===== */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
            {/* 左侧：附件按钮 + 展开 */}
            <div className="flex items-center gap-1">
              {/* 展开/收起按钮 */}
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200
                  ${expanded
                    ? "bg-[var(--surface-active)] text-[var(--text-primary)] rotate-45"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                title={expanded ? "收起" : "更多"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* 附件按钮 — 动画展开/收起 */}
              <div
                className={`flex items-center gap-1 overflow-hidden transition-all duration-200
                  ${expanded ? "w-[108px] opacity-100 ml-1" : "w-0 opacity-0"}`}
              >
                {[
                  { icon: <LinkIcon />, title: "添加链接" },
                  { icon: <ImageIcon />, title: "上传图片" },
                  { icon: <FileIcon />, title: "上传文件" },
                ].map((btn) => (
                  <button
                    key={btn.title}
                    className="flex items-center justify-center w-6 h-6 rounded-md
                               text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                               hover:bg-[var(--surface-hover)] transition-colors"
                    title={btn.title}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧：发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0
                         bg-[var(--accent-bg)] hover:bg-[var(--accent-hover)] text-white
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150 active:scale-95"
              title="发送"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ===== 模型/推理栏（输入区外部下面） ===== */}
      <div className="flex items-center gap-3 px-4 pb-2.5">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">模型</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={selectClass}
          >
            {LLM_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">推理</label>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className={selectClass}
          >
            {EFFORT_LEVELS.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
