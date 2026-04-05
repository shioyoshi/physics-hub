"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { formatJST } from "@/lib/date";
import type { WikiPage } from "@/types/wiki";
import { Pencil, Pin, History, ArrowLeft, Sparkles, Link2 } from "lucide-react";
import { toast } from "sonner";
import { summarizeText } from "@/lib/gemini";

export default function WikiViewPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const { user } = useAuthStore();

  const [page, setPage] = useState<WikiPage | null>(null);
  const [backlinks, setBacklinks] = useState<{id:string;title:string}[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    const unsub = onSnapshot(doc(db, "wikiPages", pageId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPage({ id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || new Date(), updatedAt: d.updatedAt?.toDate?.() || new Date() } as WikiPage);
      }
    });
    return () => unsub();
  }, [pageId]);

  // Backlinks
  useEffect(() => {
    if (!page?.title) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "wikiPages")));
      const links = snap.docs.filter((d) => {
        const c = d.data().content || "";
        return c.includes(`[[${page.title}]]`) && d.id !== pageId;
      }).map((d) => ({ id: d.id, title: d.data().title }));
      setBacklinks(links);
    })();
  }, [page?.title, pageId]);

  const handlePin = async () => {
    if (!page || !user) return;
    await updateDoc(doc(db, "wikiPages", pageId), { isPinned: !page.isPinned, updatedAt: serverTimestamp() });
    toast.success(page.isPinned ? "ピン留め解除" : "ピン留めしました");
  };

  const handleSummarize = async () => {
    if (!page) return;
    setSummarizing(true);
    try {
      const s = await summarizeText(page.content);
      setSummary(s);
    } catch { toast.error("要約失敗"); } finally { setSummarizing(false); }
  };

  if (!page) return <div className="p-6 text-muted-foreground">読み込み中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/wiki")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Wiki一覧に戻る
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">{page.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{page.authorName}</span>
            <span>更新: {formatJST(page.updatedAt)}</span>
            {(page.tags || []).map((t) => <span key={t} className="bg-secondary px-2 py-0.5 rounded text-xs">{t}</span>)}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleSummarize} disabled={summarizing} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Sparkles className="h-4 w-4" /> {summarizing ? "..." : "AI要約"}
          </button>
          <button onClick={handlePin} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Pin className="h-4 w-4" /> {page.isPinned ? "解除" : "ピン"}
          </button>
          <button onClick={() => router.push(`/wiki/${pageId}/history`)} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <History className="h-4 w-4" /> 履歴
          </button>
          <button onClick={() => router.push(`/wiki/${pageId}/edit`)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
            <Pencil className="h-4 w-4" /> 編集
          </button>
        </div>
      </div>

      {summary && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h3 className="text-sm font-medium text-primary mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />AI要約</h3>
          <p className="text-sm">{summary}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none mb-6">
        <MarkdownRenderer content={page.content} />
      </div>

      {backlinks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Link2 className="h-4 w-4" />バックリンク</h3>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((bl) => (
              <button key={bl.id} onClick={() => router.push(`/wiki/${bl.id}`)} className="text-sm text-primary hover:underline">{bl.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
