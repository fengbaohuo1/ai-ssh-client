import type { SftpFileType } from "../../api/files";

interface Props {
  type: SftpFileType;
  name?: string;
  size?: number;
  className?: string;
}

/** 按扩展名给文件着色，让树/列表像 IDE 一样一眼分辨类型 */
function colorOf(name: string | undefined, type: SftpFileType): string {
  if (type === "dir") return "var(--accent-bg)";
  if (type === "link") return "var(--status-info)";
  const ext = name?.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (["ts", "tsx", "js", "jsx", "py", "java", "go", "rs", "c", "cpp", "h", "sh", "bash", "zsh", "sql"].includes(ext)) {
    return "var(--accent-2)";
  }
  if (["json", "yaml", "yml", "toml", "ini", "conf", "env", "properties", "xml"].includes(ext)) {
    return "var(--status-warning)";
  }
  if (["log", "txt", "md", "rst"].includes(ext)) return "var(--text-secondary)";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext)) return "var(--status-info)";
  if (["zip", "gz", "tgz", "tar", "rar", "7z", "jar", "war"].includes(ext)) return "var(--status-warning)";
  return "var(--text-secondary)";
}

/**
 * 远程文件图标（目录 / 链接 / 文件）。
 *
 * <p>纯展示组件，无状态；颜色统一取自主题变量，深浅色自动适配。
 */
export default function FileIcon({ type, name, size = 15, className = "" }: Props) {
  const color = colorOf(name, type);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `shrink-0 ${className}`,
    style: { color },
    "aria-hidden": true,
  };

  if (type === "dir") {
    return (
      <svg {...common}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      </svg>
    );
  }

  if (type === "link") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
