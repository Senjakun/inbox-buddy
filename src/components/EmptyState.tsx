import { Inbox, BellOff } from "lucide-react";

interface EmptyStateProps {
  type: "all" | "unread";
}

export function EmptyState({ type }: EmptyStateProps) {
  const isUnread = type === "unread";

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
        {isUnread ? (
          <BellOff className="h-10 w-10 text-muted-foreground" />
        ) : (
          <Inbox className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {isUnread ? "Semua sudah dibaca!" : "Tidak ada notifikasi"}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        {isUnread 
          ? "Anda sudah membaca semua notifikasi. Bagus sekali!" 
          : "Belum ada notifikasi yang masuk. Cek lagi nanti!"}
      </p>
    </div>
  );
}
