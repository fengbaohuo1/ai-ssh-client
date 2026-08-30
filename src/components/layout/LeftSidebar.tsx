import { useLayoutStore } from "../../stores/layoutStore";
import SshSidebar from "../ssh/SshSidebar";
import ChatHistorySidebar from "../history/ChatHistorySidebar";
import PlaceholderView from "./PlaceholderView";

export default function LeftSidebar() {
  const view = useLayoutStore((s) => s.leftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);

  switch (view) {
    case "ssh":
      return <SshSidebar />;
    case "history":
      return <ChatHistorySidebar />;
    case "files":
      return <PlaceholderView title="文件浏览" icon="📁" description="文件目录浏览功能即将推出" onClose={toggleLeft} />;
    case "sftp":
      return <PlaceholderView title="SFTP 传输" icon="📤" description="SFTP 文件传输功能即将推出" onClose={toggleLeft} />;
    case "mcp":
      return <PlaceholderView title="MCP 服务器" icon="🔧" description="MCP 服务器连接管理即将推出" onClose={toggleLeft} />;
    case "skills":
      return <PlaceholderView title="技能管理" icon="⚡" description="技能管理与配置即将推出" onClose={toggleLeft} />;
    case "plugins":
      return <PlaceholderView title="插件管理" icon="🧩" description="插件市场与管理即将推出" onClose={toggleLeft} />;
    default:
      return null;
  }
}
