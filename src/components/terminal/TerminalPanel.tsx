import { useTerminalState } from "../../contexts/TerminalContext";
import TerminalTabs from "./TerminalTabs";
import TerminalView from "./TerminalView";

export default function TerminalPanel() {
  const { tabs, activeTabId } = useTerminalState();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <TerminalTabs />

      <div className="flex-1 relative">
        {!activeTab ? (
          /* 空状态 */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#858585]">
            <div className="text-4xl mb-4 opacity-50">&gt;_</div>
            <p className="text-sm">从左侧双击服务器以连接</p>
            <p className="text-xs mt-1 text-[#6a6a6a]">
              或点击上方标签栏 + 按钮打开新终端
            </p>
          </div>
        ) : (
          <TerminalView key={activeTab.id} tab={activeTab} />
        )}
      </div>
    </div>
  );
}
