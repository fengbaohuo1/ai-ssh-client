import { apiGet, readAuth } from "./client";

/** 审计风险等级（后端动作字典的枚举值） */
export type AuditRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 审计动作字典项（GET /api/v1/audit/actions） */
export interface AuditAction {
  /** 动作枚举名，如 COMMAND_EXECUTE */
  name: string;
  /** 中文展示名 */
  label: string;
  riskLevel: AuditRiskLevel;
  riskLabel: string;
}

/** 单条审计日志（对应后端 AuditLogResponseDTO） */
export interface AuditLog {
  id: number;
  userId: string;
  connectionId?: string;
  connectionName?: string;
  action: string;
  actionLabel: string;
  resource?: string;
  detail?: string;
  /** 后端返回字符串，正常为 LOW/MEDIUM/HIGH/CRITICAL */
  riskLevel: string;
  riskLabel: string;
  success: boolean;
  durationMs?: number;
  clientIp?: string;
  /** 形如 2026-10-18T17:20:00（无时区，按本地时间解析） */
  createdAt: string;
}

/** 审计日志分页结果 */
export interface AuditLogPage {
  list: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/** 审计日志查询条件（缺省字段按空串/默认值补齐） */
export interface AuditLogQuery {
  userId?: string;
  connectionId?: string;
  action?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;

/** 查询动作字典：筛选下拉与展示名的唯一来源，避免前端硬编码枚举漂移 */
export async function listAuditActions() {
  return apiGet<AuditAction[]>("/api/v1/audit/actions");
}

/** 分页查询审计日志 */
export async function listAuditLogs(query: AuditLogQuery = {}) {
  // 与后端契约一致：筛选项始终携带（未设置时为空串），避免可选参数声明差异导致 400
  const params = new URLSearchParams();
  params.set("userId", query.userId?.trim() || readAuth().userId);
  params.set("connectionId", query.connectionId ?? "");
  params.set("action", query.action ?? "");
  params.set("riskLevel", query.riskLevel ?? "");
  params.set("limit", String(query.limit ?? DEFAULT_LIMIT));
  params.set("offset", String(query.offset ?? 0));

  return apiGet<AuditLogPage>(`/api/v1/audit/logs?${params.toString()}`);
}
