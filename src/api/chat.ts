import { apiGet, apiPost, BASE_URL } from "./client";

/** 通道能力声明（后端 ProviderCapabilities 一一对应：这条通道能做什么） */
export interface ProviderCapabilitiesInfo {
  /** 流式响应能否拿到思考草稿 */
  reasoningDraftStreaming?: boolean;
  /** 请求侧能否把思考草稿回写给服务端 */
  reasoningDraftReplay?: boolean;
  /** 通用 usage 字段是否带缓存命中 */
  cacheMetricsGeneric?: boolean;
  /** 能否显式开关思考 */
  thinkingToggle?: boolean;
  /** 该通道接受的推理强度取值 */
  reasoningEffortValues?: string[];
  /** 一句人话说明 */
  note?: string;
}

/** 模型配置信息（配置文件 chat-model，不含 apiKey） */
export interface ChatModelInfo {
  /** 模型通道 id（chat-model.provider，空配置回填默认通道） */
  provider?: string;
  /** 模型通道展示名 */
  providerName?: string;
  /** 通道能力声明 */
  capabilities?: ProviderCapabilitiesInfo;
  /** 模型名（chat-model.model） */
  modelName?: string;
  /** 服务地址（chat-model.base-url） */
  baseUrl?: string;
  /** 模型上下文窗口 tokens（chat-model.context-size） */
  contextSize?: number;
  /** 推理强度（chat-model.reasoning-effort，未配置为空） */
  reasoningEffort?: string;
  /** 采样温度 */
  temperature?: number;
  /** 单次回复最大 token */
  maxTokens?: number;
  /** 核采样 top-p */
  topP?: number;
}

/** 运行期治理参数（只读展示） */
export interface AgentRuntimeInfo {
  maxLlmCalls?: number;
  compactEnabled?: boolean;
  compactTokenThreshold?: number;
  compactEventRetentionSize?: number;
  contextTokenBudget?: number;
  coldStartReplayBudgetChars?: number;
}

export interface AgentWorkflowInfo {
  type?: string;
  name?: string;
  description?: string;
}

export interface McpToolInfo {
  name?: string;
  /** remote / stdio / local */
  kind?: string;
  /** remote=url；stdio=启动命令；local 无 */
  target?: string;
}

export interface SkillInfo {
  /** directory / resource */
  type?: string;
  path?: string;
}

/** 智能体角色与派发关系（配置驱动父子协作） */
export interface AgentRoleInfo {
  name?: string;
  description?: string;
  /** 会话输出键（output-key） */
  outputKey?: string;
  /** 可派发的子智能体名（sub-agents 声明） */
  delegates?: string[];
  /** 是否为编排者（有子智能体的智能体不再持有 executeCommand） */
  orchestrator?: boolean;
  /** 是否只读（不挂载 writeRemoteFile） */
  readOnly?: boolean;
  /** 该角色实际可用的内置工具 */
  tools?: string[];
  /** 指令预览（截断） */
  instructionPreview?: string;
}

/** 智能体配置（后端 query_ai_agent_config_list：配置文件真实信息回传，apiKey 不下发） */
export interface AgentConfig {
  agentId: string;
  agentName: string;
  agentDesc: string;
  /** 配置文件 app-name */
  appName?: string;
  chatModel?: ChatModelInfo;
  /** 子智能体名 */
  subAgents?: string[];
  /** 角色与派发关系（谁可派给谁） */
  agentRoles?: AgentRoleInfo[];
  agentWorkflows?: AgentWorkflowInfo[];
  mcpTools?: McpToolInfo[];
  skills?: SkillInfo[];
  /** runner.plugin-name-list */
  plugins?: string[];
  /** 内置工具清单（命令/文件/派发） */
  builtinTools?: string[];
  /** 运行期治理参数 */
  runtime?: AgentRuntimeInfo;
  /** 配置健康检查告警 */
  configWarnings?: string[];
}

/** 上下文窗口格式化：128000 → "128K"；非整千 → 千分位 */
export function formatContextSize(tokens?: number | null): string {
  if (!tokens || tokens <= 0) return "-";
  if (tokens % 1000 === 0) return `${tokens / 1000}K`;
  return tokens.toLocaleString();
}

/** baseUrl 取 host 展示（https://api.deepseek.com → api.deepseek.com） */
export function baseUrlHost(url?: string | null): string {
  if (!url) return "-";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
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
  /** AI 要操作的 SSH 连接（connectionId）；不传 = 纯对话 */
  terminalSessionId?: string;
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

/** 流式对话 — 返回 SSE URL（POST + ReadableStream 消费，EventSource 不支持 POST） */
export function chatStreamUrl(): string {
  return `${BASE_URL}/api/v1/chat_stream`;
}
