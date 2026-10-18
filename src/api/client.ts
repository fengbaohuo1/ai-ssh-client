/**
 * 后端基址：
 * - 浏览器开发：走 Vite proxy（同源，空串）；
 * - Tauri：由 Rust 启动本地 sidecar 后通过 `setApiBase` 注入实际端口；
 * - 纯网页生产：回退到本机 8091。
 *
 * 注意：这里用 `let` + 函数导出，ES module 的 live binding 保证
 * `chatStreamUrl()` / `useTerminalWebSocket` 等运行期调用能拿到最新值。
 */
const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "" : "http://127.0.0.1:8091");

export let BASE_URL = DEFAULT_BASE_URL;

/** Tauri 启动完成后注入实际后端地址（例如 http://127.0.0.1:53421） */
export function setApiBase(url: string): void {
  BASE_URL = url.replace(/\/+$/, "");
}

export function getApiBase(): string {
  return BASE_URL;
}

/** 本地安全设置键（与 stores/securityStore 共用） */
export const TOKEN_STORAGE_KEY = "ai-ssh.api-token";
export const USER_STORAGE_KEY = "ai-ssh.user-id";
export const DEFAULT_USER_ID = "default";

export interface ApiResponse<T> {
  code: string;
  info: string;
  data: T | null;
}

/** 读取本地令牌 / 用户 ID（无则空） */
export function readAuth(): { token: string; userId: string } {
  try {
    return {
      token: localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() || "",
      userId: localStorage.getItem(USER_STORAGE_KEY)?.trim() || DEFAULT_USER_ID,
    };
  } catch {
    return { token: "", userId: DEFAULT_USER_ID };
  }
}

/** 所有请求统一注入鉴权头与用户标识；后端未开启鉴权时多一个头无副作用 */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const { token, userId } = readAuth();
  const headers: Record<string, string> = { "X-User-Id": userId, ...extra };
  if (token) {
    headers["X-AI-SSH-Token"] = token;
  }
  return headers;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return authHeaders(extra);
}

async function parse<T>(res: Response): Promise<ApiResponse<T>> {
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("未授权：请在设置中配置接口令牌");
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: buildHeaders() });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  return parse<T>(res);
}

/** multipart 上传（浏览器自动设置 boundary，不能手动指定 Content-Type） */
export async function apiUpload<T>(path: string, file: File): Promise<ApiResponse<T>> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: form,
  });
  return parse<T>(res);
}

/**
 * 带进度的 multipart 上传。
 *
 * <p>`fetch` 无法观测上传进度，这里用 XHR；进度只用于 UI，不改变协议。
 */
export function apiUploadWithProgress<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(buildHeaders())) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误：上传请求失败"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.onload = () => {
      if (xhr.status === 401) {
        reject(new Error("未授权：请在设置中配置接口令牌"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as ApiResponse<T>);
      } catch {
        reject(new Error("上传响应解析失败"));
      }
    };
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

/**
 * 下载：GET 二进制 + 解析 Content-Disposition 文件名，触发浏览器保存。
 * 返回实际保存的文件名。
 */
export async function apiDownload(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: buildHeaders() });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("未授权：请在设置中配置接口令牌");
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition")) || "download.bin";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/** Content-Disposition: attachment; filename="x"; filename*=UTF-8''... */
function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value);
  return plain?.[1]?.trim() ?? null;
}
