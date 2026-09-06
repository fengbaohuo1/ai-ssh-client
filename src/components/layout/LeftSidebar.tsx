import { useLayoutStore } from "../../stores/layoutStore";
import SshSidebar from "../ssh/SshSidebar";
import ChatHistorySidebar from "../history/ChatHistorySidebar";
import AgentConfigSidebar from "../config/AgentConfigSidebar";

export default function LeftSidebar() {
  const view = useLayoutStore((s) => s.leftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);

  switch (view) {
    case "ssh":
      return <SshSidebar />;
    case "history":
      return <ChatHistorySidebar />;
    case "config":
      return <AgentConfigSidebar onClose={toggleLeft} />;
    default:
      return null;
  }
}
