"use client";
import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, MessageSquare, Calendar, Package } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useSearch } from "@/hooks/useSearch";

const icons: Record<string, typeof Search> = { wiki: BookOpen, message: MessageSquare, event: Calendar, inventory: Package };
const labels: Record<string, string> = { wiki: "Wiki", message: "メッセージ", event: "イベント", inventory: "物品" };

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { searchQuery, debouncedQuery, results, isSearching, setQuery, performSearch, clearSearch } = useSearch();

  useEffect(() => { if (debouncedQuery) performSearch(debouncedQuery); }, [debouncedQuery, performSearch]);
  const close = useCallback(() => { setCommandPaletteOpen(false); clearSearch(); }, [setCommandPaletteOpen, clearSearch]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [commandPaletteOpen, close]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]" onClick={close}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input type="text" value={searchQuery} onChange={(e) => setQuery(e.target.value)} placeholder="Wiki、メッセージ、イベント、物品を検索..." className="flex-1 bg-transparent text-foreground outline-none" autoFocus />
          <kbd className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isSearching && <div className="p-4 text-center text-muted-foreground text-sm">検索中...</div>}
          {!isSearching && searchQuery && results.length === 0 && <div className="p-4 text-center text-muted-foreground text-sm">結果が見つかりません</div>}
          {results.map((r) => {
            const Icon = icons[r.type] || Search;
            return (
              <button key={`${r.type}-${r.id}`} onClick={() => { router.push(r.link); close(); }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary text-left transition-colors">
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium truncate">{r.title}</span><span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{labels[r.type]}</span></div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.snippet}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
