import { X, Home, Circle } from "lucide-react";
import { useUiStore, useSessionStore } from "../../stores";
import { cn } from "@/lib/utils";

interface TabContainerProps {
  children: React.ReactNode;
  mainTabContent: React.ReactNode;
  renderSessionTab: (sessionId: string) => React.ReactNode;
}

export function TabContainer({
  mainTabContent,
  renderSessionTab,
}: TabContainerProps) {
  const {
    activeTabId,
    openSessionTabs,
    setActiveTab,
    closeSessionTab,
  } = useUiStore();

  const { sessions, currentSession } = useSessionStore();

  // Get session info for tab display
  const getSessionInfo = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return { title: "Session", isActive: false };

    const isActive = currentSession?.id === sessionId && session.status === "active";
    const title = session.display_name || session.target_title || "Session";

    return { session, title, isActive, status: session.status };
  };

  // Get status color for tab indicator
  const getStatusColor = (status: string, isActive: boolean) => {
    if (isActive) return "bg-green-500";
    switch (status) {
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "aborted":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const info = getSessionInfo(sessionId);

    // Prevent closing active (recording) session
    if (info.isActive) {
      return;
    }

    closeSessionTab(sessionId);
  };

  const isRecording = currentSession !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar - at the very top with macOS titlebar integration */}
      <div className="flex items-center bg-gray-900 border-b border-gray-700 overflow-x-auto titlebar-drag-region shrink-0">
        {/* Logo area (with space for macOS traffic lights) */}
        <div className="flex items-center gap-2 pl-20 pr-4 py-2 border-r border-gray-700 shrink-0 titlebar-drag-region">
          <span className="text-sm font-bold text-white" title="Android WebView Performance Analyzer">AWPA</span>
          {isRecording && (
            <div className="flex items-center gap-1 titlebar-no-drag">
              <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-xs text-red-400">REC</span>
            </div>
          )}
        </div>

        {/* Main Tab (fixed) */}
        <button
          onClick={() => setActiveTab("main")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-r border-gray-700 shrink-0 titlebar-no-drag",
            "hover:bg-gray-800 transition-colors",
            activeTabId === "main"
              ? "bg-gray-800 text-white border-b-2 border-b-blue-500"
              : "text-gray-400"
          )}
        >
          <Home className="w-4 h-4" />
          <span className="font-medium text-sm">Main</span>
        </button>

        {/* Session Tabs */}
        {openSessionTabs.map((sessionId) => {
          const { title, isActive, status } = getSessionInfo(sessionId);
          const isCurrentTab = activeTabId === sessionId;

          return (
            <button
              key={sessionId}
              onClick={() => setActiveTab(sessionId)}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 border-r border-gray-700 shrink-0 titlebar-no-drag",
                "hover:bg-gray-800 transition-colors min-w-0 max-w-[200px]",
                isCurrentTab
                  ? "bg-gray-800 text-white border-b-2 border-b-blue-500"
                  : "text-gray-400"
              )}
            >
              {/* Status indicator */}
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  getStatusColor(status || "completed", isActive),
                  isActive && "animate-pulse"
                )}
              />

              {/* Title */}
              <span className="truncate text-sm">{title}</span>

              {/* Close button (hidden for active sessions) */}
              {!isActive && (
                <button
                  onClick={(e) => handleCloseTab(e, sessionId)}
                  className={cn(
                    "p-0.5 rounded hover:bg-gray-600 shrink-0",
                    "opacity-0 group-hover:opacity-100 transition-opacity"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTabId === "main" ? (
          mainTabContent
        ) : (
          renderSessionTab(activeTabId)
        )}
      </div>
    </div>
  );
}
