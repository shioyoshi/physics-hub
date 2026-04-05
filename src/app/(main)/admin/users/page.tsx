"use client";
import { useEffect, useState } from "react";
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import type { User } from "@/types/user";
import type { CustomRole } from "@/types/role";
import { ArrowLeft, Shield, Ban, VolumeX, Volume2, ShieldCheck, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "users")), (snap) => {
      setUsers(snap.docs.map((d) => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date(), updatedAt: d.data().updatedAt?.toDate?.() || new Date() } as User)));
    });
    const unsub2 = onSnapshot(query(collection(db, "customRoles")), (snap) => {
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomRole)));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  if (currentUser?.role !== "admin") return <div className="p-6 text-destructive">権限がありません</div>;

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (uid: string, role: "admin" | "user" | "graduate") => {
    if (role === "admin") {
      if (!confirm("このユーザーを管理者に昇格しますか？この操作は慎重に行ってください。")) return;
    }
    await updateDoc(doc(db, "users", uid), { role, updatedAt: serverTimestamp() });
    toast.success("ロールを変更しました");
  };

  const handleBan = async (uid: string, isBanned: boolean) => {
    if (!confirm(isBanned ? "BANを解除しますか？" : "このユーザーをBANしますか？")) return;
    await updateDoc(doc(db, "users", uid), { is_banned: !isBanned, updatedAt: serverTimestamp() });
    toast.success(isBanned ? "BANを解除しました" : "BANしました");
  };

  const handleMute = async (uid: string, isMuted: boolean) => {
    await updateDoc(doc(db, "users", uid), { is_muted: !isMuted, updatedAt: serverTimestamp() });
    toast.success(isMuted ? "ミュートを解除しました" : "ミュートしました");
  };

  const handleCustomRoleToggle = async (uid: string, currentRoles: string[], roleId: string) => {
    const newRoles = currentRoles.includes(roleId)
      ? currentRoles.filter((r) => r !== roleId)
      : [...currentRoles, roleId];
    await updateDoc(doc(db, "users", uid), { customRoles: newRoles, updatedAt: serverTimestamp() });
    toast.success("カスタムロールを更新しました");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 管理者パネル
      </button>
      <h1 className="text-2xl font-bold mb-6">ユーザー管理 ({users.length}人)</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前・メールで検索"
          className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
      </div>

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.uid} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={u.displayName} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{u.displayName}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded capitalize",
                    u.role === "admin" ? "bg-red-500/20 text-red-400" :
                    u.role === "graduate" ? "bg-purple-500/20 text-purple-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>{u.role}</span>
                  {u.is_banned && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">BAN</span>}
                  {u.is_muted && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">ミュート</span>}
                  {!u.is_approved && <span className="text-xs bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">未承認</span>}
                  {(u.customRoles || []).map((r) => <RoleBadge key={r} roleId={r} />)}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select value={u.role} onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                  className="bg-secondary text-foreground text-xs px-2 py-1 rounded outline-none">
                  <option value="user">user</option>
                  <option value="graduate">graduate</option>
                  <option value="admin">admin</option>
                </select>
                <button onClick={() => handleMute(u.uid, u.is_muted)}
                  className={cn("p-1.5 rounded", u.is_muted ? "text-yellow-400 bg-yellow-400/10" : "text-muted-foreground hover:bg-secondary")}
                  title={u.is_muted ? "ミュート解除" : "ミュート"}>
                  {u.is_muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <button onClick={() => handleBan(u.uid, u.is_banned)}
                  className={cn("p-1.5 rounded", u.is_banned ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:bg-secondary")}
                  title={u.is_banned ? "BAN解除" : "BAN"}>
                  <Ban className="h-4 w-4" />
                </button>
                <button onClick={() => setSelectedUser(selectedUser?.uid === u.uid ? null : u)}
                  className="p-1.5 rounded text-muted-foreground hover:bg-secondary" title="カスタムロール">
                  <Shield className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selectedUser?.uid === u.uid && roles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">カスタムロール割り当て:</p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <button key={role.id} onClick={() => handleCustomRoleToggle(u.uid, u.customRoles || [], role.id)}
                      className={cn("px-3 py-1 rounded-full text-xs border transition-colors",
                        (u.customRoles || []).includes(role.id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      )} style={{ color: role.color }}>
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
