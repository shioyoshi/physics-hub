"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import type { User } from "@/types/user";
import { Users, Search } from "lucide-react";

export default function MembersPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), where("is_approved", "==", true), where("is_banned", "==", false));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date(), updatedAt: d.data().updatedAt?.toDate?.() || new Date() } as User)));
    });
    return () => unsub();
  }, []);

  const filtered = members.filter((m) => m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">メンバー ({members.length})</h1>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前・メールアドレスで検索"
          className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
      </div>
      <div className="space-y-1">
        {filtered.map((m) => (
          <div key={m.uid} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary transition-colors">
            <UserAvatar name={m.displayName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{m.displayName}</span>
                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">{m.role}</span>
                {(m.customRoles || []).map((r) => <RoleBadge key={r} roleId={r} />)}
              </div>
              <p className="text-xs text-muted-foreground truncate break-all">{m.email}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /><p>メンバーが見つかりません</p></div>}
      </div>
    </div>
  );
}
