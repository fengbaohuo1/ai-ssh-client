import { apiGet, apiPost } from "./client";

/** 智能体配置 */
export interface AgentConfig {
  agentId: string;
  agentName: string;
  agentDesc: string;
}

/** 创建会话请求 */
export interface CreateSessionRequest {
  agentId: string;
  userId: string;
}

/** 创建会话响应 */
export interface CreateSessionResponse {
  sessionId: string;
}

/** 对话请求 */
export interface ChatRequest {
  agentId: string;
  userId: string;
  sessionId: string;
  message: string;
}

/** 对话响应（非流式）——后端返回多段文本拼接数组 */
export interface ChatResponse {
  content: string[];
}

/** 获取智能体配置列表 */
export async function listAgents() {
  return apiGet<AgentConfig[]>("/api/v1/query_ai_agent_config_list");
}

/** 创建会话 */
export async function createSession(data: CreateSessionRequest) {
  return apiPost<CreateSessionResponse>("/api/v1/create_session", data);
}

/** 会话历史条目（对应后端 ChatSessionResponseDTO） */
export interface SessionListItem {
  sessionId: string;
  agentId: string;
  userId: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

/** 会话历史消息（对应后端 ChatMessageResponseDTO） */
export interface ChatMessageItem {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolCallId?: string;
  createdAt: string;
}

/** 查询会话历史列表（2-8） */
export async function listSessions(agentId: string, userId: string, limit = 30) {
  return apiGet<SessionListItem[]>(
    `/api/v1/query_session_list?agentId=${encodeURIComponent(agentId)}&userId=${encodeURIComponent(userId)}&limit=${limit}`
  );
}

/** 查询某会话的消息列表（2-8 历史回放） */
export async function listMessages(sessionId: string, limit = 100) {
  return apiGet<ChatMessageItem[]>(
    `/api/v1/query_message_list?sessionId=${encodeURIComponent(sessionId)}&limit=${limit}`
  );
}

/** 非流式对话 */
export async function chat(data: ChatRequest) {
  return apiPost<ChatResponse>("/api/v1/chat", data);
}

/** 流式对话 — 返回 SSE URL，前端用 EventSource 消费 */
export function chatStreamUrl(): string {
  // 开发模式走 Vite proxy，生产环境直连
  const base = import.meta.env.DEV ? "" : "http://localhost:8091";
  return `${base}/api/v1/chat_stream`;
}
