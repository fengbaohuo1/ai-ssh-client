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

  // 编辑模式预填值
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
      // 新增模式重置
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
      />

      {/* 弹窗 */}
      <div className="relative bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[420px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-[#cccccc]">
            {isEdit ? "编辑服务器" : "添加服务器"}
          </h3>
          <button
            onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
            className="text-[#858585] hover:text-[#cccccc] text-base leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* 名称 */}
          <div>
            <label className="block text-xs text-[#cccccc] mb-1.5">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="生产服务器"
              className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2
                         border border-transparent focus:border-[#0078d4] outline-none"
              required
            />
          </div>

          {/* 主机 + 端口 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[#cccccc] mb-1.5">主机</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2
                           border border-transparent focus:border-[#0078d4] outline-none"
                required
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-[#cccccc] mb-1.5">端口</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2
                           border border-transparent focus:border-[#0078d4] outline-none"
                min={1}
                max={65535}
              />
            </div>
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-xs text-[#cccccc] mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2
                         border border-transparent focus:border-[#0078d4] outline-none"
              required
            />
          </div>

          {/* 认证方式 */}
          <div>
            <label className="block text-xs text-[#cccccc] mb-1.5">认证方式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMethod("password")}
                className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                  authMethod === "password"
                    ? "bg-[#094771] border-[#0078d4] text-[#cccccc]"
                    : "bg-[#3c3c3c] border-transparent text-[#858585] hover:text-[#cccccc]"
                }`}
              >
                密码
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod("key")}
                className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                  authMethod === "key"
                    ? "bg-[#094771] border-[#0078d4] text-[#cccccc]"
                    : "bg-[#3c3c3c] border-transparent text-[#858585] hover:text-[#cccccc]"
                }`}
              >
                密钥
              </button>
            </div>
          </div>

          {/* 密码 */}
          {authMethod === "password" && (
            <div>
              <label className="block text-xs text-[#cccccc] mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入 SSH 密码"
                  className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2 pr-16
                             border border-transparent focus:border-[#0078d4] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#858585] hover:text-[#cccccc]"
                >
                  {showPassword ? "隐藏" : "显示"}
                </button>
              </div>
            </div>
          )}

          {/* 标签 */}
          <div>
            <label className="block text-xs text-[#cccccc] mb-1.5">标签（可选）</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                placeholder="输入标签名，回车添加"
                className="flex-1 bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-3 py-2
                           border border-transparent focus:border-[#0078d4] outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 text-xs text-[#cccccc] bg-[#3c3c3c] rounded hover:bg-[#37373d]"
              >
                +
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-[#cccccc]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-[#858585] hover:text-[#cccccc] leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#3c3c3c]">
            <button
              type="button"
              onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
              className="px-4 py-1.5 text-xs text-[#cccccc] bg-[#3c3c3c] rounded hover:bg-[#37373d]"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs text-white bg-[#0078d4] rounded hover:bg-[#0066b3]
                         disabled:opacity-50 disabled:cursor-not-allowed"
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
