"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatJST } from "@/lib/date";
import type { WikiRevision } from "@/types/wiki";
import { ArrowLeft, Clock } from "lucide-react";

export default function WikiHistoryPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "wikiRevisions"), where("pageId", "==", pageId), orderBy("createdAt", "desc")));
      setRevisions(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as WikiRevision)));
    })();
  }, [pageId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push(`/wiki/${pageId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 戻る</button>
      <h1 className="text-2xl font-bold mb-6">編集履歴</h1>
      <div className="space-y-3">
        {revisions.map((r, i) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{r.editedByName}</span>
              <span className="text-xs text-muted-foreground">{formatJST(r.createdAt)}</span>
              {i === 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">最新</span>}
            </div>
            <pre className="text-xs text-muted-foreground bg-secondary rounded p-3 max-h-32 overflow-auto whitespace-pre-wrap">{r.content.substring(0, 500)}{r.content.length > 500 ? "..." : ""}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
