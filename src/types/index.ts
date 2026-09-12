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

// ===== 终端标签 =====
export interface TerminalTab {
  id: string;
  serverId?: string;
  serverName: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  errorMessage?: string;
}

/**
 * SSE 步骤事件（协议 v2，与后端 `StepEvents.java` 一一对应）。
 *
 * <p>v2 的三处关键变化：
 * - `id`：步骤稳定标识 → 前端**按 id 幂等 upsert**，并发（批量派发/一次多命令）时不会串台；
 * - `p`：父步骤 id → 子智能体的命令挂在派发卡片下面（缺失即顶层）；
 * - `st/ms/att`：生命周期与耗时 → "在跑 / 成功 / 失败 / 重试第几次 / 花了多久"不再是猜的。
 */
export interface StepEvent {
  /** 步骤稳定标识（后端 call id / FR id / taskId）；缺失时前端补本地 id */
  id: string;
  /** 父步骤 id（嵌套键；缺失 = 顶层） */
  p?: string;
  /** 事件类型 */
  t: "thinking" | "tool_call" | "tool_result" | "usage" | "done" | "error";
  /** 步骤种类（决定卡片形态）：tool / agent / plan */
  k?: "tool" | "agent" | "plan";
  /** 名称（工具名 / 子智能体名） */
  n?: string;
  /** 入参（对象：{command} / {request} / {tasks}） */
  a?: Record<string, unknown>;
  /** 结果（对象：{success,output} / {success,result|error}） */
  r?: Record<string, unknown>;
  /** 生命周期 */
  st?: "running" | "ok" | "error";
  /** 耗时（毫秒，终态步骤） */
  ms?: number;
  /** 重试第几次 / 上限（派发任务） */
  att?: number;
  maxAtt?: number;
  /** 该步骤所属子智能体名（子 Runner 内的事件） */
  ag?: string;
  /** 人类可读消息（错误原因） */
  m?: string;
  /** 前端接收时刻（计时与排序；后端不下发） */
  ts: number;
  /** 步骤在消息文本中的插入位置（前端计算） */
  contentOffset?: number;
}

/** 本回合 token 统计（usage 步骤）：缓存命中来自教程 2-9 的观测链路 */
export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

// ===== AI 聊天 =====
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** stopped = 用户主动停止（与失败区分开） */
  status?: "sending" | "sent" | "error" | "stopped";
  streaming?: boolean;
  /** 工具/派发步骤（协议 v2；按 id upsert） */
  steps?: StepEvent[];
  /** 空泡期"正在分析"标记（收到 thinking 事件后置位，首个文本/步骤到达即清除） */
  thinking?: boolean;
  /** 本回合 token 统计（回合结束时下发；无 usage 则缺席） */
  usage?: UsageInfo;
  /** 结束原因：completed / error（非 completed 时界面提示"本轮中断"） */
  stopReason?: string;
  /** 错误原因（后端 error 步骤） */
  errorText?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  /** 后端会话 ID——同一对话绑定同一后端会话；持久化后重启可接续（后端冷启动恢复） */
  sessionId?: string;
}
