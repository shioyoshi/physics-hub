"use client";
import { usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

export function Header() {
  const pathname = usePathname();
  const { toggleSidebar, setCommandPaletteOpen } = useUIStore();
  const titles: Record<string, string> = { "/channels": "チャンネル", "/wiki": "Wiki", "/events": "イベント", "/polls": "投票", "/inventory": "物品管理", "/members": "メンバー", "/dm": "DM", "/admin": "管理者パネル", "/notifications": "通知", "/dashboard": "ダッシュボード" };
  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] || "PhysicsHub";
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Menu className="h-5 w-5" /></button>
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>
      <button onClick={() => setCommandPaletteOpen(true)} className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <Search className="h-4 w-4" /><span className="hidden sm:inline">検索</span><kbd className="hidden sm:inline text-xs bg-background px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
    </header>
  );
}
