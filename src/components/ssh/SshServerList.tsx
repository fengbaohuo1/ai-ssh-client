import { useSshState } from "../../contexts/SshContext";
import SshServerItem from "./SshServerItem";

export default function SshServerList() {
  const { servers, filterText } = useSshState();

  const filtered = servers.filter((s) => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return (
      s.name.toLowerCase().includes(lower) ||
      s.host.toLowerCase().includes(lower) ||
      s.username.toLowerCase().includes(lower)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {servers.length === 0 ? (
          <>
            <div className="text-3xl mb-3">🖥️</div>
            <p className="text-xs text-[#858585]">暂无服务器</p>
            <p className="text-xs text-[#6a6a6a] mt-1">点击上方 + 按钮添加</p>
          </>
        ) : (
          <>
            <p className="text-xs text-[#858585]">无匹配结果</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      {filtered.map((server) => (
        <SshServerItem key={server.id} server={server} />
      ))}
    </div>
  );
}
