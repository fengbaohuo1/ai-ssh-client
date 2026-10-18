import { createContext, useContext, useReducer, useCallback, useEffect, type Dispatch, type ReactNode } from "react";
import type { SshServer } from "../types";
import { authTypeToMethod, authMethodToType } from "../types";
import {
  createConnection,
  updateConnection,
  listConnections,
  deleteConnection as apiDeleteConnection,
  connect as apiConnect,
  disconnect as apiDisconnect,
  type ConnectionResponse,
  type UpdateConnectionRequest,
} from "../api/ssh";
import { readAuth } from "../api/client";
import { toast } from "../stores/toastStore";

// ===== 当前绑定服务器持久化 =====
// 为什么需要：AI 对话的"绑定哪台服务器"只存在内存里，Tauri 窗口重载/应用重开后 activeConnectionId
// 归空，整轮对话都会被后端判为"未绑定服务器"，模型只能在未绑定状态下空转。
// 这里把用户显式选择的服务器记到 localStorage，启动时恢复（服务器还在就自动重连）。
const ACTIVE_CONNECTION_STORAGE_KEY = "ai-ssh.active-connection-id";

function readPersistedActiveConnection(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function persistActiveConnection(connectionId: string | null) {
  try {
    if (connectionId) {
      localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, connectionId);
    } else {
      localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY);
    }
  } catch {
    // localStorage 不可用时不影响主流程
  }
}

// ===== State & Actions =====
interface SshState {
  servers: SshServer[];
  activeConnectionId: string | null;  // ← 当前 AI 绑定的服务器
  filterText: string;
  editingServer: SshServer | null;
  isDialogOpen: boolean;
  loading: boolean;
  error: string | null;
}

type SshAction =
  | { type: "SET_ACTIVE_CONNECTION"; connectionId: string | null }
  | { type: "SET_FILTER"; text: string }
  | { type: "OPEN_ADD_DIALOG" }
  | { type: "OPEN_EDIT_DIALOG"; server: SshServer }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_SERVERS"; servers: SshServer[] }
  | { type: "ADD_SERVER"; server: SshServer }
  | { type: "UPDATE_SERVER"; server: SshServer }
  | { type: "DELETE_SERVER"; id: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_SERVER_STATUS"; id: string; status: number };

const initialState: SshState = {
  servers: [],
  activeConnectionId: readPersistedActiveConnection(),
  filterText: "",
  editingServer: null,
  isDialogOpen: false,
  loading: false,
  error: null,
};

function mapResponseToServer(item: ConnectionResponse): SshServer {
  return {
    id: item.connectionId,
    name: item.connectionName,
    host: item.host,
    port: item.port,
    username: item.username,
    authMethod: authTypeToMethod(item.authType),
    status: item.status,
    userId: item.userId,
    groupName: item.groupName,
    tags: item.tags ?? [],
    remark: item.remark,
    favorite: Boolean(item.favorite),
    lastConnectedAt: item.lastConnectedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function sshReducer(state: SshState, action: SshAction): SshState {
  switch (action.type) {
    case "SET_ACTIVE_CONNECTION":
      return { ...state, activeConnectionId: action.connectionId };
    case "SET_FILTER":
      return { ...state, filterText: action.text };
    case "OPEN_ADD_DIALOG":
      return { ...state, isDialogOpen: true, editingServer: null };
    case "OPEN_EDIT_DIALOG":
      return { ...state, isDialogOpen: true, editingServer: action.server };
    case "CLOSE_DIALOG":
      return { ...state, isDialogOpen: false, editingServer: null };
    case "SET_SERVERS":
      return { ...state, servers: action.servers };
    case "ADD_SERVER":
      return { ...state, servers: [action.server, ...state.servers], isDialogOpen: false };
    case "UPDATE_SERVER":
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === action.server.id ? action.server : s)),
        isDialogOpen: false,
        editingServer: null,
      };
    case "DELETE_SERVER":
      return {
        ...state,
        servers: state.servers.filter((s) => s.id !== action.id),
        activeConnectionId: state.activeConnectionId === action.id ? null : state.activeConnectionId,
      };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SERVER_STATUS":
      return {
        ...state,
        servers: state.servers.map((s) =>
          s.id === action.id ? { ...s, status: action.status } : s
        ),
      };
    default:
      return state;
  }
}

