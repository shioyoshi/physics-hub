"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { toast } from "sonner";
import { Save, Eye, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WikiNewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "wikiPages"), {
        title: title.trim(),
        content: content.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        isPinned: false,
        authorId: user.uid,
        authorName: user.displayName,
        currentEditors: [],
        backlinks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Revision保存
      await addDoc(collection(db, "wikiRevisions"), {
        pageId: docRef.id,
        content: content.trim(),
        editedBy: user.uid,
        editedByName: user.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success("ページを作成しました");
      router.push(`/wiki/${docRef.id}`);
    } catch { toast.error("作成に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">新規Wikiページ</h1>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm">
            {preview ? <><Edit className="h-4 w-4" />編集</> : <><Eye className="h-4 w-4" />プレビュー</>}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ページタイトル"
        className="w-full bg-secondary text-foreground text-xl font-semibold px-4 py-3 rounded-lg mb-4 outline-none" />
      <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="タグ（カンマ区切り: 力学, 電磁気学, 実験）"
        className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg mb-4 outline-none text-sm" />

      {preview ? (
        <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none min-h-[400px]">
          <MarkdownRenderer content={content} />
        </div>
      ) : (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Markdownで記述できます。[[ページ名]] でWiki内リンクを作成できます。"
          className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg outline-none resize-none font-mono text-sm min-h-[400px]" />
      )}
    </div>
  );
}
