import { useLayoutStore } from "../../stores/layoutStore";
import SshSidebar from "../ssh/SshSidebar";
import PlaceholderView from "./PlaceholderView";

export default function LeftSidebar() {
  const view = useLayoutStore((s) => s.leftSidebarView);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);

  switch (view) {
    case "ssh":
      return <SshSidebar />;
    case "files":
      return <PlaceholderView title="文件浏览" icon="📁" description="文件目录浏览功能即将推出" onClose={toggleLeft} />;
    case "sftp":
      return <PlaceholderView title="SFTP 传输" icon="📤" description="SFTP 文件传输功能即将推出" onClose={toggleLeft} />;
    default:
      return null;
  }
}
