import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { LayoutPriority } from "allotment";
import { SshProvider } from "../../contexts/SshContext";
import { TerminalProvider } from "../../contexts/TerminalContext";
import { ChatProvider } from "../../contexts/ChatContext";
import { useLayoutStore } from "../../stores/layoutStore";
import SettingsDialog from "../settings/SettingsDialog";
import Header from "./Header";
import ActivityBar from "./ActivityBar";
import LeftSidebar from "./LeftSidebar";
import TerminalPanel from "../terminal/TerminalPanel";
import AiChatPanel from "../chat/AiChatPanel";
import StatusBar from "./StatusBar";
import CommandPalette from "./CommandPalette";
import FileExplorer from "../files/FileExplorer";
import ToastHost from "../ui/ToastHost";

export default function MainLayout() {
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);
  const rightVisible = useLayoutStore((s) => s.rightSidebarVisible);
  const settingsOpen = useLayoutStore((s) => s.settingsOpen);
  const settingsTab = useLayoutStore((s) => s.settingsTab);
  const openSettings = useLayoutStore((s) => s.openSettings);
  const closeSettings = useLayoutStore((s) => s.closeSettings);

  return (
    <SshProvider>
      <TerminalProvider>
        <ChatProvider>
          <div className="h-screen w-screen flex flex-col bg-[var(--surface-app)] text-[var(--text-primary)]">
            <Header />
            <div className="flex flex-row flex-1 overflow-hidden">
              <ActivityBar onOpenSettings={() => openSettings("appearance")} />
              <Allotment proportionalLayout={false}>
                <Allotment.Pane preferredSize={280} visible={leftVisible}>
                  <LeftSidebar />
                </Allotment.Pane>
                <Allotment.Pane priority={LayoutPriority.High}>
                  <TerminalPanel />
                </Allotment.Pane>
                <Allotment.Pane minSize={320} visible={rightVisible}>
                  <AiChatPanel />
                </Allotment.Pane>
              </Allotment>
            </div>
            <StatusBar />
          </div>
          <SettingsDialog
            open={settingsOpen}
            initialTab={settingsTab}
            onClose={closeSettings}
          />
          <CommandPalette />
          <FileExplorer />
          <ToastHost />
        </ChatProvider>
      </TerminalProvider>
    </SshProvider>
  );
}
