import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui";
import { SessionDetail } from "./SessionDetail";
import { useUiStore, useSessionStore } from "../stores";
import type { Session } from "../bindings";

interface SessionTabsProps {
  onDeleteSession: (sessionId: string) => void;
}

export function SessionTabs({ onDeleteSession }: SessionTabsProps) {
  const { sessions } = useSessionStore();
  const {
    openSessionTabs,
    activeSessionTab,
    closeSessionTab,
    setActiveSessionTab,
    setExportSession,
  } = useUiStore();

  // Get session data for each open tab
  const openSessions = openSessionTabs
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is Session => s !== undefined);

  if (openSessionTabs.length === 0) {
    return null;
  }

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeSessionTab(sessionId);
  };

  const handleExport = (session: Session) => {
    setExportSession(session);
  };

  const handleDelete = (sessionId: string) => {
    closeSessionTab(sessionId);
    onDeleteSession(sessionId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col">
      <Tabs
        value={activeSessionTab ?? undefined}
        onValueChange={setActiveSessionTab}
        className="flex-1 flex flex-col"
      >
        <div className="border-b border-gray-700 px-4 py-2 flex items-center gap-2 bg-gray-900">
          <TabsList className="flex-1 overflow-x-auto">
            {openSessions.map((session) => (
              <TabsTrigger
                key={session.id}
                value={session.id}
                className="group flex items-center gap-2 pr-1"
              >
                <span className="truncate max-w-[150px]">
                  {session.target_title || "Untitled"}
                </span>
                <button
                  onClick={(e) => handleCloseTab(e, session.id)}
                  className="p-0.5 rounded hover:bg-gray-600 opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            onClick={() => {
              // Close all tabs
              openSessionTabs.forEach((id) => closeSessionTab(id));
            }}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            Close All
          </button>
        </div>

        {openSessions.map((session) => (
          <TabsContent
            key={session.id}
            value={session.id}
            className="flex-1 overflow-auto p-0"
          >
            <SessionDetail
              session={session}
              onClose={() => closeSessionTab(session.id)}
              onDelete={handleDelete}
              onExport={handleExport}
              isInTab={true}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
