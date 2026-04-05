"use client";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const router = useRouter();
  return (
    <button onClick={() => router.push("/notifications")} className="relative p-1 text-muted-foreground hover:text-foreground">
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
