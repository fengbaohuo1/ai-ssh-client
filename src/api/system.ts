import { apiGet, readAuth } from "./client";

/** 系统运行概览（GET /api/v1/system/overview） */
export interface SystemOverview {
  /** 服务器当前时间，形如 2026-10-18T17:20:00 */
  serverTime: string;
  version: string;
  uptimeSeconds: number;
  javaVersion: string;
  osName: string;
  databaseReachable: boolean;
  totalConnections: number;
  activeSshSessions: number;
  activeTerminals: number;
  configuredAgents: number;
  agentNames: string[];
  auditEnabled: boolean;
  authEnabled: boolean;
  credentialKeyConfigured: boolean;
  apiTokenConfigured: boolean;
  /** 动作名 → 近 24h 次数 */
  auditCountsLast24h: Record<string, number>;
}

/** 安全面配置（GET /api/v1/system/security） */
export interface SystemSecurity {
  authEnabled: boolean;
  apiTokenConfigured: boolean;
  credentialKeyConfigured: boolean;
  credentialAlgorithm: string;
  publicEndpoints: string[];
  allowedOrigins: string[];
  maxUploadBytes: number;
  maxPreviewBytes: number;
  blockedPaths: string[];
  auditEnabled: boolean;
}

/** 查询系统运行概览 */
export async function getSystemOverview(userId = readAuth().userId) {
  return apiGet<SystemOverview>(
    `/api/v1/system/overview?userId=${encodeURIComponent(userId)}`
  );
}

/** 查询安全面配置（脱敏后的只读信息） */
export async function getSystemSecurity() {
  return apiGet<SystemSecurity>("/api/v1/system/security");
}
