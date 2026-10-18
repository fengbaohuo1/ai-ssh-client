import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getSystemOverview, type SystemOverview } from "../../api/system";

const REFRESH_MS = 15_000;

/**
 * 近期操作动作名 → 中文短标签（未收录的动作回退原始枚举名）。
 * 用 Map 而非对象，后端若返回 toString 之类的键也不会命中原型属性。
 */
const ACTION_LABELS = new Map<string, string>([
  ["COMMAND_EXECUTE", "命令执行"],
  ["FILE_UPLOAD", "上传"],
  ["FILE_DOWNLOAD", "下载"],
  ["FILE_DELETE", "删除"],
  ["FILE_WRITE", "写入"],
  ["CONNECTION_CONNECT", "建立连接"],
  ["CONNECTION_DISCONNECT", "断开连接"],
  ["CONNECTION_CREATE", "新增连接"],
  ["CONNECTION_UPDATE", "修改连接"],
  ["CONNECTION_DELETE", "删除连接"],
  ["FILE_LIST", "浏览"],
  ["FILE_PREVIEW", "预览"],
  ["FILE_RENAME", "重命名"],
  ["FILE_MOVE", "移动"],
  ["FILE_MKDIR", "新建目录"],
  ["AI_CHAT", "AI 对话"],
]);

/**
 * 运维概览侧栏：服务状态、资源计数、智能体、安全开关与近 24h 操作分布。
 * <p>每 15 秒静默刷新；首次失败展示错误卡片，已有数据时刷新失败只提示不遮数据。
 */
export default function OverviewSidebar() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await getSystemOverview();
      if (res.code === "0000" && res.data) {
        setOverview(res.data);
        setError(null);
        setUpdatedAt(Date.now());
      } else {
        setError(res.info || "查询系统概览失败");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 定时静默刷新；组件卸载（切换左侧栏视图）时清理
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const busy = loading || refreshing;

  return (
    <div className="flex flex-col h-full min-w-0 bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 h-[38px] border-b border-[var(--border-default)] shrink-0">
        <h2 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em]">
          运维概览
        </h2>
        <button
          onClick={() => void load(true)}
          disabled={busy}
          title="刷新"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={busy ? "animate-spin" : ""}
          >
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {overview ? (
          <div className="px-3 py-2.5 space-y-3">
            {error ? (
              <InlineError
                message={error}
                disabled={busy}
                onRetry={() => void load(true)}
              />
            ) : null}

            <StatusCard overview={overview} />
            <CountGrid overview={overview} />
            <AgentNames names={overview.agentNames} />
            <SecurityStatus overview={overview} />
            <RecentActions
              counts={overview.auditCountsLast24h}
              auditEnabled={overview.auditEnabled}
            />

            <p className="text-[10px] text-[var(--text-tertiary)] text-center">
              每 15 秒自动刷新
              {updatedAt !== null ? ` · 更新于 ${formatClock(updatedAt)}` : ""}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-input)] flex items-center justify-center mb-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--status-error)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-xs text-[var(--status-error)] mb-1">概览加载失败</p>
            <p className="text-[11px] text-[var(--text-tertiary)] break-all mb-3">{error}</p>
            <button
              onClick={() => void load()}
              className="text-[11px] px-3 py-1.5 rounded-md bg-[var(--accent-bg)] text-[var(--accent-text)]
                         hover:opacity-90 transition-opacity"
            >
              重试
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 服务状态卡片：UP / DEGRADED + 版本、运行时长、Java、系统、数据库 */
function StatusCard({ overview }: { overview: SystemOverview }) {
  const healthy = overview.databaseReachable;
  const statusColor = healthy ? "var(--status-success)" : "var(--status-warning)";

  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <span
            className="text-xs font-semibold tracking-wide flex-shrink-0"
            style={{ color: statusColor }}
          >
            {healthy ? "UP" : "DEGRADED"}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] truncate">
            {healthy ? "运行正常" : "降级运行"}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono flex-shrink-0">
          {versionLabel(overview.version)}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <KV label="运行时长" value={formatUptime(overview.uptimeSeconds)} />
        <KV label="Java" value={overview.javaVersion || "-"} />
        <KV label="系统" value={overview.osName || "-"} />
        <KV
          label="数据库"
          value={healthy ? "可达" : "不可达"}
          color={healthy ? "var(--status-success)" : "var(--status-error)"}
        />
      </div>

      <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
        <span className="flex-shrink-0">服务器时间</span>
        <span
          className="truncate tabular-nums"
          title={overview.serverTime || "-"}
        >
          {formatServerTime(overview.serverTime)}
        </span>
      </div>
    </section>
  );
}