// ===== Context =====
const SshStateContext = createContext<SshState>(initialState);
const SshDispatchContext = createContext<Dispatch<SshAction>>(() => {});

export function SshProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sshReducer, initialState);

  // 挂载时从后端拉取连接列表
  useEffect(() => {
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const res = await listConnections(readAuth().userId);
        if (res.code === "0000" && res.data) {
          const servers = res.data.map(mapResponseToServer);
          dispatch({ type: "SET_SERVERS", servers });
          dispatch({ type: "SET_ERROR", error: null });

          // 恢复上次绑定的服务器：还在列表里就保持选中；已断开则尝试自动重连，
          // 这样重开窗口后 AI 对话不会因为"未绑定服务器"而空转。
          const persisted = readPersistedActiveConnection();
          if (persisted) {
            const target = servers.find((s) => s.id === persisted);
            if (!target) {
              dispatch({ type: "SET_ACTIVE_CONNECTION", connectionId: null });
              persistActiveConnection(null);
            } else {
              // 无条件重连一次：后端重启后 DB 里的 status 可能还是"已连接"，但 SSH 会话已经没了，
              // 只回填 activeConnectionId 会让 AI 拿到一个没有底层会话的 connectionId。
              try {
                const reconnect = await apiConnect(persisted);
                if (reconnect.code === "0000") {
                  dispatch({ type: "SET_SERVER_STATUS", id: persisted, status: 1 });
                  if (target.status !== 1) {
                    toast.info("已恢复上次的服务器连接", `${target.username}@${target.host}`);
                  }
                } else {
                  dispatch({ type: "SET_SERVER_STATUS", id: persisted, status: 3 });
                  toast.warning("上次的服务器未连接", "请重新连接服务器，再让 AI 执行命令");
                }
              } catch {
                dispatch({ type: "SET_SERVER_STATUS", id: persisted, status: 3 });
                toast.warning("上次的服务器未连接", "请重新连接服务器，再让 AI 执行命令");
              }
            }
          }
        } else {
          const message = res.info || "获取服务器列表失败";
          dispatch({ type: "SET_ERROR", error: message });
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : String(err) });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    })();
  }, []);

  // activeConnectionId 变化时持久化（用户切换/断开/删除服务器都会走到这里）
  useEffect(() => {
    persistActiveConnection(state.activeConnectionId);
  }, [state.activeConnectionId]);

  return (
    <SshStateContext.Provider value={state}>
      <SshDispatchContext.Provider value={dispatch}>
        {children}
      </SshDispatchContext.Provider>
    </SshStateContext.Provider>
  );
}

export function useSshState() {
  return useContext(SshStateContext);
}

export function useSshDispatch() {
  return useContext(SshDispatchContext);
}

export interface ServerFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
  groupName?: string;
  tags?: string[];
  remark?: string;
  favorite?: boolean;
  connectTimeout?: number;
  keepaliveInterval?: number;
  startupCommand?: string;
  compression?: number;
  strictHostKeyCheck?: number;
  knownHosts?: string;
}

