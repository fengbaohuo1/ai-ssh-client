import { create } from "zustand";
import type { ITheme } from "@xterm/xterm";

export interface TerminalTheme extends ITheme {}

const DARK_TERMINAL_THEME: TerminalTheme = {
  background: "#14161b",
  foreground: "#d4d4d8",
  cursor: "#ffffff",
  cursorAccent: "#14161b",
  selectionBackground: "#264f78",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

const LIGHT_TERMINAL_THEME: TerminalTheme = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  cursorAccent: "#ffffff",
  selectionBackground: "#d0e4f7",
  black: "#000000",
  red: "#cd3131",
  green: "#0d7a3e",
  yellow: "#8a6d00",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23a55e",
  brightYellow: "#bf8c00",
  brightBlue: "#1a6fd4",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#f5f5f5",
};

interface ThemeState {
  currentTheme: "dark" | "light";
  terminalTheme: TerminalTheme;
  setTheme: (theme: "dark" | "light") => void;
  initTheme: () => void;
}

const THEME_STORAGE_KEY = "ai-ssh-theme";

function loadTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  // 同步 Tauri 原生窗口标题栏主题（动态导入避免浏览器环境初始化异常）
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme === "dark" ? "dark" : "light"))
    .catch(() => {});
}

/** 模块加载即应用主题，避免首帧闪烁；main.tsx 也会调用 initTheme 兜底 */
const initialTheme = loadTheme();
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", initialTheme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: initialTheme,
  terminalTheme: initialTheme === "dark" ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,

  setTheme: (theme) => {
    applyTheme(theme);
    set({
      currentTheme: theme,
      terminalTheme: theme === "dark" ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
    });
  },

  initTheme: () => {
    const theme = useThemeStore.getState().currentTheme;
    applyTheme(theme);
  },
}));
