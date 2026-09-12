/**
 * 后端基址：开发走 Vite proxy（同源），生产直连本机服务。
 * 需要指向别的地址时用 `VITE_API_BASE` 覆盖（打包/启动时注入），避免地址散落多处。
 */
export const BASE_URL =
  import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "" : "http://localhost:8091");

export interface ApiResponse<T> {
  code: string;
  info: string;
  data: T | null;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}
