import { useState } from "react";
import { Notification } from "@/types/notification";
import { mockNotifications } from "@/data/notifications";
import { NotificationHeader } from "./NotificationHeader";
import { NotificationTabs, TabType } from "./NotificationTabs";
import { NotificationItem } from "./NotificationItem";
import { EmptyState } from "./EmptyState";
import { toast } from "sonner";

export function NotificationInbox() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = activeTab === "unread" 
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    toast.success("Notifikasi ditandai sudah dibaca");
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success("Semua notifikasi ditandai sudah dibaca");
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notifikasi dihapus");
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-card shadow-xl rounded-2xl overflow-hidden border">
      <NotificationHeader 
        unreadCount={unreadCount} 
        onMarkAllAsRead={handleMarkAllAsRead} 
      />
      
      <NotificationTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        unreadCount={unreadCount}
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-2">
          {filteredNotifications.length === 0 ? (
            <EmptyState type={activeTab} />
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3 text-center">
        <span className="text-xs text-muted-foreground">
          {unreadCount > 0 
            ? `${unreadCount} notifikasi belum dibaca`
            : "Semua notifikasi sudah dibaca"}
        </span>
      </div>
    </div>
  );
}
