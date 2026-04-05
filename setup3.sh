#!/bin/bash
# ============================================================
# PhysicsHub 最終パート - setup3.sh
# physics-hub フォルダ内で実行
# ============================================================
set -e
echo "🔬 PhysicsHub 最終パート生成開始..."

# ============================================================
# Admin Dashboard
# ============================================================
cat > "src/app/(main)/admin/page.tsx" << 'ADMIN_EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Users, Shield, Hash, KeyRound, CheckCircle } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <div className="p-6 text-destructive">アクセス権限がありません。</div>;

  const items = [
    { icon: Users, label: "ユーザー管理", desc: "ロール変更、BAN/ミュート", href: "/admin/users" },
    { icon: Shield, label: "ロール管理", desc: "カスタムロール作成・編集", href: "/admin/roles" },
    { icon: Hash, label: "チャンネル管理", desc: "アーカイブ・削除", href: "/admin/channels" },
    { icon: KeyRound, label: "招待コード", desc: "発行・使用状況確認", href: "/admin/invites" },
    { icon: CheckCircle, label: "承認リクエスト", desc: "承認待ちの処理", href: "/admin/approvals" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">管理者パネル</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, label, desc, href }) => (
          <button key={href} onClick={() => router.push(href)} className="text-left bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
            <Icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">{label}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
ADMIN_EOF
echo "✅ Admin dashboard"

# ============================================================
# Admin - User Management
# ============================================================
cat > "src/app/(main)/admin/users/page.tsx" << 'ADMINUSERS_EOF'
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
ADMINUSERS_EOF
echo "✅ Admin users"

# ============================================================
# Admin - Role Management
# ============================================================
cat > "src/app/(main)/admin/roles/page.tsx" << 'ADMINROLES_EOF'
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
ADMINROLES_EOF
echo "✅ Admin roles"

# ============================================================
# Admin - Channel Management
# ============================================================
cat > "src/app/(main)/admin/channels/page.tsx" << 'ADMINCHAN_EOF'
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
ADMINCHAN_EOF
echo "✅ Admin channels"

# ============================================================
# Admin - Invite Codes
# ============================================================
cat > "src/app/(main)/admin/invites/page.tsx" << 'ADMININV_EOF'
"use client";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { generateInviteCode } from "@/lib/firebase/auth";
import { formatJST, isExpired } from "@/lib/date";
import type { InviteCode } from "@/types/user";
import { ArrowLeft, Plus, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminInvitesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expDays, setExpDays] = useState(7);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "inviteCodes"), orderBy("createdAt", "desc")), (snap) => {
      setCodes(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, expiresAt: data.expiresAt?.toDate?.() || new Date(), usedAt: data.usedAt?.toDate?.() || null, createdAt: data.createdAt?.toDate?.() || new Date() } as InviteCode;
      }));
    });
    return () => unsub();
  }, []);

  if (user?.role !== "admin") return <div className="p-6 text-destructive">権限がありません</div>;

  const handleGenerate = async () => {
    if (!user) return;
    const code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expDays);
    await addDoc(collection(db, "inviteCodes"), {
      code, createdBy: user.uid, usedBy: null, usedAt: null,
      expiresAt, isUsed: false, createdAt: serverTimestamp(),
    });
    toast.success(`招待コード "${code}" を発行しました`);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("コピーしました");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 管理者パネル
      </button>
      <h1 className="text-2xl font-bold mb-6">招待コード管理</h1>

      <div className="bg-card border border-border rounded-lg p-4 mb-6 flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">有効期間（日）</label>
          <input type="number" value={expDays} onChange={(e) => setExpDays(parseInt(e.target.value) || 1)} min={1} max={90}
            className="w-20 bg-secondary text-foreground px-3 py-2 rounded-lg outline-none" />
        </div>
        <button onClick={handleGenerate} className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> コード発行
        </button>
      </div>

      <div className="space-y-2">
        {codes.map((c) => {
          const expired = isExpired(c.expiresAt);
          return (
            <div key={c.id} className={cn("bg-card border border-border rounded-lg p-4 flex items-center gap-4", (c.isUsed || expired) && "opacity-60")}>
              <code className="font-mono text-lg tracking-widest font-bold text-primary">{c.code}</code>
              <div className="flex-1 text-xs text-muted-foreground">
                <div>有効期限: {formatJST(c.expiresAt)}</div>
                {c.isUsed && c.usedBy && <div className="text-green-400">使用済み ({c.usedBy})</div>}
                {expired && !c.isUsed && <div className="text-destructive">期限切れ</div>}
                {!c.isUsed && !expired && <div className="text-green-400">有効</div>}
              </div>
              {!c.isUsed && !expired && (
                <button onClick={() => handleCopy(c.code, c.id)} className="p-1.5 text-muted-foreground hover:text-foreground">
                  {copiedId === c.id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          );
        })}
        {codes.length === 0 && <p className="text-center text-muted-foreground py-8">招待コードはまだありません</p>}
      </div>
    </div>
  );
}
ADMININV_EOF
echo "✅ Admin invites"

# ============================================================
# Admin - Approval Requests
# ============================================================
cat > "src/app/(main)/admin/approvals/page.tsx" << 'ADMINAPPR_EOF'
"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { formatJST } from "@/lib/date";
import type { ApprovalRequest } from "@/types/user";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminApprovalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  useEffect(() => {
    const constraints = filter === "pending"
      ? [where("status", "==", "pending"), orderBy("createdAt", "desc")]
      : [orderBy("createdAt", "desc")];
    const q = query(collection(db, "approvalRequests"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date(), reviewedAt: d.data().reviewedAt?.toDate?.() || null } as ApprovalRequest)));
    });
    return () => unsub();
  }, [filter]);

  if (user?.role !== "admin") return <div className="p-6 text-destructive">権限がありません</div>;

  const handleApprove = async (req: ApprovalRequest) => {
    await updateDoc(doc(db, "approvalRequests", req.id), { status: "approved", reviewedBy: user.uid, reviewedAt: serverTimestamp() });
    await updateDoc(doc(db, "users", req.uid), { is_approved: true, approvalMethod: "manual", updatedAt: serverTimestamp() });
    toast.success(`${req.displayName} を承認しました`);
  };

  const handleReject = async (req: ApprovalRequest) => {
    if (!confirm("このリクエストを拒否しますか？")) return;
    await updateDoc(doc(db, "approvalRequests", req.id), { status: "rejected", reviewedBy: user.uid, reviewedAt: serverTimestamp() });
    toast.success("拒否しました");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 管理者パネル
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">承認リクエスト</h1>
        <div className="flex gap-2">
          <button onClick={() => setFilter("pending")} className={cn("px-3 py-1.5 rounded-lg text-sm", filter === "pending" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>未処理</button>
          <button onClick={() => setFilter("all")} className={cn("px-3 py-1.5 rounded-lg text-sm", filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>すべて</button>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{req.displayName}</span>
                  <span className="text-xs text-muted-foreground">{req.email}</span>
                  <span className="text-xs font-mono text-primary">#{req.requestNumber}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{req.message}</p>
                <p className="text-xs text-muted-foreground">{formatJST(req.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {req.status === "pending" ? (
                  <>
                    <button onClick={() => handleApprove(req)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700">
                      <CheckCircle className="h-4 w-4" /> 承認
                    </button>
                    <button onClick={() => handleReject(req)} className="flex items-center gap-1 bg-destructive text-white px-3 py-1.5 rounded-lg text-sm hover:bg-destructive/90">
                      <XCircle className="h-4 w-4" /> 拒否
                    </button>
                  </>
                ) : (
                  <span className={cn("text-xs px-2 py-1 rounded",
                    req.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"
                  )}>{req.status === "approved" ? "承認済み" : "拒否"}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="text-center py-12 text-muted-foreground"><Clock className="h-8 w-8 mx-auto mb-2" /><p>{filter === "pending" ? "未処理のリクエストはありません" : "リクエストはありません"}</p></div>}
      </div>
    </div>
  );
}
ADMINAPPR_EOF
echo "✅ Admin approvals"

# ============================================================
# Search Page
# ============================================================
cat > "src/app/(main)/search/page.tsx" << 'SEARCH_EOF'
"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearch } from "@/hooks/useSearch";
import { BookOpen, MessageSquare, Calendar, Package, Search } from "lucide-react";

const icons: Record<string, typeof Search> = { wiki: BookOpen, message: MessageSquare, event: Calendar, inventory: Package };
const labels: Record<string, string> = { wiki: "Wiki", message: "メッセージ", event: "イベント", inventory: "物品" };

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { results, isSearching, performSearch } = useSearch();

  useEffect(() => { if (q) performSearch(q); }, [q, performSearch]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">検索結果: {q}</h1>
      {isSearching && <p className="text-muted-foreground">検索中...</p>}
      {!isSearching && results.length === 0 && q && <p className="text-muted-foreground">結果が見つかりません</p>}
      <div className="space-y-2">
        {results.map((r) => {
          const Icon = icons[r.type] || Search;
          return (
            <button key={`${r.type}-${r.id}`} onClick={() => router.push(r.link)}
              className="w-full flex items-start gap-3 bg-card border border-border rounded-lg p-4 hover:border-primary/50 text-left transition-colors">
              <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span><span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{labels[r.type]}</span></div>
                <p className="text-sm text-muted-foreground mt-0.5">{r.snippet}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
SEARCH_EOF
echo "✅ Search page"

# ============================================================
# Event detail (placeholder for routing)
# ============================================================
cat > "src/app/(main)/events/[eventId]/page.tsx" << 'EVENTDETAIL_EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function EventDetailPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <button onClick={() => router.push("/events")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> イベント一覧
      </button>
      <p className="text-muted-foreground">イベント詳細はイベント一覧ページに統合されています。</p>
    </div>
  );
}
EVENTDETAIL_EOF

cat > "src/app/(main)/polls/[pollId]/page.tsx" << 'POLLDETAIL_EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PollDetailPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <button onClick={() => router.push("/polls")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 投票一覧
      </button>
      <p className="text-muted-foreground">投票詳細は投票一覧ページに統合されています。</p>
    </div>
  );
}
POLLDETAIL_EOF
echo "✅ Detail placeholder pages"

# ============================================================
# next-env.d.ts (Next.js requires this)
# ============================================================
cat > next-env.d.ts << 'NEXTENV_EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
NEXTENV_EOF
echo "✅ next-env.d.ts"

# ============================================================
# public/manifest.json
# ============================================================
cat > public/manifest.json << 'MANIFEST_EOF'
{
  "name": "PhysicsHub - 海城物理部SNS",
  "short_name": "PhysicsHub",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0c1021",
  "theme_color": "#3b82f6",
  "icons": []
}
MANIFEST_EOF
echo "✅ manifest.json"

echo ""
echo "============================================"
echo "🎉 PhysicsHub 全ファイル生成完了！"
echo "============================================"
echo ""
echo "次のステップ:"
echo "  1. .env.local を編集してFirebase情報を入力"
echo "  2. npm install"
echo "  3. npm run dev"
echo ""
