import { useEffect, useMemo, useRef, useState } from "react";
import { useLayoutStore, type SidebarView } from "../../stores/layoutStore";
import { useSshState, useSshActions } from "../../contexts/SshContext";
import { useTerminalDispatch } from "../../contexts/TerminalContext";
import { useChatDispatch } from "../../contexts/ChatContext";
import { useThemeStore } from "../../stores/themeStore";
import { useFileExplorerStore } from "../../stores/fileExplorerStore";
import { toast } from "../../stores/toastStore";
import type { SshServer } from "../../types";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

const VIEWS: { id: SidebarView; label: string; hint: string }[] = [
  { id: "overview", label: "运维概览", hint: "健康 / 统计 / 安全姿态" },
  { id: "ssh", label: "SSH 服务器", hint: "主机列表与分组" },
  { id: "files", label: "远程文件", hint: "IDE 文件树 / 拖拽上传" },
  { id: "history", label: "会话历史", hint: "历史对话" },
  { id: "audit", label: "操作审计", hint: "命令与文件操作留痕" },
  { id: "config", label: "AI 配置", hint: "模型 / 工具 / 运行参数" },
];

/** 命令面板（Ctrl/Cmd + K）：视图切换、服务器连接、文件管理与快捷动作 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setLeftView = useLayoutStore((s) => s.setLeftSidebarView);
  const { servers, activeConnectionId } = useSshState();
  const { connectServer, fetchServers, setActiveConnection } = useSshActions();
  const terminalDispatch = useTerminalDispatch();
  const chatDispatch = useChatDispatch();
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const openExplorer = useFileExplorerStore((s) => s.open);

  const activeServer = servers.find((s) => s.id === activeConnectionId);

  const connectServerAction = async (server: SshServer) => {
    setOpen(false);
    const res = await connectServer(server.id);
    if (res?.code === "0000") {
      terminalDispatch({ type: "OPEN_SERVER_TAB", serverId: server.id, serverName: server.name });
      setActiveConnection(server.id);
    }
  };

  const items = useMemo<CommandItem[]>(() => {
    const viewItems: CommandItem[] = VIEWS.map((view) => ({
      id: `view-${view.id}`,
      label: `打开 ${view.label}`,
      hint: view.hint,
      group: "视图",
      keywords: view.id,
      run: () => {
        setLeftView(view.id);
        setOpen(false);
      },
    }));

    const serverItems: CommandItem[] = servers.slice(0, 12).map((server) => ({
      id: `server-${server.id}`,
      label: `连接 ${server.name}`,
      hint: `${server.username}@${server.host}:${server.port}${server.groupName ? ` · ${server.groupName}` : ""}`,
      group: "服务器",
      keywords: `${server.name} ${server.host} ${server.username} ${server.groupName ?? ""} ${(server.tags ?? []).join(" ")}`,
      run: () => void connectServerAction(server),
    }));

    const actionItems: CommandItem[] = [
      {
        id: "files-active",
        label: "打开当前服务器文件管理",
        hint: activeServer ? `${activeServer.username}@${activeServer.host}` : "请先绑定 AI 目标服务器",
        group: "动作",
        run: () => {
          if (!activeServer) {
            toast.info("请先选择并连接目标服务器");
            return;
          }
          openExplorer({ connectionId: activeServer.id, serverName: activeServer.name });
          setOpen(false);
        },
      },
      {
        id: "refresh-servers",
        label: "刷新服务器列表",
        group: "动作",
        run: () => {
          void fetchServers();
          setOpen(false);
        },
      },
      {
        id: "new-chat",
        label: "新建 AI 对话",
        group: "动作",
        run: () => {
          chatDispatch({ type: "NEW_CONVERSATION" });
          setOpen(false);
        },
      },
      {
        id: "toggle-theme",
        label: currentTheme === "dark" ? "切换到浅色主题" : "切换到深色主题",
        group: "动作",
        run: () => {
          setTheme(currentTheme === "dark" ? "light" : "dark");
          setOpen(false);
        },
      },
    ];

    return [...viewItems, ...serverItems, ...actionItems];
  }, [servers, activeServer, currentTheme, setLeftView, setTheme, chatDispatch, fetchServers, openExplorer, terminalDispatch, setActiveConnection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const text = `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""} ${item.group}`.toLowerCase();
      return q.split(/\s+/).every((token) => text.includes(token));
    });
  }, [items, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const runItem = (item: CommandItem | undefined) => {
    if (!item) return;
    void item.run();
  };

  let renderIndex = -1;
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[14vh]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="relative w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-dropdown)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--text-tertiary)]">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((value) => Math.min(value + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runItem(filtered[index]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="输入命令、服务器名或视图…"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-tertiary)]">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">没有匹配的命令</div>
          ) : (
            filtered.map((item) => {
              renderIndex += 1;
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const currentIndex = renderIndex;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <div className="px-4 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                      {item.group}
                    </div>
                  ) : null}
                  <button
                    data-cmd-index={currentIndex}
                    onMouseEnter={() => setIndex(currentIndex)}
                    onClick={() => runItem(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                      index === currentIndex ? "bg-[var(--surface-active)]" : "hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-[var(--text-primary)]">{item.label}</span>
                      {item.hint ? (
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-tertiary)]">{item.hint}</span>
                      ) : null}
                    </span>
                    {index === currentIndex ? (
                      <kbd className="shrink-0 rounded border border-[var(--border-default)] bg-[var(--surface-panel)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-tertiary)]">
                        ↵
                      </kbd>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border-default)] px-4 py-2 text-[9px] text-[var(--text-tertiary)]">
          <span>↑↓ 选择</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>
  );
}
