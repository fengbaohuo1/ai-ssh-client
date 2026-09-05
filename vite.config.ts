import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;

/** 首选端口；被占用时 Vite 自动 +1 寻找空闲端口（strictPort: false） */
const PREFERRED_PORT = 1420;

/**
 * dev 端口联动：把 Vite 实际监听的端口写入 src-tauri/.dev-port.json。
 *
 * 桌面壳（Rust）启动时读取该文件：端口 ≠ devUrl(1420) 时把窗口导航到真实地址——
 * 1420 被占用自动换端口后，`tauri dev` 不再白屏或加载到占用者服务。
 * 纯浏览器调试（npm run dev）不受影响，端口以启动日志为准。
 */
function devPortFile(): Plugin {
  return {
    name: "aissh-dev-port-file",
    apply: "serve",
    configureServer(server) {
      // httpServer 绑定完成后再读取实际端口（strictPort: false 时最终端口此时才确定）
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port =
          typeof addr === "object" && addr !== null ? (addr as { port: number }).port : PREFERRED_PORT;
        void writeFile(
          resolve(process.cwd(), "src-tauri", ".dev-port.json"),
          JSON.stringify({ port }),
          "utf8",
        );
        console.log(`[dev-port] dev server 端口 ${port}${port === PREFERRED_PORT ? "" : "（首选端口被占用，已自动切换）"}`);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), devPortFile()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri dev 下窗口加载地址为 tauri.conf.json 的 devUrl（1420）；
  //    端口被占用时不再直接失败——strictPort: false 让 Vite 自动 +1 换端口，
  //    由 devPortFile 插件把实际端口写给 Rust 侧做窗口导航联动
  server: {
    port: PREFERRED_PORT,
    strictPort: false,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:8091",
        changeOrigin: true,
      },
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
