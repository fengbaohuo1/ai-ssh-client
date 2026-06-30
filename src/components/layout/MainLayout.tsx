import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { LayoutPriority } from "allotment";
import { SshProvider } from "../../contexts/SshContext";
import { TerminalProvider } from "../../contexts/TerminalContext";
import { ChatProvider } from "../../contexts/ChatContext";
import { useLayoutStore } from "../../stores/layoutStore";
import Header from "./Header";
import ActivityBar from "./ActivityBar";
import LeftSidebar from "./LeftSidebar";
import TerminalPanel from "../terminal/TerminalPanel";
import AiChatPanel from "../chat/AiChatPanel";

export default function MainLayout() {
  const leftVisible = useLayoutStore((s) => s.leftSidebarVisible);
  const rightVisible = useLayoutStore((s) => s.rightSidebarVisible);

  return (
    <SshProvider>
      <TerminalProvider>
        <ChatProvider>
          <div className="h-screen w-screen flex flex-col bg-[var(--surface-app)] text-[var(--text-primary)]">
            <Header />
            <div className="flex flex-row flex-1 overflow-hidden">
              <ActivityBar />
              <Allotment proportionalLayout={false}>
                <Allotment.Pane minSize={200} preferredSize={280} visible={leftVisible}>
                  <LeftSidebar />
                </Allotment.Pane>
                <Allotment.Pane minSize={300} priority={LayoutPriority.High}>
                  <TerminalPanel />
                </Allotment.Pane>
                <Allotment.Pane minSize={280} preferredSize={380} visible={rightVisible}>
                  <AiChatPanel />
                </Allotment.Pane>
              </Allotment>
            </div>
          </div>
        </ChatProvider>
      </TerminalProvider>
    </SshProvider>
  );
}
