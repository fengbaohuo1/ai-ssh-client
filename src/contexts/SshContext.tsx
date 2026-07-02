import { createContext, useContext, useReducer, useCallback, useEffect, type Dispatch, type ReactNode } from "react";
import type { SshServer } from "../types";
import { authTypeToMethod, authMethodToType } from "../types";
import { createConnection, listConnections, deleteConnection as apiDeleteConnection } from "../api/ssh";
import type { ConnectionResponse } from "../api/ssh";

// ===== State & Actions =====
interface SshState {
  servers: SshServer[];
  filterText: string;
  editingServer: SshServer | null;
  isDialogOpen: boolean;
  loading: boolean;
  error: string | null;
}

type SshAction =
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function sshReducer(state: SshState, action: SshAction): SshState {
  switch (action.type) {
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
      return {
        ...state,
        servers: [...state.servers, action.server],
        isDialogOpen: false,
      };
    case "UPDATE_SERVER":
      return {
        ...state,
        servers: state.servers.map((s) =>
          s.id === action.server.id ? action.server : s
        ),
        isDialogOpen: false,
        editingServer: null,
      };
    case "DELETE_SERVER":
      return {
        ...state,
        servers: state.servers.filter((s) => s.id !== action.id),
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
        const res = await listConnections("default");
        if (res.code === "0000" && res.data) {
          const servers: SshServer[] = res.data.map(mapResponseToServer);
          dispatch({ type: "SET_SERVERS", servers });
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: String(err) });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    })();
  }, []);

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

export function useSshActions() {
  const dispatch = useSshDispatch();

  const fetchServers = useCallback(async (userId: string = "default") => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await listConnections(userId);
      if (res.code === "0000" && res.data) {
        const servers: SshServer[] = res.data.map(mapResponseToServer);
        dispatch({ type: "SET_SERVERS", servers });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [dispatch]);

  const addServer = useCallback(async (data: {
    name: string; host: string; port: number; username: string;
    authMethod: "password" | "key"; password?: string;
  }) => {
    try {
      const res = await createConnection({
        connectionName: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: authMethodToType(data.authMethod),
        password: data.password,
        userId: "default",
      });
      if (res.code === "0000" && res.data) {
        await fetchServers();
        dispatch({ type: "CLOSE_DIALOG" });
      } else {
        dispatch({ type: "SET_ERROR", error: res.info });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    }
  }, [dispatch, fetchServers]);

  const removeServer = useCallback(async (connectionId: string) => {
    try {
      const res = await apiDeleteConnection(connectionId);
      if (res.code === "0000") {
        dispatch({ type: "DELETE_SERVER", id: connectionId });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: String(err) });
    }
  }, [dispatch]);

  return { fetchServers, addServer, removeServer };
}
