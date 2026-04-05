"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { toast } from "sonner";
import { Save, Eye, Edit, ArrowLeft } from "lucide-react";

export default function WikiEditPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      const snap = await getDoc(doc(db, "wikiPages", pageId));
      if (snap.exists()) {
        const d = snap.data();
        setTitle(d.title); setContent(d.content); setTags((d.tags || []).join(", "));
      }
    })();
  }, [pageId]);

  useEffect(() => {
    if (!pageId || !user) return;
    updateDoc(doc(db, "wikiPages", pageId), { currentEditors: arrayUnion(user.uid) });
    return () => { updateDoc(doc(db, "wikiPages", pageId), { currentEditors: arrayRemove(user.uid) }); };
  }, [pageId, user]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "wikiPages", pageId), {
        title: title.trim(), content: content.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "wikiRevisions"), {
        pageId, content: content.trim(), editedBy: user.uid, editedByName: user.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success("保存しました"); router.push(`/wiki/${pageId}`);
    } catch { toast.error("保存に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push(`/wiki/${pageId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm">
            {preview ? <><Edit className="h-4 w-4" />編集</> : <><Eye className="h-4 w-4" />プレビュー</>}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-secondary text-foreground text-xl font-semibold px-4 py-3 rounded-lg mb-4 outline-none" />
      <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="タグ（カンマ区切り）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg mb-4 outline-none text-sm" />
      {preview ? (
        <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none min-h-[400px]"><MarkdownRenderer content={content} /></div>
      ) : (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg outline-none resize-none font-mono text-sm min-h-[400px]" />
      )}
    </div>
  );
}
