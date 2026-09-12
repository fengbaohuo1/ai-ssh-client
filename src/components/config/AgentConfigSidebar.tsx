import { useCallback, useState } from "react";
import { useChatState, useChatDispatch } from "../../contexts/ChatContext";
import { listAgents, baseUrlHost, formatContextSize } from "../../api/chat";
import type { AgentConfig, McpToolInfo, ProviderCapabilitiesInfo, SkillInfo } from "../../api/chat";

interface Props {
  onClose: () => void;
}

/**
 * AI 配置侧栏（只读）：展示后端配置文件（agent/*.yml）解析出的真实信息——
 * 模型（名/服务地址/上下文窗口）、子智能体、工作流、MCP 工具、技能、运行插件。
 * 能力未启用时如实显示"配置文件未配置"，替代原有的"即将推出"占位。
 */
export default function AgentConfigSidebar({ onClose }: Props) {
  const { agents, selectedAgentId, loadingAgents } = useChatState();
  const dispatch = useChatDispatch();
  const [refreshing, setRefreshing] = useState(false);

  const selected = agents.find((a) => a.agentId === selectedAgentId) || null;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await listAgents();
      if (res.code === "0000" && res.data) {
        dispatch({ type: "SET_AGENTS", agents: res.data });
      }
    } catch (err) {
      console.error("刷新智能体配置失败", err);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 h-[38px] border-b border-[var(--border-default)] shrink-0">
        <h2 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em]">
          AI 配置
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={refreshing}
            title="刷新"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button
            onClick={onClose}
            title="收起"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loadingAgents && agents.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--accent-bg)] rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            <p className="text-xs text-[var(--text-secondary)] mb-1">暂无智能体配置</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">请检查后端配置文件与查询接口</p>
          </div>
        ) : (
          <div className="py-1.5">
            {/* Agent selector（多智能体时点选，与输入栏模型信息联动） */}
            <div className="px-3 pb-1.5 space-y-1">
              {agents.map((a) => (
                <button
                  key={a.agentId}
                  onClick={() => dispatch({ type: "SELECT_AGENT", agentId: a.agentId })}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    selectedAgentId === a.agentId
                      ? "bg-[var(--surface-active)] border-[var(--accent-bg)]/40"
                      : "bg-[var(--surface-input)] border-transparent hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)] truncate">{a.agentName}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {a.agentId} · {a.appName || "-"}
                  </div>
                </button>
              ))}
            </div>

            {selected ? (
              <AgentDetail agent={selected} />
            ) : null}
          </div>
        )}
      </div>

      {/* Foot note */}
      <div className="px-4 py-2 border-t border-[var(--border-default)] shrink-0">
        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
          数据来自后端配置文件（agent/*.yml），只读展示
        </p>
      </div>
    </div>
  );
}

/** 单个智能体的配置详情卡片（只读） */
function AgentDetail({ agent }: { agent: AgentConfig }) {
  const model = agent.chatModel;
  return (
    <div className="px-3 pt-1.5 space-y-3">
      {/* 模型 */}
      <Section title="模型配置">
        <KV
          k="模型通道"
          v={model?.providerName || model?.provider || "-"}
          sub={model?.provider ? `provider: ${model.provider}` : undefined}
        />
        <KV
          k="通道能力"
          v={capabilityText(model?.capabilities)}
          sub={model?.capabilities?.note}
        />
        <KV k="模型" v={model?.modelName || "-"} />
        <KV k="服务地址" v={model?.baseUrl || "-"} sub={model?.baseUrl ? baseUrlHost(model.baseUrl) : undefined} />
        <KV k="上下文窗口" v={model?.contextSize ? `${formatContextSize(model.contextSize)} tokens` : "-"} />
        <KV k="推理强度" v={model?.reasoningEffort || "未配置（模型默认）"} />
      </Section>

      {/* 角色与派发关系（配置驱动父子协作：编排者只拆解派发、执行者才持有 executeCommand） */}
      {agent.agentRoles && agent.agentRoles.length > 0 && (
        <Section title="角色与派发关系">
          {agent.agentRoles.map((role, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[var(--text-primary)]">{role.name}</span>
                {role.orchestrator ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)]">
                    编排
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)]">
                    执行
                  </span>
                )}
                {role.outputKey ? (
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">→ {role.outputKey}</span>
                ) : null}
              </div>
              {role.description ? (
                <div className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">{role.description}</div>
              ) : null}
              {role.delegates && role.delegates.length > 0 ? (
                <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                  可派发：{role.delegates.join(" / ")}
                </div>
              ) : null}
            </div>
          ))}
        </Section>
      )}
      {agent.agentWorkflows && agent.agentWorkflows.length > 0 && (
        <Section title="工作流">
          {agent.agentWorkflows.map((wf, i) => (
            <div key={i} className="text-xs text-[var(--text-primary)]">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)] mr-1.5 font-mono uppercase">
                {wf.type}
              </span>
              {wf.name}
              {wf.description ? <span className="block text-[10px] text-[var(--text-tertiary)] mt-0.5">{wf.description}</span> : null}
            </div>
          ))}
        </Section>
      )}

      {/* 能力：MCP / 技能 / 插件 */}
      <Section title="MCP 工具">
        {agent.mcpTools && agent.mcpTools.length > 0 ? (
          <div className="space-y-1">
            {agent.mcpTools.map((m, i) => (
              <McpRow key={i} tool={m} />
            ))}
          </div>
        ) : (
          <Empty text="配置文件未启用 MCP（可在 chat-model.tool-mcp-list 配置）" />
        )}
      </Section>

      <Section title="技能">
        {agent.skills && agent.skills.length > 0 ? (
          <div className="space-y-1">
            {agent.skills.map((s, i) => (
              <SkillRow key={i} skill={s} />
            ))}
          </div>
        ) : (
          <Empty text="配置文件未配置技能（可在 chat-model.tool-skills-list 配置）" />
        )}
      </Section>

      <Section title="运行插件">
        {agent.plugins && agent.plugins.length > 0 ? (
          <Chips items={agent.plugins} />
        ) : (
          <Empty text="配置文件未配置插件（runner.plugin-name-list）" />
        )}
      </Section>
    </div>
  );
}

