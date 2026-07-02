import { createContext, useContext, useReducer, useMemo, type Dispatch, type ReactNode } from "react";
import type { TerminalTab } from "../types";

// ===== State & Actions =====
interface TerminalState {
  serverTabs: Record<string, TerminalTab[]>;  // serverId → tab array
  activeServerId: string | null;
  activeTabId: string | null;
  localTabs: TerminalTab[];
  activeLocalTabId: string | null;
}

type TerminalAction =
  | { type: "SET_ACTIVE_SERVER"; serverId: string }
  | { type: "OPEN_SERVER_TAB"; serverId: string; serverName: string }
  | { type: "CLOSE_SERVER_TAB"; serverId: string; tabId: string }
  | { type: "SET_ACTIVE_TAB"; id: string }
  | { type: "OPEN_LOCAL_TAB"; serverName: string }
  | { type: "CLOSE_LOCAL_TAB"; tabId: string }
  | { type: "UPDATE_TAB_STATUS"; id: string; status: TerminalTab["status"]; errorMessage?: string }
  | { type: "RESET_SERVER_TABS"; serverId: string }
  // Legacy backward compat
  | { type: "OPEN_TAB"; serverId?: string; serverName: string }
  | { type: "CLOSE_TAB"; id: string };

const initialState: TerminalState = {
  serverTabs: {},
  activeServerId: null,
  activeTabId: null,
  localTabs: [],
  activeLocalTabId: null,
};

let nextTabId = 1;

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case "SET_ACTIVE_SERVER": {
      const tabs = state.serverTabs[action.serverId];
      return {
        ...state,
        activeServerId: action.serverId,
        activeTabId: tabs && tabs.length > 0 ? tabs[0].id : null,
      };
    }

    case "OPEN_SERVER_TAB": {
      const newTab: TerminalTab = {
        id: `term-${nextTabId++}`,
        serverId: action.serverId,
        serverName: action.serverName,
        status: "disconnected",
      };
      const existing = state.serverTabs[action.serverId] || [];
      return {
        ...state,
        serverTabs: {
          ...state.serverTabs,
          [action.serverId]: [...existing, newTab],
        },
        activeTabId: newTab.id,
      };
    }

    case "CLOSE_SERVER_TAB": {
      const tabs = state.serverTabs[action.serverId] || [];
      const filtered = tabs.filter((t) => t.id !== action.tabId);
      const newServerTabs = { ...state.serverTabs };
      if (filtered.length === 0) {
        delete newServerTabs[action.serverId];
      } else {
        newServerTabs[action.serverId] = filtered;
      }
      const closedIndex = tabs.findIndex((t) => t.id === action.tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        if (filtered.length > 0) {
          // Try the tab just before the closed one, or the first remaining
          newActiveId = closedIndex > 0 ? tabs[closedIndex - 1].id : filtered[0].id;
        } else {
          newActiveId = null;
        }
      }
      return {
        ...state,
        serverTabs: newServerTabs,
        activeTabId: newActiveId,
        activeServerId:
          filtered.length === 0 && state.activeServerId === action.serverId
            ? null
            : state.activeServerId,
      };
    }

    case "SET_ACTIVE_TAB": {
      let newActiveServerId: string | null = state.activeServerId;
      let newActiveLocalTabId: string | null = state.activeLocalTabId;
      // Search server tabs
      let found = false;
      for (const [sid, tabs] of Object.entries(state.serverTabs)) {
        if (tabs.some((t) => t.id === action.id)) {
          newActiveServerId = sid;
          newActiveLocalTabId = null;
          found = true;
          break;
        }
      }
      if (!found) {
        // Search local tabs
        if (state.localTabs.some((t) => t.id === action.id)) {
          newActiveServerId = null;
          newActiveLocalTabId = action.id;
        }
      }
      return {
        ...state,
        activeTabId: action.id,
        activeServerId: newActiveServerId,
        activeLocalTabId: newActiveLocalTabId,
      };
    }

    case "OPEN_LOCAL_TAB": {
      const newTab: TerminalTab = {
        id: `term-${nextTabId++}`,
        serverName: action.serverName,
        status: "disconnected",
      };
      return {
        ...state,
        localTabs: [...state.localTabs, newTab],
        activeLocalTabId: newTab.id,
        activeTabId: newTab.id,
        activeServerId: null,
      };
    }

    case "CLOSE_LOCAL_TAB": {
      const newLocalTabs = state.localTabs.filter((t) => t.id !== action.tabId);
      const newActiveLocalId =
        state.activeLocalTabId === action.tabId
          ? newLocalTabs.length > 0
            ? newLocalTabs[newLocalTabs.length - 1].id
            : null
          : state.activeLocalTabId;
      const newActiveId =
        state.activeTabId === action.tabId ? newActiveLocalId : state.activeTabId;
      return {
        ...state,
        localTabs: newLocalTabs,
        activeLocalTabId: newActiveLocalId,
        activeTabId: newActiveId,
        activeServerId: newLocalTabs.length === 0 ? null : state.activeServerId,
      };
    }

    case "UPDATE_TAB_STATUS": {
      const updatedServerTabs = Object.fromEntries(
        Object.entries(state.serverTabs).map(([sid, tabs]) => [
          sid,
          tabs.map((t) =>
            t.id === action.id
              ? { ...t, status: action.status, errorMessage: action.errorMessage }
              : t,
          ),
        ]),
      );
      return {
        ...state,
        serverTabs: updatedServerTabs,
        localTabs: state.localTabs.map((t) =>
          t.id === action.id
            ? { ...t, status: action.status, errorMessage: action.errorMessage }
            : t,
        ),
      };
    }

    case "RESET_SERVER_TABS": {
      const newServerTabs = { ...state.serverTabs };
      delete newServerTabs[action.serverId];
      const newActiveId =
        state.activeServerId === action.serverId ? null : state.activeTabId;
      return {
        ...state,
        serverTabs: newServerTabs,
        activeServerId:
          state.activeServerId === action.serverId ? null : state.activeServerId,
        activeTabId: newActiveId,
      };
    }

    // Legacy backward compat
    case "OPEN_TAB": {
      if (action.serverId) {
        return terminalReducer(state, {
          type: "OPEN_SERVER_TAB",
          serverId: action.serverId,
          serverName: action.serverName,
        });
      }
      return terminalReducer(state, {
        type: "OPEN_LOCAL_TAB",
        serverName: action.serverName,
      });
    }

    case "CLOSE_TAB": {
      for (const [sid, tabs] of Object.entries(state.serverTabs)) {
        if (tabs.some((t) => t.id === action.id)) {
          return terminalReducer(state, {
            type: "CLOSE_SERVER_TAB",
            serverId: sid,
            tabId: action.id,
          });
        }
      }
      if (state.localTabs.some((t) => t.id === action.id)) {
        return terminalReducer(state, {
          type: "CLOSE_LOCAL_TAB",
          tabId: action.id,
        });
      }
      return state;
    }

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
  const state = useContext(TerminalStateContext);
  const tabs = useMemo(
    () => [...Object.values(state.serverTabs).flat(), ...state.localTabs],
    [state.serverTabs, state.localTabs],
  );
  return { ...state, tabs };
}

export function useTerminalDispatch() {
  return useContext(TerminalDispatchContext);
}
