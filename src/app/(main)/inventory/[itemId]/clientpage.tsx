"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { formatJST } from "@/lib/date";
import type { InventoryItem, InventoryLog } from "@/types/inventory";
import { ArrowLeft, Pencil, Save, X, History } from "lucide-react";
import { toast } from "sonner";

export default function InventoryDetailPage() {
  const params = useParams();
  const itemId = params.itemId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InventoryItem>>({});

  useEffect(() => {
    if (!itemId) return;
    const unsub = onSnapshot(doc(db, "inventory", itemId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const item = { id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || new Date(), updatedAt: d.updatedAt?.toDate?.() || new Date(), lastCheckedAt: d.lastCheckedAt?.toDate?.() || null } as InventoryItem;
        setItem(item);
        setForm(item);
      }
    });
    return () => unsub();
  }, [itemId]);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "inventoryLogs"), where("itemId", "==", itemId), orderBy("createdAt", "desc")));
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as InventoryLog)));
    })();
  }, [itemId]);

  const handleSave = async () => {
    if (!itemId || !form.name?.trim()) return;
    await updateDoc(doc(db, "inventory", itemId), { ...form, updatedAt: serverTimestamp() });
    toast.success("更新しました");
    setEditing(false);
  };

  if (!item) return <div className="p-6 text-muted-foreground">読み込み中...</div>;

  const catLabel = INVENTORY_CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
  const condLabel = ITEM_CONDITIONS.find((c) => c.value === item.condition)?.label || item.condition;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>

      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold">{editing ? <input type="text" value={form.name || ""} onChange={(e) => setForm({...form, name: e.target.value})} className="bg-secondary text-foreground px-3 py-1 rounded-lg outline-none text-2xl font-bold" /> : item.name}</h1>
          <div className="flex gap-2">
            {editing ? (
              <><button onClick={handleSave} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm"><Save className="h-4 w-4" />保存</button>
              <button onClick={() => { setEditing(false); setForm(item); }} className="text-muted-foreground"><X className="h-4 w-4" /></button></>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-lg text-sm"><Pencil className="h-4 w-4" />編集</button>
            )}
          </div>
        </div>

        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="max-h-48 rounded-lg mb-4" />}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">カテゴリ:</span> {editing ? <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value as any})} className="bg-secondary px-2 py-1 rounded ml-1">{INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : catLabel}</div>
          <div><span className="text-muted-foreground">状態:</span> {editing ? <select value={form.condition} onChange={(e) => setForm({...form, condition: e.target.value as any})} className="bg-secondary px-2 py-1 rounded ml-1">{ITEM_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : condLabel}</div>
          <div><span className="text-muted-foreground">数量:</span> {editing ? <input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} className="bg-secondary px-2 py-1 rounded ml-1 w-20" /> : item.quantity}</div>
          <div><span className="text-muted-foreground">場所:</span> {editing ? <input type="text" value={form.location || ""} onChange={(e) => setForm({...form, location: e.target.value})} className="bg-secondary px-2 py-1 rounded ml-1" /> : item.location}</div>
          {item.barcode && <div><span className="text-muted-foreground">バーコード:</span> <span className="font-mono">{item.barcode}</span></div>}
          <div><span className="text-muted-foreground">登録者:</span> {item.registeredByName}</div>
          <div><span className="text-muted-foreground">更新:</span> {formatJST(item.updatedAt)}</div>
        </div>

        {item.description && <div className="mt-4"><span className="text-muted-foreground text-sm">説明:</span><p className="text-sm mt-1">{item.description}</p></div>}
        {item.notes && <div className="mt-4"><span className="text-muted-foreground text-sm">備考:</span><p className="text-sm mt-1">{item.notes}</p></div>}
        {(item.tags || []).length > 0 && <div className="flex gap-1 mt-3">{item.tags.map((t) => <span key={t} className="bg-secondary text-xs px-2 py-0.5 rounded">{t}</span>)}</div>}
      </div>

      {logs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" />操作履歴</h2>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground text-xs whitespace-nowrap">{formatJST(l.createdAt)}</span>
                <span className="font-medium">{l.userName}</span>
                <span className="text-muted-foreground">{l.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
