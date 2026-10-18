import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import BackendGate from "./components/BackendGate";
import "./index.css";
import { useThemeStore } from "./stores/themeStore";

// 恢复上次主题并同步 Tauri 原生标题栏
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BackendGate>
      <App />
    </BackendGate>
  </React.StrictMode>,
);
