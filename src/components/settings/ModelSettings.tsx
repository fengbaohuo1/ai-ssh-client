import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getModelConfig, saveModelConfig } from "../../api/agentConfig";
import type { AgentModelConfig } from "../../api/agentConfig";
import { toast } from "../../stores/toastStore";

/** 表单草稿：数值统一用字符串，便于受控输入与「留空 = 不发送」 */
interface FormState {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  contextSize: string;
  reasoningEffort: string;
  temperature: string;
  topP: string;
  maxTokens: string;
}

const EMPTY_FORM: FormState = {
  provider: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  contextSize: "",
  reasoningEffort: "",
  temperature: "",
  topP: "",
  maxTokens: "",
};

const INPUT_CLASS =
  "w-full rounded-md border border-transparent bg-[var(--surface-input)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]";

/** 数字 -> 输入框文本（undefined/null 显示为空） */
function numToText(value?: number): string {
  return value === undefined || value === null ? "" : String(value);
}

function formFromConfig(config: AgentModelConfig): FormState {
  return {
    provider: config.provider || config.providers[0]?.id || "deepseek-native",
    baseUrl: config.baseUrl ?? "",
    apiKey: "",
    model: config.model ?? "",
    contextSize: numToText(config.contextSize),
    reasoningEffort: config.reasoningEffort ?? "",
    temperature: numToText(config.temperature),
    topP: numToText(config.topP),
    maxTokens: numToText(config.maxTokens),
  };
}

/** 空 -> undefined；非法 -> null（由调用方统一提示） */
function parseNumber(raw: string, integer: boolean): number | undefined | null {
  const text = raw.trim();
  if (!text) return undefined;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  return value;
}

/**
 * 模型配置页：只读回填后端当前配置 + 可编辑表单。
 * apiKey 不由后端回传，输入框为空表示保留原值；数值留空表示跟随后端/模型默认。
 */
