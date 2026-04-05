"use client";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import type { CustomRole } from "@/types/role";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminRolesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [newRole, setNewRole] = useState({ name: "", color: "#3b82f6" });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "customRoles"), orderBy("order", "asc")), (snap) => {
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as CustomRole)));
    });
    return () => unsub();
  }, []);

  if (user?.role !== "admin") return <div className="p-6 text-destructive">権限がありません</div>;

  const handleCreate = async () => {
    if (!newRole.name.trim()) return;
    await addDoc(collection(db, "customRoles"), {
      name: newRole.name.trim(), color: newRole.color, order: roles.length,
      createdBy: user.uid, createdAt: serverTimestamp(),
    });
    setNewRole({ name: "", color: "#3b82f6" });
    toast.success("ロールを作成しました");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このロールを削除しますか？")) return;
    await deleteDoc(doc(db, "customRoles", id));
    toast.success("削除しました");
  };

  const handleUpdate = async (id: string, data: Partial<CustomRole>) => {
    await updateDoc(doc(db, "customRoles", id), data);
    toast.success("更新しました");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 管理者パネル
      </button>
      <h1 className="text-2xl font-bold mb-6">ロール管理</h1>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">新規ロール作成</h2>
        <div className="flex gap-3 items-end">
          <input type="text" value={newRole.name} onChange={(e) => setNewRole({...newRole, name: e.target.value})}
            placeholder="ロール名" className="flex-1 bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">色:</label>
            <input type="color" value={newRole.color} onChange={(e) => setNewRole({...newRole, color: e.target.value})} className="h-9 w-12 rounded cursor-pointer bg-transparent" />
          </div>
          <button onClick={handleCreate} disabled={!newRole.name.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            <Plus className="h-4 w-4" /> 作成
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
            <input type="text" defaultValue={role.name}
              onBlur={(e) => { if (e.target.value !== role.name) handleUpdate(role.id, { name: e.target.value }); }}
              className="flex-1 bg-transparent text-foreground font-medium outline-none hover:bg-secondary px-2 py-1 rounded" />
            <input type="color" defaultValue={role.color}
              onChange={(e) => handleUpdate(role.id, { color: e.target.value })}
              className="h-8 w-10 rounded cursor-pointer bg-transparent" />
            <input type="number" defaultValue={role.order} min={0}
              onBlur={(e) => handleUpdate(role.id, { order: parseInt(e.target.value) || 0 })}
              className="w-16 bg-secondary text-foreground px-2 py-1 rounded text-sm outline-none text-center" />
            <button onClick={() => handleDelete(role.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {roles.length === 0 && <p className="text-muted-foreground text-center py-8">カスタムロールはまだありません</p>}
      </div>
    </div>
  );
}
