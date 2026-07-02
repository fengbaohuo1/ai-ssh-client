import { useState, useEffect } from "react";
import { useSshState, useSshDispatch } from "../../contexts/SshContext";
import type { SshServer } from "../../types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default function SshServerDialog() {
  const { isDialogOpen, editingServer } = useSshState();
  const dispatch = useSshDispatch();

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<SshServer["authMethod"]>("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const isEdit = !!editingServer;

  useEffect(() => {
    if (editingServer) {
      setName(editingServer.name);
      setHost(editingServer.host);
      setPort(editingServer.port);
      setUsername(editingServer.username);
      setAuthMethod(editingServer.authMethod);
      setPassword(editingServer.password || "");
      setTags(editingServer.tags || []);
    } else {
      setName("");
      setHost("");
      setPort(22);
      setUsername("");
      setAuthMethod("password");
      setPassword("");
      setTags([]);
    }
    setShowPassword(false);
    setTagInput("");
  }, [editingServer, isDialogOpen]);

  if (!isDialogOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !username.trim()) return;

    const serverData: SshServer = {
      id: editingServer?.id || generateId(),
      name: name.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      authMethod,
      password: authMethod === "password" ? password : undefined,
      tags: tags.length > 0 ? tags : undefined,
      lastConnected: editingServer?.lastConnected,
      status: editingServer?.status ?? 0,
      userId: editingServer?.userId ?? "",
    };

    if (isEdit) {
      dispatch({ type: "UPDATE_SERVER", server: serverData });
    } else {
      dispatch({ type: "ADD_SERVER", server: serverData });
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const inputClass = `w-full bg-[var(--surface-input)] text-[var(--text-primary)] text-xs rounded-md px-3 py-2
    border border-transparent focus:border-[var(--border-focus)] outline-none
    placeholder:text-[var(--text-tertiary)] transition-colors duration-150`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
      />

      {/* Dialog */}
      <div className="relative bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-xl shadow-2xl
                      w-[420px] max-h-[85vh] overflow-y-auto animate-[dialog-in_0.15s_ease-out]"
           style={{ animation: "dialog-in 0.15s ease-out" }}
      >
        {/* Dialog enter animation */}
        <style>{`
          @keyframes dialog-in {
            from { opacity: 0; transform: scale(0.96) translateY(-8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-default)]">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {isEdit ? "编辑服务器" : "添加服务器"}
          </h3>
          <button
            onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)]
                       hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="生产服务器" className={inputClass} required />
          </div>

          {/* Host + Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">主机</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1" className={inputClass} required />
            </div>
            <div className="w-[84px]">
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">端口</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                className={inputClass} min={1} max={65535} />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="root" className={inputClass} required />
          </div>

          {/* Auth method */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">认证方式</label>
            <div className="flex gap-2">
              {(["password", "key"] as const).map((method) => (
                <button key={method} type="button"
                  onClick={() => setAuthMethod(method)}
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-all duration-150 ${
                    authMethod === method
                      ? "bg-[var(--surface-active)] border-[var(--accent-bg)] text-[var(--text-primary)]"
                      : "bg-[var(--surface-input)] border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {method === "password" ? "密码" : "密钥"}
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          {authMethod === "password" && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">密码</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入 SSH 密码" className={`${inputClass} pr-14`} />
                <button type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-secondary)]
                             hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded transition-colors"
                >
                  {showPassword ? "隐藏" : "显示"}
                </button>
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]">标签（可选）</label>
            <div className="flex gap-2">
              <input type="text" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                placeholder="输入标签名，回车添加" className={inputClass} />
              <button type="button" onClick={handleAddTag}
                className="flex items-center justify-center w-9 h-9 rounded-md text-sm
                           bg-[var(--surface-input)] text-[var(--text-secondary)]
                           hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]
                           transition-colors flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span key={tag}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                               bg-[var(--surface-input)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  >
                    {tag}
                    <button type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] leading-none ml-0.5"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
            <button type="button"
              onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
              className="px-4 py-2 text-xs text-[var(--text-primary)] bg-[var(--surface-input)]
                         rounded-md hover:bg-[var(--surface-hover)] transition-colors"
            >
              取消
            </button>
            <button type="submit"
              className="px-5 py-2 text-xs font-medium text-[var(--accent-text)] bg-[var(--accent-bg)]
                         rounded-md hover:bg-[var(--accent-hover)] transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!name.trim() || !host.trim() || !username.trim()}
            >
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
