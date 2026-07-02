import { useState, useRef, useCallback } from "react";
import { useChatDispatch, useChatActions } from "../../contexts/ChatContext";

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

const SLASH_COMMANDS = [
  { cmd: "/explain", desc: "解释终端输出", icon: "💬" },
  { cmd: "/fix", desc: "修复错误", icon: "🔧" },
  { cmd: "/optimize", desc: "优化命令", icon: "⚡" },
  { cmd: "/analyze", desc: "分析系统状态", icon: "📊" },
  { cmd: "/shell", desc: "生成 Shell 脚本", icon: "🐚" },
];

export default function AiChatInput({ isStreaming }: { isStreaming: boolean }) {
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [model, setModel] = useState("claude-opus-4.8");
  const [effort, setEffort] = useState("medium");
  const [searchOn, setSearchOn] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useChatDispatch();
  const { sendMessage } = useChatActions();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

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
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] min-w-0">
            {/* 左侧：附件按钮 + / 指令 */}
            <div className="flex items-center gap-0.5 relative flex-shrink-0">
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

              {/* / 指令按钮 — relative 锚点供下拉框定位 */}
              <span className="relative">
                <button
                  onClick={() => setShowCommands(!showCommands)}
                  className={`flex items-center justify-center w-7 h-6 rounded-md text-sm font-medium transition-all duration-150
                    ${showCommands
                      ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  title="指令"
                >
                  /
                </button>

                {/* ===== / 指令下拉列表 ===== */}
                {showCommands && (
                  <div className="absolute left-0 bottom-full mb-1 z-50 bg-[var(--surface-dropdown)]
                                  border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[210px]">
                    {SLASH_COMMANDS.map((c) => (
                      <button
                        key={c.cmd}
                        onClick={() => {
                          setInput(c.cmd + " ");
                          setShowCommands(false);
                          textareaRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs
                                   text-[var(--text-primary)] hover:bg-[var(--surface-active)]
                                   transition-colors text-left"
                      >
                        <span className="text-sm flex-shrink-0">{c.icon}</span>
                        <span className="font-mono font-medium text-[var(--accent-bg)] text-[11px]">{c.cmd}</span>
                        <span className="text-[var(--text-secondary)] ml-auto">{c.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </span>

              {/* Dropdown backdrop */}
              {showCommands && (
                <div className="fixed inset-0 z-40" onClick={() => setShowCommands(false)} />
              )}
            </div>

            {/* 右侧：停止 / 发送按钮 — 始终不收缩 */}
            <div className="flex-shrink-0">{isStreaming ? (
              <button
                onClick={() => dispatch({ type: "STOP_STREAMING" })}
                className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0
                           bg-[var(--status-error)] hover:bg-red-600 text-white
                           transition-all duration-150 active:scale-95"
                title="停止生成"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ===== 模型/推理栏（输入区外部下面） ===== */}
      <div className="flex items-center gap-3 px-4 pb-2.5">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">模型</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
            {LLM_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">推理</label>
          <select value={effort} onChange={(e) => setEffort(e.target.value)} className={selectClass}>
            {EFFORT_LEVELS.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        {/* Web search toggle */}
        <button
          onClick={() => setSearchOn(!searchOn)}
          className={`flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1 transition-all duration-150
            ${searchOn
              ? "bg-[var(--surface-active)] text-[var(--accent-bg)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          title="联网搜索"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="hidden sm:inline">搜索</span>
        </button>
      </div>
    </div>
  );
}
