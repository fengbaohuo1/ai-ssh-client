import { useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { useSecurityStore } from "../../stores/securityStore";
import { type SettingsTab } from "../../stores/layoutStore";
import { apiGet, BASE_URL } from "../../api/client";
import { toast } from "../../stores/toastStore";
import ModelSettings from "./ModelSettings";
import AgentConfigEditor from "./AgentConfigEditor";

interface Props {
  open: boolean;
  /** 打开时默认展示的页签（AI 配置侧栏可跳转到 model / agent） */
  initialTab?: SettingsTab;
  onClose: () => void;
}

interface SecurityStatus {
  authEnabled: boolean;
  apiTokenConfigured: boolean;
  credentialKeyConfigured: boolean;
  credentialAlgorithm: string;
  allowedOrigins: string[];
  maxUploadBytes: number;
  maxPreviewBytes: number;
  blockedPaths: string[];
  auditEnabled: boolean;
}

export default function SettingsDialog({ open, initialTab, onClose }: Props) {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const apiToken = useSecurityStore((s) => s.apiToken);
  const userId = useSecurityStore((s) => s.userId);
  const setApiToken = useSecurityStore((s) => s.setApiToken);
  const setUserId = useSecurityStore((s) => s.setUserId);

  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [tokenDraft, setTokenDraft] = useState(apiToken);
  const [userDraft, setUserDraft] = useState(userId);
  const [showToken, setShowToken] = useState(false);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setTokenDraft(apiToken);
      setUserDraft(userId);
    }
  }, [open, apiToken, userId]);

  // 打开时同步到外部指定页签（如 AI 配置侧栏跳转到「模型」/「Agent 配置」）
  useEffect(() => {
    if (open) setTab(initialTab ?? "appearance");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiGet<SecurityStatus>("/api/v1/system/security")
      .then((res) => {
        if (!alive) return;
        if (res.code === "0000" && res.data) {
          setSecurity(res.data);
          setSecurityError(null);
        } else {
          setSecurityError(res.info || "无法获取安全状态");
        }
      })
      .catch((err) => {
        if (alive) setSecurityError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const saveSecurity = () => {
    setApiToken(tokenDraft);
    setUserId(userDraft);
    toast.success("安全设置已保存", tokenDraft ? "请求将携带接口令牌" : "未配置令牌");
    // 立刻用新令牌回读安全姿态，验证令牌是否被后端接受
    apiGet<SecurityStatus>("/api/v1/system/security")
      .then((res) => {
        if (res.code === "0000" && res.data) {
          setSecurity(res.data);
          setSecurityError(null);
        } else {
          setSecurityError(res.info || "令牌校验失败");
        }
      })
      .catch((err) => {
        setSecurityError(err instanceof Error ? err.message : String(err));
      });
  };

  const testConnection = async () => {
    setTesting(true);
    // 先落盘草稿令牌，确保测试请求用的是用户刚输入的值
    setApiToken(tokenDraft);
    setUserId(userDraft);
    try {
      const res = await apiGet<{ status: string; version: string }>("/api/v1/system/health");
      if (res.code === "0000") toast.success("后端连接正常", `版本 ${res.data?.version ?? "-"}`);
      else toast.error("后端返回异常", res.info);
    } catch (err) {
      toast.error("连接失败", err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "appearance", label: "外观" },
    { id: "security", label: "安全" },
    { id: "model", label: "模型" },
    { id: "agent", label: "Agent 配置" },
    { id: "shortcuts", label: "快捷键" },
    { id: "about", label: "关于" },
  ];

  // 模型 / Agent 配置内容更宽更高（仍受 max-w/max-h 约束）
  const wide = tab === "model" || tab === "agent";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className={`relative flex max-h-[88vh] max-w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-2xl ${
          wide ? "h-[720px] w-[820px]" : "h-[560px] w-[640px]"
        }`}
      >
        {/* Left nav */}
        <div className="flex w-[150px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--surface-input)]/40 p-2">
          <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            设置
          </div>
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                tab === item.id
                  ? "bg-[var(--surface-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="px-2 pb-1 text-[9px] text-[var(--text-tertiary)]">AI SSH · v2.0</div>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border-default)] px-5">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              {tabs.find((t) => t.id === tab)?.label}
            </h3>
            <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]" title="关闭">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tab === "appearance" ? (
              <div className="space-y-5">
                <section>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]">主题</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["dark", "light"] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setTheme(theme)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-xs transition-all ${
                          currentTheme === theme
                            ? "border-[var(--accent-bg)] bg-[var(--surface-active)] text-[var(--text-primary)]"
                            : "border-transparent bg-[var(--surface-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <span
                          className="h-8 w-8 rounded-md border border-[var(--border-default)]"
                          style={{ background: theme === "dark" ? "#14161b" : "#f4f6f9" }}
                        />
                        <span className="text-left">
                          <span className="block font-medium">{theme === "dark" ? "深色" : "浅色"}</span>
                          <span className="block text-[10px] text-[var(--text-tertiary)]">
                            {theme === "dark" ? "默认，适合长时间运维" : "明亮环境"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]">界面说明</label>
                  <ul className="space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    <li>· 左侧活动栏：概览 / 服务器 / 历史 / 审计 / AI 配置</li>
                    <li>· 文件按钮或服务器右键可打开 SFTP 文件管理器</li>
                    <li>· 底部状态栏显示后端健康、当前服务器与终端数量</li>
                  </ul>
                </section>
              </div>
            ) : null}

            {tab === "security" ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-primary)]">接口令牌</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] ${security?.authEnabled ? "bg-[var(--status-success)]/15 text-[var(--status-success)]" : "bg-[var(--surface-panel)] text-[var(--text-tertiary)]"}`}>
                      后端{security?.authEnabled ? "已开启鉴权" : "未开启鉴权"}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={tokenDraft}
                      onChange={(e) => setTokenDraft(e.target.value)}
                      placeholder="X-AI-SSH-Token（后端 ai.security.api-token）"
                      className="w-full rounded-md border border-transparent bg-[var(--surface-panel)] px-3 py-2 pr-14 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {showToken ? "隐藏" : "显示"}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={userDraft}
                      onChange={(e) => setUserDraft(e.target.value)}
                      placeholder="用户 ID（默认 default）"
                      className="flex-1 rounded-md border border-transparent bg-[var(--surface-panel)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
                    />
                    <button onClick={saveSecurity} className="rounded-md bg-[var(--accent-bg)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]">
                      保存
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
                    本地保存于浏览器；所有 API 请求自动携带。后端未开启鉴权时可留空。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatusCard
                    title="凭证加密"
                    ok={security?.credentialKeyConfigured ?? false}
                    okText={security?.credentialAlgorithm ?? "AES-256-GCM"}
                    badText="使用开发默认密钥"
                  />
                  <StatusCard
                    title="操作审计"
                    ok={security?.auditEnabled ?? false}
                    okText="已开启"
                    badText="已关闭"
                  />
                </div>

                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 text-[11px] text-[var(--text-secondary)]">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-[var(--text-primary)]">后端连接</span>
                    <button onClick={() => void testConnection()} disabled={testing} className="rounded bg-[var(--surface-panel)] px-2 py-1 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40">
                      {testing ? "测试中…" : "测试连接"}
                    </button>
                  </div>
                  <p className="break-all font-mono text-[10px] text-[var(--text-tertiary)]">{BASE_URL || "同源（Vite proxy）"}</p>
                  {securityError ? <p className="mt-1 text-[10px] text-[var(--status-warning)]">{securityError}</p> : null}
                </div>

                {security ? (
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
                    <div className="mb-1 text-[11px] font-medium text-[var(--text-primary)]">文件系统边界</div>
                    <div>上传上限：{(security.maxUploadBytes / 1024 / 1024).toFixed(0)} MB · 预览上限：{(security.maxPreviewBytes / 1024).toFixed(0)} KB</div>
                    <div className="mt-1 break-all">禁止目录：{security.blockedPaths.join("、")}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "model" ? <ModelSettings /> : null}

            {tab === "agent" ? <AgentConfigEditor /> : null}

            {tab === "shortcuts" ? (
              <div className="space-y-1.5">
                {[
                  { keys: "Enter", desc: "发送 AI 消息" },
                  { keys: "Shift + Enter", desc: "消息换行" },
                  { keys: "Esc", desc: "关闭弹窗 / 文件预览 / 文件管理器" },
                  { keys: "双击服务器", desc: "连接并打开终端" },
                  { keys: "右键服务器", desc: "连接 / 文件管理 / 编辑 / 收藏" },
                  { keys: "Ctrl + K", desc: "（规划中）命令面板" },
                ].map((item) => (
                  <div key={item.keys} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2">
                    <span className="text-[11px] text-[var(--text-primary)]">{item.desc}</span>
                    <kbd className="rounded border border-[var(--border-default)] bg-[var(--surface-panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "about" ? (
              <div className="space-y-3 text-[11px] text-[var(--text-secondary)]">
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-4">
                  <div className="mb-1 text-sm font-semibold text-[var(--text-primary)]">AI SSH 运维平台</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">智能 SSH 连接管理 · 远程文件 · 命令审计 · AI 运维助手</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div>客户端：Tauri v2 + React 19</div>
                    <div>服务端：Spring Boot DDD</div>
                    <div>文件通道：SFTP</div>
                    <div>凭证：AES-256-GCM</div>
                  </div>
                </div>
                <p className="leading-relaxed text-[var(--text-tertiary)]">
                  服务端 DDD 分层：trigger → case → domain ← infrastructure，API 契约集中在 api 模块。
                  文件系统、审计与安全能力均通过领域端口接入，替换实现不影响调用方。
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, ok, okText, badText }: { title: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3">
      <div className="text-[10px] text-[var(--text-tertiary)]">{title}</div>
      <div className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${ok ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"}`} />
        {ok ? okText : badText}
      </div>
    </div>
  );
}
