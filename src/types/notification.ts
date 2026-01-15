export type NotificationType = "message" | "alert" | "system" | "success" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  sender?: string;
  avatar?: string;
  timestamp: Date;
  isRead: boolean;
}