/**
 * 通道能力摘要（只读）：把"这条通道少了什么能力"摆在明面上——
 * 缺能力时后端是静默降级（拿不到草稿/拿不到缓存命中），不写出来就只能靠猜。
 */
function capabilityText(cap?: ProviderCapabilitiesInfo): string {
  if (!cap) return "未知通道（装配期将报错）";
  const mark = (supported?: boolean) => (supported ? "✔" : "✘");
  const cache = cap.cacheMetricsGeneric ? "通用字段" : "原生 usage";
  return `草稿流式 ${mark(cap.reasoningDraftStreaming)} · 回放 ${mark(cap.reasoningDraftReplay)} · 缓存 ${cache} · 思考开关 ${mark(cap.thinkingToggle)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.04em] mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-[var(--text-tertiary)] flex-shrink-0">{k}</span>
      <span className="text-[var(--text-primary)] text-right break-all" title={sub}>
        {v}
      </span>
    </div>
  );
}

function McpRow({ tool }: { tool: McpToolInfo }) {
  return (
    <div className="flex items-center gap-2 text-xs min-w-0">
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)] font-mono uppercase flex-shrink-0">
        {tool.kind || "-"}
      </span>
      <span className="text-[var(--text-primary)] truncate">{tool.name || "-"}</span>
      {tool.target ? (
        <span className="text-[10px] text-[var(--text-tertiary)] truncate font-mono" title={tool.target}>
          {tool.target}
        </span>
      ) : null}
    </div>
  );
}

function SkillRow({ skill }: { skill: SkillInfo }) {
  return (
    <div className="flex items-center gap-2 text-xs min-w-0">
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-input)] text-[var(--text-secondary)] font-mono uppercase flex-shrink-0">
        {skill.type || "-"}
      </span>
      <span className="text-[var(--text-primary)] truncate font-mono" title={skill.path}>
        {skill.path || "-"}
      </span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-input)] text-[var(--text-secondary)]
                     border border-[var(--border-subtle)] font-mono"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">{text}</p>;
}
