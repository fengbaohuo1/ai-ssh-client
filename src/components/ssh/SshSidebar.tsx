import SshToolbar from "./SshToolbar";
import SshServerList from "./SshServerList";
import SshServerDialog from "./SshServerDialog";

export default function SshSidebar() {
  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel)] border-r border-[var(--border-default)]">
      {/* Title bar */}
      <div className="flex items-center px-4 h-[38px] border-b border-[var(--border-default)] shrink-0">
        <h2 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em]">
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
