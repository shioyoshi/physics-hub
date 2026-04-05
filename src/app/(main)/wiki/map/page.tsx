"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { generateWikiMap } from "@/lib/gemini";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function WikiMapPage() {
  const router = useRouter();
  const [mapData, setMapData] = useState<{nodes:{id:string;group:string}[];links:{source:string;target:string;relation:string}[]} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "wikiPages"));
      const pages = snap.docs.map((d) => {
        const data = d.data();
        return { title: data.title, content: data.content || "", tags: data.tags || [] };
      });
      const result = await generateWikiMap(pages);
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setMapData(JSON.parse(cleaned));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push("/wiki")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Wiki一覧</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wiki マップ</h1>
        <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> {loading ? "生成中..." : "AIでマップ生成"}
        </button>
      </div>
      {mapData ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-4">ページ関連図</h3>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">ノード ({mapData.nodes.length})</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {mapData.nodes.map((n) => (
                <span key={n.id} className="bg-secondary px-3 py-1 rounded-full text-sm">{n.id} <span className="text-xs text-muted-foreground">({n.group})</span></span>
              ))}
            </div>
            <h4 className="text-sm font-medium text-muted-foreground">リンク ({mapData.links.length})</h4>
            <div className="space-y-1">
              {mapData.links.map((l, i) => (
                <div key={i} className="text-sm text-muted-foreground">{l.source} → {l.target} <span className="text-xs">({l.relation})</span></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground"><p>「AIでマップ生成」をクリックすると、Wikiページの関連図を生成します</p></div>
      )}
    </div>
  );
}
