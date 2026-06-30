import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useThemeStore } from "../stores/themeStore";
import "@xterm/xterm/css/xterm.css";

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalTheme = useThemeStore((s) => s.terminalTheme);

  // 创建 Terminal 实例（仅挂载时执行一次）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: terminalTheme,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      cursorBlink: true,
      allowProposedApi: true,
      allowTransparency: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(container);

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // 容器不可见时忽略
      }
    });
    resizeObserver.observe(container);

    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // 主题变化时动态更新终端颜色
  useEffect(() => {
    const term = terminalRef.current;
    if (term) {
      term.options.theme = terminalTheme;
    }
  }, [terminalTheme]);

  return {
    terminal: terminalRef,
    fitAddon: fitAddonRef,
  };
}
