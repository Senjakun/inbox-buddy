import { cn } from "@/lib/utils";

export type TabType = "all" | "unread";

interface NotificationTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount: number;
}

export function NotificationTabs({ activeTab, onTabChange, unreadCount }: NotificationTabsProps) {
  const tabs = [
    { id: "all" as TabType, label: "Semua" },
    { id: "unread" as TabType, label: "Belum Dibaca", count: unreadCount },
  ];

  return (
    <div className="sticky top-[73px] z-10 bg-background/95 backdrop-blur-sm px-4 pb-2 pt-2">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn(
                "flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold",
                activeTab === tab.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-badge text-badge-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
