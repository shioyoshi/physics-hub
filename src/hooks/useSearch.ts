"use client";
import { useCallback } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useSearchStore, type SearchResult } from "@/stores/searchStore";
import { useDebounce } from "./useDebounce";

export function useSearch() {
  const { query: searchQuery, results, isSearching, setQuery, setResults, setIsSearching, clearSearch } = useSearchStore();
  const debouncedQuery = useDebounce(searchQuery, 300);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    const sl = q.toLowerCase();
    const all: SearchResult[] = [];
    try {
      const wikiSnap = await getDocs(query(collection(db, "wikiPages"), orderBy("updatedAt", "desc"), limit(100)));
      wikiSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.title?.toLowerCase().includes(sl) || data.content?.toLowerCase().includes(sl) || data.tags?.some((t: string) => t.toLowerCase().includes(sl))) {
          all.push({ id: d.id, type: "wiki", title: data.title, snippet: (data.content || "").substring(0, 120) + "...", link: `/wiki/${d.id}` });
        }
      });
      const msgSnap = await getDocs(query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(200)));
      msgSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.content?.toLowerCase().includes(sl)) {
          all.push({ id: d.id, type: "message", title: `${data.authorName}のメッセージ`, snippet: (data.content || "").substring(0, 120) + "...", link: `/channels/${data.channelId}` });
        }
      });
      const eventSnap = await getDocs(query(collection(db, "events"), orderBy("createdAt", "desc"), limit(50)));
      eventSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.title?.toLowerCase().includes(sl) || data.description?.toLowerCase().includes(sl)) {
          all.push({ id: d.id, type: "event", title: data.title, snippet: (data.description || "").substring(0, 120) + "...", link: `/events/${d.id}` });
        }
      });
      const invSnap = await getDocs(query(collection(db, "inventory"), orderBy("updatedAt", "desc"), limit(100)));
      invSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.name?.toLowerCase().includes(sl) || data.description?.toLowerCase().includes(sl) || data.barcode === q.trim() || data.tags?.some((t: string) => t.toLowerCase().includes(sl))) {
          all.push({ id: d.id, type: "inventory", title: data.name, snippet: `${data.category} / ${data.location} / 数量: ${data.quantity}`, link: `/inventory/${d.id}` });
        }
      });
      setResults(all);
    } catch (e) { console.error("Search error:", e); } finally { setIsSearching(false); }
  }, [setResults, setIsSearching]);

  return { searchQuery, debouncedQuery, results, isSearching, setQuery, performSearch, clearSearch };
}
