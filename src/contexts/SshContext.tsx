import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { SshServer } from "../types";
import { mockServers } from "../data/mockServers";

// ===== State & Actions =====
interface SshState {
  servers: SshServer[];
  filterText: string;
  editingServer: SshServer | null; // 非空表示弹窗打开（编辑模式）
  isDialogOpen: boolean;
}

type SshAction =
  | { type: "SET_FILTER"; text: string }
  | { type: "OPEN_ADD_DIALOG" }
  | { type: "OPEN_EDIT_DIALOG"; server: SshServer }
  | { type: "CLOSE_DIALOG" }
  | { type: "ADD_SERVER"; server: SshServer }
  | { type: "UPDATE_SERVER"; server: SshServer }
  | { type: "DELETE_SERVER"; id: string };

const initialState: SshState = {
  servers: mockServers,
  filterText: "",
  editingServer: null,
  isDialogOpen: false,
};

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
    default:
      return state;
  }
}

// ===== Context =====
const SshStateContext = createContext<SshState>(initialState);
const SshDispatchContext = createContext<Dispatch<SshAction>>(() => {});

export function SshProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sshReducer, initialState);
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
