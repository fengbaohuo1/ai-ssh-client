import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { TerminalTab } from "../types";

// ===== State & Actions =====
interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
}

type TerminalAction =
  | { type: "OPEN_SERVER_TAB"; serverId: string; serverName: string }
  | { type: "OPEN_LOCAL_TAB"; serverName: string }
  | { type: "CLOSE_TAB"; id: string }
  | { type: "SET_ACTIVE_TAB"; id: string }
  | { type: "UPDATE_TAB_STATUS"; id: string; status: TerminalTab["status"]; errorMessage?: string };

const initialState: TerminalState = {
  tabs: [],
  activeTabId: null,
};

let nextTabId = 1;

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {

    case "OPEN_SERVER_TAB": {
      // 一个连接只有一个标签，已有则直接切换
      const existing = state.tabs.find((t) => t.serverId === action.serverId);
      if (existing) {
        return { ...state, activeTabId: existing.id };
      }
      const newTab: TerminalTab = {
        id: `term-${nextTabId++}`,
        serverId: action.serverId,
        serverName: action.serverName,
        status: "disconnected",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }

    case "OPEN_LOCAL_TAB": {
      const newTab: TerminalTab = {
        id: `term-${nextTabId++}`,
        serverName: action.serverName,
        status: "disconnected",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }

    case "CLOSE_TAB": {
      const newTabs = state.tabs.filter((t) => t.id !== action.id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.id) {
        const closedIdx = state.tabs.findIndex((t) => t.id === action.id);
        if (newTabs.length > 0) {
          // 关闭的是活跃标签 → 选前一个或后一个
          const idx = Math.min(closedIdx, newTabs.length - 1);
          newActiveId = newTabs[idx > 0 ? idx - 1 : 0].id;
        } else {
          newActiveId = null;
        }
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    }

    case "SET_ACTIVE_TAB":
      return { ...state, activeTabId: action.id };

    case "UPDATE_TAB_STATUS":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id
            ? { ...t, status: action.status, errorMessage: action.errorMessage }
            : t
        ),
      };

    default:
      return state;
  }
}

// ===== Context =====
const TerminalStateContext = createContext<TerminalState>(initialState);
const TerminalDispatchContext = createContext<Dispatch<TerminalAction>>(() => {});

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialState);
  return (
    <TerminalStateContext.Provider value={state}>
      <TerminalDispatchContext.Provider value={dispatch}>
        {children}
      </TerminalDispatchContext.Provider>
    </TerminalStateContext.Provider>
  );
}

export function useTerminalState() {
  return useContext(TerminalStateContext);
}

export function useTerminalDispatch() {
  return useContext(TerminalDispatchContext);
}
