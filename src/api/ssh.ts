import { apiGet, apiPost, apiPut, apiDelete } from "./client";

export interface CreateConnectionRequest {
  connectionName: string;
  host: string;
  port: number;
  username: string;
  authType: number; // 1=密码, 2=私钥
  password?: string;
  privateKey?: string;
  userId: string;
  groupName?: string;
  tags?: string[];
  remark?: string;
  favorite?: boolean;
  // 高级配置（可选）
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

export interface UpdateConnectionRequest {
  connectionName?: string;
  host?: string;
  port?: number;
  username?: string;
  authType?: number;
  password?: string;
  privateKey?: string;
  groupName?: string;
  tags?: string[];
  remark?: string;
  favorite?: boolean;
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

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
  groupName?: string;
  tags?: string[];
  remark?: string;
  favorite?: boolean;
  lastConnectedAt?: string;
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

export interface SshGroup {
  name: string;
  count: number;
  favoriteCount: number;
}

export async function createConnection(data: CreateConnectionRequest) {
  return apiPost<ConnectionResponse>("/api/v1/ssh/connection/create", data);
}

export async function updateConnection(connectionId: string, data: UpdateConnectionRequest) {
  return apiPut<ConnectionResponse>(`/api/v1/ssh/connection/${connectionId}`, data);
}

export async function connect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/connect`);
}

export async function disconnect(connectionId: string) {
  return apiPost<void>(`/api/v1/ssh/connection/${connectionId}/disconnect`);
}

export async function listConnections(userId: string) {
  return apiGet<ConnectionResponse[]>(
    `/api/v1/ssh/connection/list?userId=${encodeURIComponent(userId)}`
  );
}

export async function listGroups(userId: string) {
  return apiGet<SshGroup[]>(`/api/v1/ssh/connection/groups?userId=${encodeURIComponent(userId)}`);
}

export async function getConnectionDetail(connectionId: string) {
  return apiGet<ConnectionResponse>(`/api/v1/ssh/connection/${connectionId}`);
}

export async function deleteConnection(connectionId: string) {
  return apiDelete<void>(`/api/v1/ssh/connection/${connectionId}`);
}
