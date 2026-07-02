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

/** 对话响应（非流式） */
export interface ChatResponse {
  content: string;
  steps?: string;
}

/** 获取智能体配置列表 */
export async function listAgents() {
  return apiGet<AgentConfig[]>("/api/v1/query_ai_agent_config_list");
}

/** 创建会话 */
export async function createSession(data: CreateSessionRequest) {
  return apiPost<CreateSessionResponse>("/api/v1/create_session", data);
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
