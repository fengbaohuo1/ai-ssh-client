import { apiGet, apiPut, type ApiResponse } from "./client";

/** 后端支持的模型通道（GET /api/v1/agent/config/model -> providers[]） */
export interface AgentProviderOption {
  /** 通道 id，如 deepseek-native / openai-compatible */
  id: string;
  /** 通道展示名 */
  displayName: string;
  /** 该通道允许的推理强度取值（空数组表示由模型自行决定） */
  reasoningEffortValues: string[];
  /** 通道备注（能力差异等） */
  note?: string;
}

/** 模型配置详情（apiKey 不回传，只回传是否已配置） */
export interface AgentModelConfig {
  provider: string;
  baseUrl?: string;
  model?: string;
  contextSize?: number;
  reasoningEffort?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** 后端是否已配置 apiKey（表单只显示状态，不回填明文） */
  apiKeyConfigured: boolean;
  /** 配置表定位键（后端内部标识） */
  tableKey?: string;
  /** 配置文件路径 */
  configPath?: string;
  /** 覆盖配置文件路径 */
  overlayPath?: string;
  /** 可选模型通道 */
  providers: AgentProviderOption[];
}

/** 保存模型配置的请求体（apiKey 为空表示保留原值） */
export interface AgentModelConfigInput {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  contextSize?: number;
  reasoningEffort?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/** 配置写入结果：是否必须重启应用才生效 */
export interface AgentConfigWriteResult {
  restartRequired: boolean;
}

/** Agent 配置文件内容 */
export interface AgentConfigFile {
  path: string;
  content: string;
}

/** 查询模型配置（含可选通道列表与文件路径） */
export async function getModelConfig(): Promise<ApiResponse<AgentModelConfig>> {
  return apiGet<AgentModelConfig>("/api/v1/agent/config/model");
}

/** 保存模型配置；apiKey 留空表示保留后端原值 */
export async function saveModelConfig(
  data: AgentModelConfigInput
): Promise<ApiResponse<AgentConfigWriteResult>> {
  return apiPut<AgentConfigWriteResult>("/api/v1/agent/config/model", data);
}

/** 读取 Agent YAML 配置文件（含路径与内容） */
export async function getAgentConfigFile(): Promise<ApiResponse<AgentConfigFile>> {
  return apiGet<AgentConfigFile>("/api/v1/agent/config/file");
}

/** 保存 Agent YAML 配置文件；YAML 非法时后端返回非 0000 的 code 与 info */
export async function saveAgentConfigFile(
  content: string
): Promise<ApiResponse<AgentConfigWriteResult>> {
  return apiPut<AgentConfigWriteResult>("/api/v1/agent/config/file", { content });
}
