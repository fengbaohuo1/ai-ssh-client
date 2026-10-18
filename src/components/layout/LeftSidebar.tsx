import { useLayoutStore } from "../../stores/layoutStore";
import SshSidebar from "../ssh/SshSidebar";
import ChatHistorySidebar from "../history/ChatHistorySidebar";
import AgentConfigSidebar from "../config/AgentConfigSidebar";
import AuditLogSidebar from "../audit/AuditLogSidebar";
import OverviewSidebar from "../overview/OverviewSidebar";
import FileTreeSidebar from "../files/FileTreeSidebar";

export default function LeftSidebar() {
  const view = useLayoutStore((s) => s.leftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);

  switch (view) {
    case "overview":
      return <OverviewSidebar />;
    case "ssh":
      return <SshSidebar />;
    case "files":
      return <FileTreeSidebar />;
    case "history":
      return <ChatHistorySidebar />;
    case "audit":
      return <AuditLogSidebar />;
    case "config":
      return <AgentConfigSidebar onClose={toggleLeft} />;
    default:
      return null;
  }
}
