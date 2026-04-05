"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearch } from "@/hooks/useSearch";
import { BookOpen, MessageSquare, Calendar, Package, Search } from "lucide-react";

const icons: Record<string, typeof Search> = { wiki: BookOpen, message: MessageSquare, event: Calendar, inventory: Package };
const labels: Record<string, string> = { wiki: "Wiki", message: "メッセージ", event: "イベント", inventory: "物品" };

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { results, isSearching, performSearch } = useSearch();

  useEffect(() => { if (q) performSearch(q); }, [q, performSearch]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">検索結果: {q}</h1>
      {isSearching && <p className="text-muted-foreground">検索中...</p>}
      {!isSearching && results.length === 0 && q && <p className="text-muted-foreground">結果が見つかりません</p>}
      <div className="space-y-2">
        {results.map((r) => {
          const Icon = icons[r.type] || Search;
          return (
            <button key={`${r.type}-${r.id}`} onClick={() => router.push(r.link)}
              className="w-full flex items-start gap-3 bg-card border border-border rounded-lg p-4 hover:border-primary/50 text-left transition-colors">
              <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span><span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{labels[r.type]}</span></div>
                <p className="text-sm text-muted-foreground mt-0.5">{r.snippet}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
