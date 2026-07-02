import { apiGet, apiPost, apiDelete } from "./client";

/** 创建请求参数（与后端 SshConnectionCreateRequestDTO 对齐） */
export interface CreateConnectionRequest {
  connectionName: string;
  host: string;
  port: number;
  username: string;
  authType: number; // 1=密码, 2=私钥
  password?: string;
  privateKey?: string;
  userId: string;
  // 高级配置（可选）
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

/** 连接响应 */
export interface ConnectionResponse {
  connectionId: string;
  connectionName: string;
  host: string;
  port: number;
  username: string;
  authType: number;
  status: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

export async function createConnection(data: CreateConnectionRequest) {
  return apiPost<ConnectionResponse>("/api/v1/ssh/connection/create", data);
}

export async function connect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/connect`);
}

export async function disconnect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/disconnect`);
}

export async function listConnections(userId: string) {
  return apiGet<ConnectionResponse[]>(`/api/v1/ssh/connection/list?userId=${encodeURIComponent(userId)}`);
}

export async function getConnectionDetail(connectionId: string) {
  return apiGet<ConnectionResponse>(`/api/v1/ssh/connection/${connectionId}`);
}

export async function deleteConnection(connectionId: string) {
  return apiDelete<void>(`/api/v1/ssh/connection/${connectionId}`);
}
