import { useTerminalState, useTerminalDispatch } from "../../contexts/TerminalContext";

export default function TerminalTabs() {
  const { tabs, activeTabId } = useTerminalState();
  const dispatch = useTerminalDispatch();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-end bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
      <div className="flex h-9">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => dispatch({ type: "SET_ACTIVE_TAB", id: tab.id })}
              className={`group flex items-center gap-2 px-4 h-9 text-xs cursor-pointer select-none
                border-r border-[#2d2d2d] transition-colors
                ${isActive
                  ? "bg-[#1e1e1e] text-[#cccccc] border-t border-t-[#0078d4]"
                  : "bg-[#2d2d2d] text-[#858585] hover:bg-[#37373d]"
                }`}
            >
              {/* 状态指示灯 */}
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  tab.status === "connected" ? "bg-green-400"
                  : tab.status === "connecting" ? "bg-yellow-400 animate-pulse"
                  : tab.status === "error" ? "bg-red-400"
                  : "bg-[#858585]"
                }`}
              />

              <span className="truncate max-w-[120px]">{tab.serverName}</span>

              {/* 关闭按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "CLOSE_TAB", id: tab.id });
                }}
                className="ml-1 w-4 h-4 flex items-center justify-center rounded
                           text-[#858585] hover:text-[#cccccc] hover:bg-[#5a1d1d]
                           opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                title="关闭"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* 新标签按钮 */}
      <button
        onClick={() =>
          dispatch({ type: "OPEN_TAB", serverName: `终端 ${tabs.length + 1}` })
        }
        className="flex items-center justify-center w-8 h-9 text-sm text-[#858585]
                   hover:text-[#cccccc] hover:bg-[#37373d] transition-colors flex-shrink-0"
        title="新建终端"
      >
        +
      </button>
    </div>
  );
}
