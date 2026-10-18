import { useCallback, useEffect, useRef, useState } from "react";
import {
  listAuditActions,
  listAuditLogs,
  type AuditAction,
  type AuditLog,
  type AuditRiskLevel,
} from "../../api/audit";

const PAGE_SIZE = 50;

const RISK_OPTIONS: { value: AuditRiskLevel; label: string }[] = [
  { value: "LOW", label: "低风险" },
  { value: "MEDIUM", label: "中风险" },
  { value: "HIGH", label: "高风险" },
  { value: "CRITICAL", label: "严重风险" },
];

const SELECT_CLASS = `min-w-0 bg-[var(--surface-input)] text-[var(--text-primary)] text-[11px]
  rounded-md px-2 py-1 outline-none border border-transparent
  focus:border-[var(--border-focus)] cursor-pointer transition-colors duration-150`;

/**
 * 操作审计侧栏：动作/风险筛选 + 分页日志列表。
 * <p>动作字典来自后端 /audit/actions（不硬编码枚举），日志走 /audit/logs 分页；
 * 点击行展开资源、详情、客户端 IP、耗时与完整时间。
 */
export default function AuditLogSidebar() {
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [action, setAction] = useState("");
  const [risk, setRisk] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  // 快速切换筛选时，用序号丢弃过期响应，避免旧结果覆盖新结果
  const requestSeq = useRef(0);

  // 动作字典只需拉一次
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listAuditActions();
        if (alive && res.code === "0000" && res.data) {
          setActions(res.data);
        }
      } catch (err) {
        console.error("加载审计动作字典失败", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setMoreError(null);
    try {
      const res = await listAuditLogs({
        action: action || undefined,
        riskLevel: risk || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (seq !== requestSeq.current) return;
      if (res.code === "0000" && res.data) {
        setLogs(res.data.list ?? []);
        setTotal(res.data.total ?? 0);
        setNextOffset(res.data.offset + (res.data.list?.length ?? 0));
      } else {
        setLogs([]);
        setTotal(0);
        setError(res.info || "查询审计日志失败");
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLogs([]);
      setTotal(0);
      setError(errorText(err));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [action, risk]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || logs.length >= total) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await listAuditLogs({
        action: action || undefined,
        riskLevel: risk || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      if (seq !== requestSeq.current) return;
      if (res.code === "0000" && res.data) {
        const page = res.data.list ?? [];
        setLogs((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...page.filter((item) => !seen.has(item.id))];
        });
        setTotal(res.data.total ?? 0);
        setNextOffset(res.data.offset + page.length);
      } else {
        setMoreError(res.info || "加载更多失败");
      }
    } catch (err) {
      if (seq === requestSeq.current) setMoreError(errorText(err));
    } finally {
      setLoadingMore(false);
    }
  }, [action, risk, loading, loadingMore, logs.length, nextOffset, total]);

  const hasFilter = action !== "" || risk !== "";

  return (
    <div className="flex flex-col h-full min-w-0 bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 h-[38px] border-b border-[var(--border-default)] shrink-0">
        <h2 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em]">
          操作审计
        </h2>
        <button
          onClick={() => void loadFirstPage()}
          disabled={loading}
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
            className={loading ? "animate-spin" : ""}
          >
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] shrink-0">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setExpandedId(null);
          }}
          title="按操作类型筛选"
          className={`${SELECT_CLASS} flex-1`}
        >
          <option value="">全部操作</option>
          {actions.map((item) => (
            <option key={item.name} value={item.name}>
              {item.label || item.name}
            </option>
          ))}
        </select>

        <select
          value={risk}
          onChange={(e) => {
            setRisk(e.target.value);
            setExpandedId(null);
          }}
          title="按风险等级筛选"
          className={`${SELECT_CLASS} w-[88px] shrink-0`}
        >
          <option value="">全部风险</option>
          {RISK_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <p className="text-xs text-[var(--status-error)] mb-1">加载失败</p>
            <p className="text-[11px] text-[var(--text-tertiary)] break-all mb-3">{error}</p>
            <button
              onClick={() => void loadFirstPage()}
              className="text-[11px] px-3 py-1 rounded-md bg-[var(--surface-input)] text-[var(--text-primary)]
                         border border-[var(--border-default)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              重试
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <p className="text-xs text-[var(--text-secondary)] mb-1">
              {hasFilter ? "无匹配审计日志" : "暂无审计日志"}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {hasFilter ? "尝试调整筛选条件" : "产生操作后会自动记录"}
            </p>
          </div>
        ) : (
          <div>
            {logs.map((log) => (
              <AuditLogRow
                key={log.id}
                log={log}
                expanded={expandedId === log.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === log.id ? null : log.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer：还有下一页时提供加载更多 */}
      {!loading && !error && logs.length < total ? (
        <div className="shrink-0 border-t border-[var(--border-default)] px-3 py-2 space-y-1">
          {moreError ? (
            <p className="text-[10px] text-[var(--status-error)] truncate" title={moreError}>
              {moreError}
            </p>
          ) : null}
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md
                       bg-[var(--surface-input)] text-[var(--text-secondary)]
                       hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]
                       transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            {loadingMore ? (
              <span className="w-3 h-3 border border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
            ) : null}
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
          <p className="text-[10px] text-[var(--text-tertiary)] text-center tabular-nums">
            已显示 {logs.length} / {total} 条
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** 单条审计日志：默认紧凑三行，展开后显示完整细节 */
function AuditLogRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const connection = log.connectionName || log.connectionId || "本地";

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full text-left px-3 py-2 transition-colors duration-100
                    ${expanded ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]"}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: riskColor(log.riskLevel) }}
            title={log.riskLabel || log.riskLevel}
          />
          <span className="text-xs text-[var(--text-primary)] truncate min-w-0">
            {log.actionLabel || log.action}
          </span>
          <span className="flex-1" />
          {typeof log.durationMs === "number" ? (
            <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums shrink-0">
              {formatDuration(log.durationMs)}
            </span>
          ) : null}
          <SuccessIcon success={log.success} />
        </div>

        <div className="flex items-baseline gap-1.5 mt-0.5 pl-3 min-w-0">
          <span className="text-[10px] text-[var(--text-secondary)] truncate shrink-0 max-w-[50%]">
            {connection}
          </span>
          {log.resource ? (
            <span
              className="text-[10px] text-[var(--text-tertiary)] font-mono truncate min-w-0"
              title={log.resource}
            >
              {log.resource}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5 pl-3">
          <span
            className="text-[10px] text-[var(--text-tertiary)] truncate"
            title={formatDateTime(log.createdAt)}
          >
            {formatRelativeTime(log.createdAt)}
          </span>
          <span
            className="text-[10px] shrink-0"
            style={{ color: riskColor(log.riskLevel) }}
          >
            {log.riskLabel || log.riskLevel}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="px-3 pb-2.5 pt-1.5 bg-[var(--surface-input)] border-t border-[var(--border-subtle)]">
          <div className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-1 text-[10px] leading-relaxed">
            <span className="text-[var(--text-tertiary)]">资源</span>
            <span className="text-[var(--text-secondary)] font-mono break-all">
              {log.resource || "-"}
            </span>

            <span className="text-[var(--text-tertiary)]">详情</span>
            <span className="text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
              {log.detail || "-"}
            </span>

            <span className="text-[var(--text-tertiary)]">客户端 IP</span>
            <span className="text-[var(--text-secondary)] font-mono break-all">
              {log.clientIp || "-"}
            </span>

            <span className="text-[var(--text-tertiary)]">耗时</span>
            <span className="text-[var(--text-secondary)] tabular-nums">
              {formatDuration(log.durationMs)}
            </span>

            <span className="text-[var(--text-tertiary)]">时间</span>
            <span className="text-[var(--text-secondary)]">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuccessIcon({ success }: { success: boolean }) {
  return success ? (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--status-success)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-label="成功"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--status-error)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-label="失败"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** LOW 绿 / MEDIUM 黄 / HIGH、CRITICAL 红；未知等级用弱化色 */
function riskColor(level: string): string {
  switch (level) {
    case "LOW":
      return "var(--status-success)";
    case "MEDIUM":
      return "var(--status-warning)";
    case "HIGH":
    case "CRITICAL":
      return "var(--status-error)";
    default:
      return "var(--text-tertiary)";
  }
}

/** 后端时间无时区（2026-10-18T17:20:00），按本地时间解析；兼容空格分隔 */
function parseTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(value?: string | null): string {
  const date = parseTimestamp(value);
  if (!date) return value ? value.replace("T", " ").slice(0, 16) : "-";

  const diff = Date.now() - date.getTime();
  if (diff < 0) return formatShortDateTime(date);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return formatShortDateTime(date);
}

function formatShortDateTime(date: Date): string {
  return safeLocale(date, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateTime(value?: string | null): string {
  const date = parseTimestamp(value);
  if (!date) return value ? value.replace("T", " ") : "-";
  return safeLocale(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function safeLocale(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return date.toLocaleString("zh-CN", options);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }
}

function formatDuration(ms?: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