export function useSshActions() {
  const dispatch = useSshDispatch();

  const fetchServers = useCallback(async (userId: string = readAuth().userId) => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await listConnections(userId);
      if (res.code === "0000" && res.data) {
        dispatch({ type: "SET_SERVERS", servers: res.data.map(mapResponseToServer) });
        dispatch({ type: "SET_ERROR", error: null });
      } else {
        const message = res.info || "获取服务器列表失败";
        dispatch({ type: "SET_ERROR", error: message });
        toast.error("加载服务器失败", message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "SET_ERROR", error: message });
      toast.error("加载服务器失败", message);
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [dispatch]);

  const addServer = useCallback(async (data: ServerFormData) => {
    try {
      const res = await createConnection({
        connectionName: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: authMethodToType(data.authMethod),
        password: data.authMethod === "password" ? data.password : undefined,
        privateKey: data.authMethod === "key" ? data.privateKey : undefined,
        groupName: data.groupName,
        tags: data.tags,
        remark: data.remark,
        favorite: data.favorite,
        connectTimeout: data.connectTimeout,
        keepaliveInterval: data.keepaliveInterval,
        startupCommand: data.startupCommand,
        compression: data.compression,
        strictHostKeyCheck: data.strictHostKeyCheck,
        knownHosts: data.knownHosts,
        userId: readAuth().userId,
      });
      if (res.code === "0000" && res.data) {
        dispatch({ type: "ADD_SERVER", server: mapResponseToServer(res.data) });
        toast.success("服务器已添加", `${data.username}@${data.host}`);
      } else {
        toast.error("添加服务器失败", res.info);
      }
    } catch (err) {
      toast.error("添加服务器失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const updateServer = useCallback(async (connectionId: string, data: ServerFormData) => {
    try {
      const patch: UpdateConnectionRequest = {
        connectionName: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: authMethodToType(data.authMethod),
        groupName: data.groupName,
        tags: data.tags,
        remark: data.remark,
        favorite: data.favorite,
        connectTimeout: data.connectTimeout,
        keepaliveInterval: data.keepaliveInterval,
        startupCommand: data.startupCommand,
        compression: data.compression,
        strictHostKeyCheck: data.strictHostKeyCheck,
        knownHosts: data.knownHosts,
      };
      // 凭证留空 = 保持原值
      if (data.authMethod === "password" && data.password) patch.password = data.password;
      if (data.authMethod === "key" && data.privateKey) patch.privateKey = data.privateKey;

      const res = await updateConnection(connectionId, patch);
      if (res.code === "0000" && res.data) {
        dispatch({ type: "UPDATE_SERVER", server: mapResponseToServer(res.data) });
        toast.success("服务器配置已更新", data.name);
      } else {
        toast.error("更新失败", res.info);
      }
    } catch (err) {
      toast.error("更新失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const toggleFavorite = useCallback(async (server: SshServer) => {
    const next = !server.favorite;
    try {
      const res = await updateConnection(server.id, { favorite: next });
      if (res.code === "0000" && res.data) {
        dispatch({ type: "UPDATE_SERVER", server: mapResponseToServer(res.data) });
      } else {
        toast.error("收藏失败", res.info);
      }
    } catch (err) {
      toast.error("收藏失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const removeServer = useCallback(async (connectionId: string) => {
    try {
      const res = await apiDeleteConnection(connectionId);
      if (res.code === "0000") {
        dispatch({ type: "DELETE_SERVER", id: connectionId });
        toast.success("服务器已删除");
      } else {
        toast.error("删除失败", res.info);
      }
    } catch (err) {
      toast.error("删除失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const connectServer = useCallback(async (connectionId: string) => {
    dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 2 }); // connecting
    try {
      const res = await apiConnect(connectionId);
      if (res.code === "0000") {
        dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 1 }); // connected
      } else {
        dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 3 }); // failed
        toast.error("连接失败", res.info || "请检查主机、端口与认证信息");
      }
      return res;
    } catch (err) {
      dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 3 }); // failed
      toast.error("连接失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const disconnectServer = useCallback(async (connectionId: string) => {
    try {
      const res = await apiDisconnect(connectionId);
      if (res.code === "0000") {
        dispatch({ type: "SET_SERVER_STATUS", id: connectionId, status: 0 }); // disconnected
      } else {
        toast.error("断开失败", res.info);
      }
    } catch (err) {
      toast.error("断开失败", err instanceof Error ? err.message : String(err));
    }
  }, [dispatch]);

  const setActiveConnection = useCallback((connectionId: string | null) => {
    dispatch({ type: "SET_ACTIVE_CONNECTION", connectionId });
  }, [dispatch]);

  return {
    fetchServers,
    addServer,
    updateServer,
    toggleFavorite,
    removeServer,
    connectServer,
    disconnectServer,
    setActiveConnection,
  };
}
