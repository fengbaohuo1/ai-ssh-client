import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { setApiBase } from "../api/client";

/** Tauri 注入的全局对象标记；浏览器开发时不存在 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

interface BackendInfo {
  status: "starting" | "ready" | "error" | string;
  baseUrl: string;
  message: string;
  logPath: string;
  dataDir: string;
}

/**
 * 桌面端启动闸门：等待 Rust 拉起本地 Spring Boot sidecar 并通过健康检查，
 * 把真实端口注入 API 客户端后再渲染主界面。浏览器开发模式直接放行。
 */
export default function BackendGate({ children }: { children: ReactNode }) {
  const tauri = isTauriRuntime();
  const [info, setInfo] = useState<BackendInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tauri) return;
    let alive = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const next = await invoke<BackendInfo>("backend_info");
        if (!alive) return;
        setInfo(next);
        if (next.status === "ready") {
          setError(null);
          setApiBase(next.baseUrl);
          return;
        }
        if (next.status === "error") {
          setError(next.message || "本地服务启动失败");
          return;
        }
        timer = window.setTimeout(poll, 500);
      } catch (e) {
        if (!alive) return;
        // invoke 本身失败时也继续重试，避免启动早期竞态直接卡死
        setError(e instanceof Error ? e.message : String(e));
        timer = window.setTimeout(poll, 1000);
      }
    };

    void poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [tauri, attempt]);

  if (!tauri) return <>{children}</>;
  if (info?.status === "ready" && !error) return <>{children}</>;

  const retry = () => {
    setError(null);
    setInfo(null);
    void invoke("backend_start").catch(() => undefined);
    setAttempt((value) => value + 1);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--surface-app)] text-[var(--text-primary)]">
      <div className="w-[520px] max-w-[90vw] rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          {error ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--status-error)]/15 text-[var(--status-error)]">
              !
            </span>
          ) : (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-bg)]" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {error ? "本地服务启动失败" : "正在启动本地服务"}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
              {error || info?.message || "正在加载 Java 运行时与后端…"}
            </div>
          </div>
        </div>

        {error ? (
          <>
            <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-app)] p-3 font-mono text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {error}
            </pre>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={retry}
                className="rounded-md bg-[var(--accent-bg)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                重试
              </button>
              {info?.logPath ? (
                <span className="truncate font-mono text-[10px] text-[var(--text-tertiary)]" title={info.logPath}>
                  日志：{info.logPath}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
            首次启动需要初始化本地数据库，通常几秒钟；数据保存在
            <span className="mx-1 font-mono">{info?.dataDir || "%APPDATA%\\jianingfei.site.aissh"}</span>
            。
          </p>
        )}
      </div>
    </div>
  );
}
