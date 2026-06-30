import SshToolbar from "./SshToolbar";
import SshServerList from "./SshServerList";
import SshServerDialog from "./SshServerDialog";

export default function SshSidebar() {
  return (
    <div className="flex flex-col h-full bg-[#252526] border-r border-[#3c3c3c]">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#cccccc]">
          SSH 服务器
        </h2>
      </div>

      <SshToolbar />
      <div className="flex-1 overflow-y-auto">
        <SshServerList />
      </div>

      <SshServerDialog />
    </div>
  );
}