export default function ModelSettings() {
  const [config, setConfig] = useState<AgentModelConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getModelConfig();
      if (res.code === "0000" && res.data) {
        setConfig(res.data);
        setForm(formFromConfig(res.data));
      } else {
        setConfig(null);
        setLoadError(res.info || "无法获取模型配置");
      }
    } catch (err) {
      setConfig(null);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const providers = config?.providers ?? [];
  const currentProvider = providers.find((p) => p.id === form.provider) ?? null;

  /** 切通道：baseUrl/model/context/reasoning 为空时补该通道的常用默认值 */
  const handleProviderChange = (providerId: string) => {
    setForm((prev) => {
      const option = providers.find((p) => p.id === providerId) ?? null;
      let reasoningEffort = prev.reasoningEffort;
      // 当前取值不在新通道允许范围时清空（跟随默认），避免保存后被后端拒绝
      if (
        option &&
        option.reasoningEffortValues.length > 0 &&
        reasoningEffort &&
        !option.reasoningEffortValues.includes(reasoningEffort)
      ) {
        reasoningEffort = "";
      }
      const next: FormState = { ...prev, provider: providerId, reasoningEffort };
      if (providerId === "deepseek-native") {
        if (!next.baseUrl.trim()) next.baseUrl = "https://api.deepseek.com";
        if (!next.model.trim()) next.model = "deepseek-flash";
        if (!next.contextSize.trim()) next.contextSize = "128000";
        if (!next.reasoningEffort.trim()) next.reasoningEffort = "high";
      }
      return next;
    });
  };

  const reasoningValues = currentProvider?.reasoningEffortValues ?? [];
  const reasoningOptions =
    form.reasoningEffort && !reasoningValues.includes(form.reasoningEffort)
      ? [...reasoningValues, form.reasoningEffort]
      : reasoningValues;

  const handleSave = async () => {
    const contextSize = parseNumber(form.contextSize, true);
    const temperature = parseNumber(form.temperature, false);
    const topP = parseNumber(form.topP, false);
    const maxTokens = parseNumber(form.maxTokens, true);
    if (contextSize === null || temperature === null || topP === null || maxTokens === null) {
      toast.error(
        "数值格式不正确",
        "上下文窗口 / 最大输出需为整数，温度 / Top-P 需为数字；留空表示使用默认值"
      );
      return;
    }
    const provider = form.provider.trim();
    if (!provider) {
      toast.error("请选择模型通道");
      return;
    }

    const baseUrl = form.baseUrl.trim() || undefined;
    const model = form.model.trim() || undefined;
    const reasoningEffort = form.reasoningEffort.trim() || undefined;
    const apiKeySaved = form.apiKey.trim().length > 0;

    setSaving(true);
    try {
      const res = await saveModelConfig({
        provider,
        baseUrl,
        apiKey: apiKeySaved ? form.apiKey.trim() : undefined,
        model,
        contextSize,
        reasoningEffort,
        temperature,
        topP,
        maxTokens,
      });
      if (res.code !== "0000") {
        toast.error("保存模型配置失败", res.info || "后端返回异常");
        return;
      }
      // 保存成功后：清空 apiKey 草稿（不回显明文），并用已保存值刷新只读信息
      setForm((prev) => ({ ...prev, apiKey: "" }));
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              provider,
              baseUrl,
              model,
              contextSize,
              reasoningEffort,
              temperature,
              topP,
              maxTokens,
              apiKeyConfigured: prev.apiKeyConfigured || apiKeySaved,
            }
          : prev
      );
      toast.success(
        "模型配置已保存",
        res.data?.restartRequired ? "保存后重启应用生效" : undefined
      );
    } catch (err) {
      toast.error("保存模型配置失败", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--status-error)]/35 bg-[var(--status-error)]/10 p-3">
          <div className="text-xs font-medium text-[var(--status-error)]">模型配置加载失败</div>
          <p className="mt-1 break-all text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {loadError}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-md bg-[var(--accent-bg)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 来源信息 */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        <div className="mb-1 text-[11px] font-medium text-[var(--text-primary)]">配置来源</div>
        {config?.configPath ? (
          <div className="break-all">
            配置文件：<span className="font-mono text-[var(--text-secondary)]">{config.configPath}</span>
          </div>
        ) : null}
        {config?.overlayPath ? (
          <div className="mt-0.5 break-all">
            覆盖配置：<span className="font-mono text-[var(--text-secondary)]">{config.overlayPath}</span>
          </div>
        ) : null}
        {config?.tableKey ? (
          <div className="mt-0.5 break-all">
            配置键：<span className="font-mono text-[var(--text-secondary)]">{config.tableKey}</span>
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-info)]" />
          保存后重启应用生效
        </div>
      </div>

      {/* 模型通道 */}
      <section>
        <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]">
          模型通道
        </label>
        {providers.length > 0 ? (
          <select
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={INPUT_CLASS}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName || provider.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={form.provider}
            onChange={(e) => patch("provider", e.target.value)}
            placeholder="通道 id，如 deepseek-native"
            className={INPUT_CLASS}
          />
        )}
        {currentProvider?.note ? (
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
            {currentProvider.note}
          </p>
        ) : null}
      </section>

      {/* 连接信息 */}
      <section className="space-y-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]">
          连接信息
        </div>
        <Field label="服务地址（base-url）">
          <input
            value={form.baseUrl}
            onChange={(e) => patch("baseUrl", e.target.value)}
            placeholder="https://api.deepseek.com"
            spellCheck={false}
            className={`${INPUT_CLASS} font-mono`}
          />
        </Field>
        <Field
          label="API Key"
          hint={
            config?.apiKeyConfigured
              ? "后端已配置 API Key；留空表示保持原值"
              : "后端尚未配置 API Key"
          }
        >
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => patch("apiKey", e.target.value)}
              placeholder={config?.apiKeyConfigured ? "已配置，留空保持" : "请输入 API Key"}
              autoComplete="off"
              spellCheck={false}
              className={`${INPUT_CLASS} pr-14 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showApiKey ? "隐藏" : "显示"}
            </button>
          </div>
        </Field>
        <Field label="模型（model）">
          <input
            value={form.model}
            onChange={(e) => patch("model", e.target.value)}
            placeholder="deepseek-flash"
            spellCheck={false}
            className={`${INPUT_CLASS} font-mono`}
          />
        </Field>
      </section>

      {/* 生成参数 */}
      <section>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]">
          生成参数
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="上下文窗口（context-size）" hint="整数 tokens，留空跟随默认">
            <input
              value={form.contextSize}
              onChange={(e) => patch("contextSize", e.target.value)}
              placeholder="128000"
              inputMode="numeric"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field label="推理强度（reasoning-effort）">
            <select
              value={form.reasoningEffort}
              onChange={(e) => patch("reasoningEffort", e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">跟随默认</option>
              {reasoningOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="温度（temperature）" hint="小数，留空跟随默认">
            <input
              value={form.temperature}
              onChange={(e) => patch("temperature", e.target.value)}
              placeholder="0.7"
              inputMode="decimal"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field label="Top-P" hint="小数，留空跟随默认">
            <input
              value={form.topP}
              onChange={(e) => patch("topP", e.target.value)}
              placeholder="1"
              inputMode="decimal"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field label="最大输出（max-tokens）" hint="整数 tokens，留空跟随默认">
            <input
              value={form.maxTokens}
              onChange={(e) => patch("maxTokens", e.target.value)}
              placeholder="8192"
              inputMode="numeric"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
        </div>
      </section>

      {/* 操作区 */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[10px] leading-relaxed text-[var(--text-tertiary)]">
          保存后需重启应用生效。API Key 只写不回显。
        </p>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="shrink-0 rounded-md bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-[var(--text-secondary)]">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-tertiary)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
