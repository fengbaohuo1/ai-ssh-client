import type { SftpFile } from "../../api/files";

/** 16 进制字节数 → 人类可读大小 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 时间戳 → 列表里的紧凑时间（当天只显示时分） */
export function formatTime(ms: number): string {
  if (!ms) return "-";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Date.now() - ms;
  if (diff >= 0 && diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" }) + " " +
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** 相对/绝对路径拼接（前端导航用，保持 "." 语义） */
export function joinPath(base: string, name: string): string {
  if (!base || base === ".") return name;
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

/** 远程目录 + 子路径拼接（支持 "." 与 "/" 根） */
export function joinRemotePath(base: string, name: string): string {
  if (!name) return base || ".";
  if (name.startsWith("/")) return name;
  if (!base || base === ".") return name;
  if (base === "/") return `/${name}`;
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

/** 取父目录；根目录/主目录返回 null */
export function parentOf(path: string): string | null {
  if (!path || path === "." || path === "/") return null;
  if (path.startsWith("/")) {
    const trimmed = path.replace(/\/+$/, "");
    const index = trimmed.lastIndexOf("/");
    return index <= 0 ? "/" : trimmed.slice(0, index);
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return ".";
  return parts.slice(0, -1).join("/");
}

/** 取路径最后一段 */
export function baseName(path: string): string {
  if (!path) return "";
  const trimmed = path.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index >= 0 ? trimmed.slice(index + 1) : trimmed;
}

/**
 * 从根到目标的祖先链（含目标自身）。
 * `a/b` → [".", "a", "a/b"]；`/a/b` → ["/", "/a", "/a/b"]。
 */
export function ancestorsOf(path: string): string[] {
  if (!path || path === "." || path === "/") return [path || "."];
  if (path.startsWith("/")) {
    const parts = path.split("/").filter(Boolean);
    const chain = ["/"];
    let acc = "";
    for (const part of parts) {
      acc += `/${part}`;
      chain.push(acc);
    }
    return chain;
  }
  const parts = path.split("/").filter(Boolean);
  const chain = ["."];
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    chain.push(acc);
  }
  return chain;
}

/** 拖入文件的相对路径里，文件所在的子目录（不含文件名） */
export function relativeDirOf(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

/** 目录优先、名称不区分大小写排序 */
export function sortFiles(files: SftpFile[]): SftpFile[] {
  return [...files].sort((a, b) => {
    const aDir = a.type === "dir" ? 0 : 1;
    const bDir = b.type === "dir" ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

/** 规范化路径用于比较（去掉尾部斜杠；"." 与 "/" 保留） */
export function normalizePath(path: string): string {
  if (!path) return ".";
  if (path === "/" || path === ".") return path;
  return path.replace(/\/+$/, "");
}

/** 判断两个远程路径是否指向同一目录 */
export function samePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

/** 拖拽事件里是否含有本地文件 */
export function hasFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).includes("Files");
}

/** 远程节点拖拽的私有 MIME，用于和「从系统拖入文件」区分 */
export const REMOTE_DRAG_MIME = "application/x-ai-ssh-path";

/** 拖拽事件里是否含有远程文件树/列表节点 */
export function hasRemoteDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).includes(REMOTE_DRAG_MIME);
}

/** 读取被拖拽远程节点路径（只能在 drop 阶段读取） */
export function readRemoteDrag(dataTransfer: DataTransfer | null): string | null {
  if (!dataTransfer) return null;
  return dataTransfer.getData(REMOTE_DRAG_MIME) || null;
}

/** 判断 path 是否等于 ancestor 或位于其下（前端预校验，后端还有一道闸门） */
export function isSameOrDescendant(ancestor: string, path: string): boolean {
  const a = normalizePath(ancestor);
  const p = normalizePath(path);
  if (a === p) return true;
  if (a === "/") return p.startsWith("/");
  if (a === ".") return !p.startsWith("/");
  return p.startsWith(`${a}/`);
}

/** 移动到 destDir 后的完整目标路径 */
export function moveDestination(sourcePath: string, destDir: string): string {
  return joinRemotePath(destDir, baseName(sourcePath));
}

/** 移动前校验；返回错误文案，null 表示可以移动 */
export function validateMove(sourcePath: string, destDir: string): string | null {
  if (!sourcePath) return "无效的源路径";
  if (isSameOrDescendant(sourcePath, destDir)) return "不能移动到自身或子目录";
  const parent = parentOf(sourcePath) ?? ".";
  if (samePath(parent, destDir)) return "已在该目录中";
  return null;
}

/**
 * 如果当前浏览路径正处在被移动的目录内，返回移动后的新路径；否则 null。
 * 用于拖动目录后保持右侧列表/当前目录不失效。
 */
export function pathAfterMove(sourcePath: string, destination: string, currentPath: string): string | null {
  if (!isSameOrDescendant(sourcePath, currentPath)) return null;
  const source = normalizePath(sourcePath);
  const current = normalizePath(currentPath);
  const suffix = source === current ? "" : current.slice(source.length);
  return `${destination}${suffix}`;
}
