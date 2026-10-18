import { useCallback, useEffect, useState } from "react";
import { getAgentConfigFile, saveAgentConfigFile } from "../../api/agentConfig";
import { toast } from "../../stores/toastStore";

/**
 * Agent 配置页：直接编辑后端 agent 配置文件（YAML）。
 * 文件包含 API Key 等敏感信息，页面顶部做显式提醒；保存走 PUT，后端校验失败时展示 info。
 */
export default function AgentConfigEditor() {
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAgentConfigFile();
      if (res.code === "0000" && res.data) {
        setPath(res.data.path);
        setContent(res.data.content);
        setSavedContent(res.data.content);
        setLoaded(true);
      } else {
        // 首次加载失败时 loaded 仍为 false，会展示错误页；重新加载失败则保留原内容
        setError(res.info || "无法读取 Agent 配置文件");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = loaded && content !== savedContent;

  const handleReload = () => {
    if (dirty && !window.confirm("当前有未保存的修改，重新加载将丢弃，是否继续？")) return;
    void load();
  };

  const handleSave = async () => {
    if (!loaded || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveAgentConfigFile(content);
      if (res.code !== "0000") {
        setError(res.info || "保存失败");
        toast.error("保存 Agent 配置失败", res.info || undefined);
        return;
      }
      setSavedContent(content);
      if (res.data?.applied === false) {
        toast.error(
          "配置已保存，但热重装失败",
          res.data.applyMessage || "当前继续使用旧装配，修复后重新保存即可"
        );
      } else {
        toast.success("Agent 配置已保存并立即生效", "新对话轮次使用新装配");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error("保存 Agent 配置失败", message);
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

  if (!loaded) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--status-error)]/35 bg-[var(--status-error)]/10 p-3">
          <div className="text-xs font-medium text-[var(--status-error)]">Agent 配置加载失败</div>
          <p className="mt-1 break-all text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {error || "未知错误"}
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
    <div className="flex flex-col gap-3">
      {/* 文件路径 */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 py-2">
        <div className="text-[10px] text-[var(--text-tertiary)]">配置文件路径</div>
        <div className="mt-0.5 break-all font-mono text-[11px] text-[var(--text-primary)]">
          {path || "-"}
        </div>
      </div>

      {/* 敏感信息警告 */}
      <div className="rounded-lg border border-[var(--status-warning)]/35 bg-[var(--status-warning)]/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--status-warning)]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          敏感信息提醒
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          该文件包含 API Key 等敏感信息，请勿截图或分享；修改前建议先备份。
        </p>
      </div>

      {/* 错误提示（保存失败时保留后端 info） */}
      {error ? (
        <div className="rounded-lg border border-[var(--status-error)]/35 bg-[var(--status-error)]/10 px-3 py-2">
          <div className="text-[10px] font-medium text-[var(--status-error)]">保存/加载失败</div>
          <p className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {error}
          </p>
        </div>
      ) : null}

      {/* YAML 编辑器 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="scrollbar-thin h-[420px] w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-focus)]"
        placeholder="# Agent 配置（YAML）"
      />

      {/* 操作区 */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[10px] leading-relaxed text-[var(--text-tertiary)]">
          {dirty ? "有未保存的修改。" : "没有未保存的修改。"}保存后立即热重装（失败保留旧装配并提示）。
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleReload}
            disabled={saving}
            className="rounded-md bg-[var(--surface-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            重新加载
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="rounded-md bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