/** 2x2 资源计数 */
function CountGrid({ overview }: { overview: SystemOverview }) {
  const items: { label: string; value: number }[] = [
    { label: "连接总数", value: overview.totalConnections },
    { label: "SSH 会话", value: overview.activeSshSessions },
    { label: "终端会话", value: overview.activeTerminals },
    { label: "智能体", value: overview.configuredAgents },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-2"
        >
          <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums leading-tight">
            {formatCount(item.value)}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentNames({ names }: { names: string[] }) {
  const list = Array.isArray(names) ? names : [];

  return (
    <Section
      title="智能体"
      extra={
        <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
          {list.length}
        </span>
      }
    >
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((name, index) => (
            <span
              key={`${name}-${index}`}
              title={name}
              className="max-w-full truncate text-[10px] px-1.5 py-0.5 rounded-[3px]
                         bg-[var(--surface-input)] text-[var(--text-secondary)]
                         border border-[var(--border-subtle)] font-mono"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <Empty text="未配置智能体" />
      )}
    </Section>
  );
}

function SecurityStatus({ overview }: { overview: SystemOverview }) {
  return (
    <Section title="安全状态">
      <div className="flex flex-wrap gap-1.5">
        <Badge label="审计" on={overview.auditEnabled} />
        <Badge label="接口鉴权" on={overview.authEnabled} />
        <Badge label="凭证主密钥" on={overview.credentialKeyConfigured} />
      </div>
      {!overview.authEnabled ? (
        <p className="mt-1.5 text-[10px] text-[var(--status-warning)] leading-relaxed">
          接口鉴权已关闭，仅建议在本机或受信网络内使用
        </p>
      ) : null}
    </Section>
  );
}

function Badge({ label, on }: { label: string; on: boolean }) {
  const color = on ? "var(--status-success)" : "var(--text-tertiary)";

  return (
    <span
      title={`${label}：${on ? "已开启" : "未开启"}`}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px]
                 bg-[var(--surface-input)] border"
      style={{
        color,
        borderColor: on ? "var(--status-success)" : "var(--border-default)",
      }}
    >
      <span
        className="w-1 h-1 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
      <span className="opacity-75">{on ? "开" : "关"}</span>
    </span>
  );
}

function RecentActions({
  counts,
  auditEnabled,
}: {
  counts: Record<string, number>;
  auditEnabled: boolean;
}) {
  const entries = Object.entries(counts ?? {})
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Section
      title="近 24h 操作"
      extra={
        totalCount > 0 ? (
          <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
            {formatCount(totalCount)} 次
          </span>
        ) : undefined
      }
    >
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([name, count]) => {
            const label = ACTION_LABELS.get(name);
            return (
              <span
                key={name}
                title={`${name} · ${count} 次`}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px]
                           bg-[var(--surface-input)] border border-[var(--border-subtle)]
                           text-[var(--text-secondary)]"
              >
                <span className={label ? "" : "font-mono"}>{label ?? name}</span>
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {count}
                </span>
              </span>
            );
          })}
        </div>
      ) : auditEnabled ? (
        <Empty text="近 24 小时暂无操作记录" />
      ) : (
        <p className="text-[10px] text-[var(--status-warning)] leading-relaxed">
          审计已关闭，未记录操作
        </p>
      )}
    </Section>
  );
}

function InlineError({
  message,
  disabled,
  onRetry,
}: {
  message: string;
  disabled: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--status-error)]/40 px-2.5 py-1.5">
      <span
        className="text-[10px] text-[var(--status-error)] truncate"
        title={message}
      >
        刷新失败：{message}
      </span>
      <button
        onClick={onRetry}
        disabled={disabled}
        className="text-[10px] text-[var(--text-link)] hover:underline flex-shrink-0 disabled:opacity-50"
      >
        重试
      </button>
    </div>
  );
}

function Section({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.04em]">
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function KV({
  label,
  value,
  color,
  title,
}: {
  label: string;
  value: string;
  color?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-[var(--text-tertiary)] flex-shrink-0">{label}</span>
      <span
        className="text-[var(--text-primary)] text-right truncate min-w-0"
        style={color ? { color } : undefined}
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
      {text}
    </p>
  );
}

/** 秒 → 3d 4h 12m / 4h 12m / 12m / 45s */
function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

function formatCount(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("zh-CN") : "-";
}

function versionLabel(version: string): string {
  if (!version) return "-";
  return version.startsWith("v") ? version : `v${version}`;
}

/** 后端时间无时区，按本地时间解析；非法值原样降级展示 */
function parseTimestamp(value: string): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatServerTime(value: string): string {
  const date = parseTimestamp(value);
  if (!date) return value ? value.replace("T", " ") : "-";
  try {
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }
}

function formatClock(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return "-";
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
