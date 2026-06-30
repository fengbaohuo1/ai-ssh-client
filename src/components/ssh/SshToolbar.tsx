import { useSshState, useSshDispatch } from "../../contexts/SshContext";

export default function SshToolbar() {
  const { filterText } = useSshState();
  const dispatch = useSshDispatch();

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c]">
      {/* 搜索框 */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={filterText}
          onChange={(e) => dispatch({ type: "SET_FILTER", text: e.target.value })}
          placeholder="搜索服务器..."
          className="w-full bg-[#3c3c3c] text-[#cccccc] text-xs rounded px-2 py-1.5 outline-none
                     border border-transparent focus:border-[#0078d4] placeholder:text-[#858585]"
        />
        {filterText && (
          <button
            onClick={() => dispatch({ type: "SET_FILTER", text: "" })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#858585] hover:text-[#cccccc] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* 添加按钮 */}
      <button
        onClick={() => dispatch({ type: "OPEN_ADD_DIALOG" })}
        className="flex items-center justify-center w-7 h-7 rounded text-[#cccccc]
                   hover:bg-[#37373d] text-sm leading-none transition-colors"
        title="添加服务器"
      >
        +
      </button>
    </div>
  );
}
