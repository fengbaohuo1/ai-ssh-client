// ===== SSH 服务器（前端展示层，融合后端响应 + 本地元数据） =====
export interface SshServer {
  id: string;                          // ← connectionId（后端主标识）
  name: string;                        // ← connectionName
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";     // ← 转换自 authType（1→password, 2→key）
  password?: string;                   // 仅创建时发送，后端不返回
  tags?: string[];                     // 仅前端本地使用，与服务端无关
  lastConnected?: number;              // ← 由 status=1 时本地记录
  // 后端同步字段（不为 undefined 时表示已从服务端同步）
  status: number;                      // 0=未连接,1=已连接,2=连接中,3=连接失败
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export function authMethodToType(method: "password" | "key"): number {
  return method === "password" ? 1 : 2;
}

export function authTypeToMethod(type: number): "password" | "key" {
  return type === 2 ? "key" : "password";
}

export function statusLabel(status: number): string {
  switch (status) {
    case 0: return "未连接";
    case 1: return "已连接";
    case 2: return "连接中";
    case 3: return "连接失败";
    default: return "未知";
  }
}

// ===== 终端标签 =====
export interface TerminalTab {
  id: string;
  serverId?: string;
  serverName: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  errorMessage?: string;
}

// ===== AI 聊天 =====
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: "sending" | "sent" | "error";
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface AgentOption {
  id: string;
  name: string;
  description: string;
}
