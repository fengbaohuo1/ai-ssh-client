// ===== SSH 服务器 =====
export interface SshServer {
  id: string;
  name: string;
  host: string;
  port: number; // 默认 22
  username: string;
  authMethod: "password" | "key";
  password?: string;
  tags?: string[];
  lastConnected?: number;
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
