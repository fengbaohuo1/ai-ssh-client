import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { TerminalTab } from "../types";

// ===== State & Actions =====
interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
}

type TerminalAction =
  | { type: "OPEN_TAB"; serverId?: string; serverName: string }
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
    case "OPEN_TAB": {
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
    case "CLOSE_TAB": {
      const newTabs = state.tabs.filter((t) => t.id !== action.id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.id) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
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
