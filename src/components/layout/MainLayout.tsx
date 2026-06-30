import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { SshProvider } from "../../contexts/SshContext";
import { TerminalProvider } from "../../contexts/TerminalContext";
import { ChatProvider } from "../../contexts/ChatContext";
import SshSidebar from "../ssh/SshSidebar";
import TerminalPanel from "../terminal/TerminalPanel";
import AiChatPanel from "../chat/AiChatPanel";

export default function MainLayout() {
  return (
    <SshProvider>
      <TerminalProvider>
        <ChatProvider>
          <div className="h-screen w-screen bg-[#1e1e1e]">
            <Allotment proportionalLayout={false}>
              <Allotment.Pane minSize={200} preferredSize={280}>
                <SshSidebar />
              </Allotment.Pane>
              <Allotment.Pane minSize={300}>
                <TerminalPanel />
              </Allotment.Pane>
              <Allotment.Pane minSize={280} preferredSize={380}>
                <AiChatPanel />
              </Allotment.Pane>
            </Allotment>
          </div>
        </ChatProvider>
      </TerminalProvider>
    </SshProvider>
  );
}
