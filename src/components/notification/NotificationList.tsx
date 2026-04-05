"use client";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelative } from "@/lib/date";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationList() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">通知</h2>
        <button onClick={markAllAsRead} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <CheckCheck className="h-4 w-4" /> すべて既読
        </button>
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Bell className="h-8 w-8 mx-auto mb-2" /><p>通知はありません</p></div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <button key={n.id} onClick={() => { markAsRead(n.id); router.push(n.link); }}
              className={cn("w-full text-left p-3 rounded-lg transition-colors", n.isRead ? "hover:bg-secondary" : "bg-primary/5 hover:bg-primary/10")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", !n.isRead && "text-primary")}>{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(n.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
