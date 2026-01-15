import { Notification, NotificationType } from "@/types/notification";
import { cn } from "@/lib/utils";
import { 
  MessageCircle, 
  Bell, 
  Settings, 
  CheckCircle, 
  AlertTriangle,
  Check,
  MoreHorizontal
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  const iconClasses = "h-5 w-5";
  
  switch (type) {
    case "message":
      return <MessageCircle className={cn(iconClasses, "text-primary")} />;
    case "alert":
      return <Bell className={cn(iconClasses, "text-info")} />;
    case "system":
      return <Settings className={cn(iconClasses, "text-muted-foreground")} />;
    case "success":
      return <CheckCircle className={cn(iconClasses, "text-success")} />;
    case "warning":
      return <AlertTriangle className={cn(iconClasses, "text-warning")} />;
    default:
      return <Bell className={cn(iconClasses, "text-muted-foreground")} />;
  }
};

const getNotificationBgColor = (type: NotificationType) => {
  switch (type) {
    case "message":
      return "bg-primary/10";
    case "alert":
      return "bg-info/10";
    case "system":
      return "bg-muted";
    case "success":
      return "bg-success/10";
    case "warning":
      return "bg-warning/10";
    default:
      return "bg-muted";
  }
};

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(notification.timestamp, { 
    addSuffix: true, 
    locale: id 
  });

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 p-4 rounded-xl transition-all duration-200 cursor-pointer",
        notification.isRead 
          ? "bg-card hover:bg-notification-hover" 
          : "bg-notification-unread hover:bg-accent shadow-sm",
        "animate-slide-in"
      )}
      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
      )}

      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        getNotificationBgColor(notification.type)
      )}>
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "text-sm truncate",
              notification.isRead ? "font-medium" : "font-semibold"
            )}>
              {notification.title}
            </h4>
            {notification.sender && (
              <span className="text-xs text-muted-foreground">
                dari {notification.sender}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {timeAgo}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!notification.isRead && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}>
                <Check className="h-4 w-4 mr-2" />
                Tandai sudah dibaca
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              Hapus notifikasi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
