"use client";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { CHANNEL_CATEGORIES } from "@/lib/constants";
import type { Channel } from "@/types/channel";
import { ArrowLeft, Plus, Archive, ArchiveRestore, Trash2, Hash, X, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminChannelsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "general" as const, isPrivate: false });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "channels"), orderBy("category"), orderBy("name")), (snap) => {
      setChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Channel)));
    });
    return () => unsub();
  }, []);

  if (user?.role !== "admin") return <div className="p-6 text-destructive">権限がありません</div>;

  const handleCreate = async () => {
    if (!form.name.trim() || !user) return;
    await addDoc(collection(db, "channels"), {
      name: form.name.trim(), description: form.description.trim(), category: form.category,
      channelType: "default", isPrivate: form.isPrivate,
      allowedRoles: [], allowedUsers: [], isArchived: false, pinnedMessageIds: [],
      createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessageAt: null,
    });
    toast.success("チャンネルを作成しました");
    setShowCreate(false);
    setForm({ name: "", description: "", category: "general", isPrivate: false });
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    await updateDoc(doc(db, "channels", id), { isArchived: !isArchived, updatedAt: serverTimestamp() });
    toast.success(isArchived ? "アーカイブ解除しました" : "アーカイブしました");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このチャンネルを完全に削除しますか？メッセージも失われます。")) return;
    await deleteDoc(doc(db, "channels", id));
    toast.success("削除しました");
  };

  const active = channels.filter((c) => !c.isArchived);
  const archived = channels.filter((c) => c.isArchived);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 管理者パネル
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">チャンネル管理</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> 新規作成
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">新規チャンネル</h2><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
          <div className="space-y-3">
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="チャンネル名" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
            <input type="text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="説明（任意）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
            <div className="flex gap-3">
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
                {CHANNEL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({...form, isPrivate: e.target.checked})} />プライベート</label>
            </div>
            <button onClick={handleCreate} disabled={!form.name.trim()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">作成</button>
          </div>
        </div>
      )}

      <h2 className="font-semibold mb-3">アクティブ ({active.length})</h2>
      <div className="space-y-2 mb-8">
        {active.map((ch) => (
          <div key={ch.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{ch.name}</span>
                {ch.isPrivate && <Lock className="h-3 w-3 text-yellow-500" />}
                <span className="text-xs text-muted-foreground">{CHANNEL_CATEGORIES.find((c) => c.value === ch.category)?.label}</span>
              </div>
              {ch.description && <p className="text-xs text-muted-foreground truncate">{ch.description}</p>}
            </div>
            <button onClick={() => handleArchive(ch.id, ch.isArchived)} className="p-1.5 text-muted-foreground hover:text-yellow-500" title="アーカイブ"><Archive className="h-4 w-4" /></button>
            <button onClick={() => handleDelete(ch.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="削除"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">アーカイブ済み ({archived.length})</h2>
          <div className="space-y-2">
            {archived.map((ch) => (
              <div key={ch.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 opacity-60">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm">{ch.name}</span>
                <button onClick={() => handleArchive(ch.id, ch.isArchived)} className="p-1.5 text-muted-foreground hover:text-green-500" title="復元"><ArchiveRestore className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(ch.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="削除"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
