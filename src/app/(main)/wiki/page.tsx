"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatRelative } from "@/lib/date";
import type { WikiPage } from "@/types/wiki";
import { BookOpen, Plus, Pin, Tag, Search, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WikiListPage() {
  const router = useRouter();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "wikiPages"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPages(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date(), updatedAt: data.updatedAt?.toDate?.() || new Date() } as WikiPage;
      }));
    });
    return () => unsub();
  }, []);

  const allTags = [...new Set(pages.flatMap((p) => p.tags || []))];
  const filtered = pages.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
    const matchTag = !tagFilter || (p.tags || []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  const pinned = filtered.filter((p) => p.isPinned);
  const others = filtered.filter((p) => !p.isPinned);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wiki</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/wiki/map")} className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Map className="h-4 w-4" /> マップ
          </button>
          <button onClick={() => router.push("/wiki/new")} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 新規作成
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ページを検索..."
            className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTagFilter(null)} className={cn("px-2 py-1 rounded text-xs", !tagFilter ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>すべて</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)} className={cn("px-2 py-1 rounded text-xs", tagFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Pin className="h-3 w-3" />ピン留め</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pinned.map((p) => (
              <button key={p.id} onClick={() => router.push(`/wiki/${p.id}`)} className="text-left bg-card border border-yellow-500/20 rounded-lg p-4 hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.content.substring(0, 120)}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{p.authorName}</span><span>·</span><span>{formatRelative(p.updatedAt)}</span>
                  {(p.tags || []).map((t) => <span key={t} className="bg-secondary px-1.5 py-0.5 rounded">{t}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {others.map((p) => (
          <button key={p.id} onClick={() => router.push(`/wiki/${p.id}`)} className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
            <h3 className="font-semibold mb-1">{p.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{p.content.substring(0, 120)}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{p.authorName}</span><span>·</span><span>{formatRelative(p.updatedAt)}</span>
              {(p.tags || []).map((t) => <span key={t} className="bg-secondary px-1.5 py-0.5 rounded">{t}</span>)}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-8 w-8 mx-auto mb-2" /><p>ページが見つかりません</p></div>
      )}
    </div>
  );
}
