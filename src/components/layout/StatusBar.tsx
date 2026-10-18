import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import { useSshState } from "../../contexts/SshContext";
import { useTerminalState } from "../../contexts/TerminalContext";
import { useSecurityStore } from "../../stores/securityStore";
import { useThemeStore } from "../../stores/themeStore";
import { useLayoutStore } from "../../stores/layoutStore";

interface HealthData {
  status: string;
  version: string;
  database: string;
  uptimeSeconds: number;
  serverTime: string;
}

/** 底部状态栏：后端健康、当前服务器、终端数量、鉴权与主题 */
export default function StatusBar() {
  const { servers, activeConnectionId } = useSshState();
  const { tabs } = useTerminalState();
  const apiToken = useSecurityStore((s) => s.apiToken);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setLeftView = useLayoutStore((s) => s.setLeftSidebarView);

  const [health, setHealth] = useState<HealthData | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await apiGet<HealthData>("/api/v1/system/health");
        if (!alive) return;
        setReachable(res.code === "0000");
        if (res.data) setHealth(res.data);
      } catch {
        if (alive) setReachable(false);
      }
    };
    void poll();
    const timer = window.setInterval(poll, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeServer = servers.find((s) => s.id === activeConnectionId);
  const connectedTabs = tabs.filter((t) => t.status === "connected").length;
  const up = reachable === true && (health?.database ?? "UP") === "UP";

  return (
    <div className="flex h-[24px] shrink-0 select-none items-center gap-3 border-t border-[var(--border-default)] bg-[var(--header-bg)] px-3 text-[10px] text-[var(--text-tertiary)]">
      <span className="flex items-center gap-1.5" title={health ? `数据库 ${health.database} · ${health.serverTime}` : "后端未连接"}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${reachable === null ? "bg-[var(--text-tertiary)]" : up ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"}`}
          style={up ? { boxShadow: "0 0 0 2px color-mix(in srgb, var(--status-success) 25%, transparent)" } : undefined}
        />
        {reachable === null ? "连接中…" : up ? "后端正常" : "后端异常"}
        {health?.version ? <span className="text-[var(--text-tertiary)]">v{health.version}</span> : null}
      </span>

      {activeServer ? (
        <button
          onClick={() => setLeftView("files")}
          className="flex min-w-0 items-center gap-1 truncate hover:text-[var(--text-primary)]"
          title="在左侧打开远程文件树"
        >
          <span className="text-[var(--accent-bg)]">●</span>
          <span className="truncate font-mono">
            {activeServer.username}@{activeServer.host}
          </span>
        </button>
      ) : (
        <span>未绑定 AI 服务器</span>
      )}

      <span>{connectedTabs} 个终端在线</span>

      <div className="flex-1" />

      <span className="hidden md:inline">双击服务器连接 · 左侧文件树拖拽上传</span>

      <span className="flex items-center gap-1" title={apiToken ? "已配置接口令牌" : "未配置接口令牌（后端未开启鉴权时可忽略）"}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {apiToken ? "鉴权已配置" : "无令牌"}
      </span>

      <button
        onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
        className="flex items-center gap-1 hover:text-[var(--text-primary)]"
        title="切换主题"
      >
        {currentTheme === "dark" ? "深色" : "浅色"}
      </button>
    </div>
  );
}
