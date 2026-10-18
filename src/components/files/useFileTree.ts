import { useCallback, useEffect, useRef, useState } from "react";
import { listFiles, type SftpFile } from "../../api/files";
import { ancestorsOf, sortFiles } from "./fileUtils";

/**
 * 远程目录树控制器：懒加载 + 缓存 + 展开状态。
 *
 * <p>只负责"数据与展开"，渲染和交互全部在 `FileTree`。这样文件管理器、
 * 左侧文件树、未来的其他入口可以共享同一套加载语义，而不重复写请求逻辑。
 */
export interface FileTreeController {
  /** path → 子节点（未加载则不存在） */
  children: Record<string, SftpFile[]>;
  /** path → 错误信息 */
  errors: Record<string, string>;
  /** path → 是否加载中 */
  loading: Record<string, boolean>;
  expanded: Set<string>;
  ensureLoaded: (path: string, force?: boolean) => Promise<void>;
  toggle: (path: string) => void;
  expandTo: (path: string) => Promise<void>;
  /** 批量展开（用于根节点默认展开） */
  expandPaths: (paths: string[]) => void;
  /** 刷新单个目录（force） */
  refreshPath: (path: string) => void;
  /** 清空缓存并重新加载所有已展开目录 */
  refreshAll: () => void;
}

export function useFileTree(connectionId: string | null): FileTreeController {
  const [children, setChildren] = useState<Record<string, SftpFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  const expandedRef = useRef<Set<string>>(new Set());
  const connectionRef = useRef(connectionId);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  // 连接切换：清空所有缓存，避免上一个主机的目录串到新主机
  useEffect(() => {
    connectionRef.current = connectionId;
    loadedRef.current = new Set();
    inflightRef.current.clear();
    setChildren({});
    setErrors({});
    setLoading({});
    setExpanded(new Set());
  }, [connectionId]);

  const ensureLoaded = useCallback(
    async (path: string, force = false): Promise<void> => {
      if (!connectionId) return;
      if (!force && loadedRef.current.has(path)) return;
      const running = inflightRef.current.get(path);
      if (running && !force) return running;

      const promise = (async () => {
        setLoading((prev) => ({ ...prev, [path]: true }));
        try {
          const res = await listFiles(connectionId, path);
          if (connectionRef.current !== connectionId) return;
          if (res.code === "0000" && res.data) {
            setChildren((prev) => ({ ...prev, [path]: sortFiles(res.data!.files) }));
            loadedRef.current.add(path);
            setErrors((prev) => {
              if (!(path in prev)) return prev;
              const next = { ...prev };
              delete next[path];
              return next;
            });
          } else {
            setErrors((prev) => ({ ...prev, [path]: res.info || "目录加载失败" }));
          }
        } catch (err) {
          if (connectionRef.current !== connectionId) return;
          setErrors((prev) => ({
            ...prev,
            [path]: err instanceof Error ? err.message : String(err),
          }));
        } finally {
          setLoading((prev) => {
            if (!prev[path]) return prev;
            const next = { ...prev };
            delete next[path];
            return next;
          });
          inflightRef.current.delete(path);
        }
      })();

      inflightRef.current.set(path, promise);
      return promise;
    },
    [connectionId]
  );

  const toggle = useCallback(
    (path: string) => {
      // 展开前先触发加载；已加载时会直接命中缓存
      void ensureLoaded(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [ensureLoaded]
  );

  const expandTo = useCallback(
    async (path: string) => {
      const chain = ancestorsOf(path);
      setExpanded((prev) => new Set([...prev, ...chain]));
      for (const item of chain) {
        await ensureLoaded(item);
      }
    },
    [ensureLoaded]
  );

  const expandPaths = useCallback(
    (paths: string[]) => {
      setExpanded((prev) => new Set([...prev, ...paths]));
      paths.forEach((path) => void ensureLoaded(path));
    },
    [ensureLoaded]
  );

  const refreshPath = useCallback(
    (path: string) => {
      loadedRef.current.delete(path);
      void ensureLoaded(path, true);
    },
    [ensureLoaded]
  );

  const refreshAll = useCallback(() => {
    const targets = new Set(expandedRef.current);
    loadedRef.current.clear();
    setChildren({});
    setErrors({});
    targets.forEach((path) => void ensureLoaded(path, true));
  }, [ensureLoaded]);

  return {
    children,
    errors,
    loading,
    expanded,
    ensureLoaded,
    toggle,
    expandTo,
    expandPaths,
    refreshPath,
    refreshAll,
  };
}
