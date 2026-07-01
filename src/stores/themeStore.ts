import { create } from "zustand";
import type { ITheme } from "@xterm/xterm";

export interface TerminalTheme extends ITheme {}

const DARK_TERMINAL_THEME: TerminalTheme = {
  background: "#1b1c1f",
  foreground: "#d4d4d8",
  cursor: "#ffffff",
  cursorAccent: "#1b1c1f",
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
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: "dark",
  terminalTheme: DARK_TERMINAL_THEME,

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    // 同步 Tauri 原生窗口标题栏主题（动态导入避免浏览器环境初始化异常）
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme === "dark" ? "dark" : "light"))
      .catch(() => {});
    set({
      currentTheme: theme,
      terminalTheme: theme === "dark" ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
    });
  },
}));
