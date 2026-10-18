import { useEffect, useState } from "react";
import { useSshState, useSshDispatch, useSshActions } from "../../contexts/SshContext";
import { getConnectionDetail } from "../../api/ssh";

type Tab = "basic" | "advanced" | "security";

export default function SshServerDialog() {
  const { isDialogOpen, editingServer } = useSshState();
  const dispatch = useSshDispatch();
  const { addServer, updateServer } = useSshActions();

  const [tab, setTab] = useState<Tab>("basic");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [remark, setRemark] = useState("");
  const [favorite, setFavorite] = useState(false);

  const [connectTimeout, setConnectTimeout] = useState(10);
  const [keepaliveInterval, setKeepaliveInterval] = useState(60);
  const [startupCommand, setStartupCommand] = useState("");
  const [compression, setCompression] = useState(false);
  const [strictHostKeyCheck, setStrictHostKeyCheck] = useState(true);
  const [knownHosts, setKnownHosts] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const isEdit = !!editingServer;

  useEffect(() => {
    if (!isDialogOpen) return;
    setTab("basic");
    setShowPassword(false);
    setTagInput("");
    setPassword("");
    setPrivateKey("");

    if (editingServer) {
      setName(editingServer.name);
      setHost(editingServer.host);
      setPort(editingServer.port);
      setUsername(editingServer.username);
      setAuthMethod(editingServer.authMethod);
      setGroupName(editingServer.groupName ?? "");
      setTags(editingServer.tags ?? []);
      setRemark(editingServer.remark ?? "");
      setFavorite(Boolean(editingServer.favorite));

      // 编辑时补拉高级配置（列表接口不返回这些低频字段）
      setDetailLoading(true);
      getConnectionDetail(editingServer.id)
        .then((res) => {
          if (res.code === "0000" && res.data) {
            setConnectTimeout(res.data.connectTimeout ?? 10);
            setKeepaliveInterval(res.data.keepaliveInterval ?? 60);
            setStartupCommand(res.data.startupCommand ?? "");
            setCompression(res.data.compression === 1);
            setStrictHostKeyCheck(res.data.strictHostKeyCheck !== 0);
            setKnownHosts(res.data.knownHosts ?? "");
          }
        })
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    } else {
      setName("");
      setHost("");
      setPort(22);
      setUsername("");
      setAuthMethod("password");
      setGroupName("");
      setTags([]);
      setRemark("");
      setFavorite(false);
      setConnectTimeout(10);
      setKeepaliveInterval(60);
      setStartupCommand("");
      setCompression(false);
      setStrictHostKeyCheck(true);
      setKnownHosts("");
    }
  }, [editingServer, isDialogOpen]);

  if (!isDialogOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !username.trim()) return;

    const payload = {
      name: name.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      authMethod,
      password: authMethod === "password" ? password : undefined,
      privateKey: authMethod === "key" ? privateKey : undefined,
      groupName: groupName.trim(),
      tags,
      remark: remark.trim(),
      favorite,
      connectTimeout,
      keepaliveInterval,
      startupCommand: startupCommand.trim(),
      compression: compression ? 1 : 0,
      strictHostKeyCheck: strictHostKeyCheck ? 1 : 0,
      knownHosts: knownHosts.trim(),
    };

    if (isEdit && editingServer) {
      await updateServer(editingServer.id, payload);
    } else {
      await addServer(payload);
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
    setTagInput("");
  };

  const loadKeyFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPrivateKey(await file.text());
      setAuthMethod("key");
    } catch {
      // 忽略读取失败
    }
  };

  const inputClass = `w-full bg-[var(--surface-input)] text-[var(--text-primary)] text-xs rounded-md px-3 py-2
    border border-transparent focus:border-[var(--border-focus)] outline-none
    placeholder:text-[var(--text-tertiary)] transition-colors duration-150`;
  const labelClass = "block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-[0.04em]";
  const tabClass = (active: boolean) =>
    `relative px-3 py-2 text-xs transition-colors ${active
      ? "text-[var(--text-primary)]"
      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => dispatch({ type: "CLOSE_DIALOG" })} />

      <div className="relative flex max-h-[88vh] w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-5 py-3.5">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">{isEdit ? "编辑服务器" : "添加服务器"}</h3>
            <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
              {isEdit ? "凭证留空表示保持原值；保存后自动加密存储" : "凭证使用 AES-256-GCM 加密后落库"}
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border-default)] px-3">
          {([
            ["basic", "基础"],
            ["advanced", "高级"],
            ["security", "安全"],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={tabClass(tab === id)}>
              {label}
              {tab === id ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-[var(--accent-bg)]" /> : null}
            </button>
          ))}
          {detailLoading ? <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">加载配置…</span> : null}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {tab === "basic" ? (
              <>
                <div>
                  <label className={labelClass}>名称</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="生产服务器 / Redis 主节点" className={inputClass} required />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={labelClass}>主机</label>
                    <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.1 或 example.com" className={inputClass} required />
                  </div>
                  <div className="w-[92px]">
                    <label className={labelClass}>端口</label>
                    <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={inputClass} min={1} max={65535} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>用户名</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root / ubuntu" className={inputClass} required />
                </div>

                <div>
                  <label className={labelClass}>认证方式</label>
                  <div className="flex gap-2">
                    {(["password", "key"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setAuthMethod(method)}
                        className={`flex-1 rounded-md border py-1.5 text-xs transition-all ${
                          authMethod === method
                            ? "border-[var(--accent-bg)] bg-[var(--surface-active)] text-[var(--text-primary)]"
                            : "border-transparent bg-[var(--surface-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {method === "password" ? "密码" : "私钥"}
                      </button>
                    ))}
                  </div>
                </div>

                {authMethod === "password" ? (
                  <div>
                    <label className={labelClass}>密码</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isEdit ? "留空保持不变" : "输入 SSH 密码"}
                        className={`${inputClass} pr-14`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        {showPassword ? "隐藏" : "显示"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className={`${labelClass} mb-0`}>私钥内容</label>
                      <label className="cursor-pointer text-[10px] text-[var(--accent-bg)] hover:underline">
                        从文件读取
                        <input type="file" className="hidden" onChange={(e) => void loadKeyFile(e.target.files?.[0])} />
                      </label>
                    </div>
                    <textarea
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      rows={5}
                      placeholder={isEdit ? "留空保持不变（粘贴 PEM / OpenSSH 私钥）" : "-----BEGIN OPENSSH PRIVATE KEY-----"}
                      className={`${inputClass} resize-none font-mono text-[11px]`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>分组</label>
                    <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="生产 / 测试 / 数据库" className={inputClass} list="ssh-groups" />
                    <datalist id="ssh-groups">
                      <option value="生产" />
                      <option value="测试" />
                      <option value="预发" />
                      <option value="数据库" />
                      <option value="中间件" />
                    </datalist>
                  </div>
                  <div>
                    <label className={labelClass}>收藏</label>
                    <button
                      type="button"
                      onClick={() => setFavorite(!favorite)}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors ${
                        favorite
                          ? "bg-[var(--surface-active)] text-[var(--status-warning)]"
                          : "bg-[var(--surface-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <span>{favorite ? "★" : "☆"}</span>
                      {favorite ? "已收藏" : "加入收藏"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>标签</label>
                  <div className="flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="输入标签后回车，例如 核心、Redis"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    >
                      +
                    </button>
                  </div>
                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2 py-1 text-[10px] text-[var(--text-primary)]">
                          {tag}
                          <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">×</button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className={labelClass}>备注</label>
                  <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} placeholder="用途、负责人、机房位置等" className={`${inputClass} resize-none`} />
                </div>
              </>
            ) : null}

            {tab === "advanced" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>连接超时（秒）</label>
                    <input type="number" min={1} max={300} value={connectTimeout} onChange={(e) => setConnectTimeout(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>保活间隔（秒）</label>
                    <input type="number" min={0} max={3600} value={keepaliveInterval} onChange={(e) => setKeepaliveInterval(Number(e.target.value))} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>连接后启动命令</label>
                  <input value={startupCommand} onChange={(e) => setStartupCommand(e.target.value)} placeholder="例如 cd /opt/app && tail -f logs/app.log" className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-[var(--surface-input)] px-3 py-2 text-xs text-[var(--text-primary)]">
                    <input type="checkbox" checked={compression} onChange={(e) => setCompression(e.target.checked)} className="accent-[var(--accent-bg)]" />
                    启用压缩
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-[var(--surface-input)] px-3 py-2 text-xs text-[var(--text-primary)]">
                    <input type="checkbox" checked={strictHostKeyCheck} onChange={(e) => setStrictHostKeyCheck(e.target.checked)} className="accent-[var(--accent-bg)]" />
                    严格校验主机密钥
                  </label>
                </div>

                <div>
                  <label className={labelClass}>Known Hosts（可选）</label>
                  <textarea value={knownHosts} onChange={(e) => setKnownHosts(e.target.value)} rows={4} placeholder="host key 条目，启用严格校验时使用" className={`${inputClass} resize-none font-mono text-[11px]`} />
                </div>
              </>
            ) : null}

            {tab === "security" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                    <span className="text-[var(--status-success)]">●</span> 凭证加密存储
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                    密码与私钥在服务端使用 AES-256-GCM 加密后写入数据库；接口永不回传明文。
                    主密钥由后端 <code className="font-mono">AI_SECURITY_CREDENTIAL_KEY</code> 环境变量提供。
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                    <span className="text-[var(--accent-bg)]">●</span> 主机密钥校验
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                    严格校验开启时要求 known_hosts 中存在匹配条目；关闭后接受任意主机密钥（仅建议内网调试使用）。
                  </p>
                </div>
                {editingServer?.lastConnectedAt ? (
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 text-[11px] text-[var(--text-secondary)]">
                    最近成功连接：<span className="font-mono text-[var(--text-primary)]">{editingServer.lastConnectedAt}</span>
                  </div>
                ) : null}
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                    <span className="text-[var(--status-warning)]">●</span> 操作审计
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                    连接建立/断开、命令执行、文件上传下载与删除都会写入审计日志，可在左侧"操作审计"查看。
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-default)] px-5 py-3">
            <button type="button" onClick={() => dispatch({ type: "CLOSE_DIALOG" })} className="rounded-md bg-[var(--surface-input)] px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !host.trim() || !username.trim()}
              className="rounded-md bg-[var(--accent-bg)] px-5 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
