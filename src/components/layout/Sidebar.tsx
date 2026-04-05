"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Atom, Hash, MessageSquare, BookOpen, Calendar, BarChart3, Package, Users, Settings, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, LogOut, Pencil, Check } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { updateDocument } from "@/lib/firebase/firestore";
import { signOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { NotificationBell } from "@/components/notification/NotificationBell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Channel } from "@/types/channel";
import { cn } from "@/lib/utils";
import { CHANNEL_CATEGORIES } from "@/lib/constants";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, toggleSidebarCollapse } = useUIStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["general","project","topic","announcement"]));
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");

  useEffect(() => {
    const q = query(collection(db, "channels"), where("isArchived", "==", false), orderBy("category"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Channel[];
      setChannels(data.filter((ch) => {
        if (!ch.isPrivate) return true;
        if (!user) return false;
        if (user.role === "admin") return true;
        return ch.allowedUsers?.includes(user.uid) || ch.allowedRoles?.some((r) => user.customRoles?.includes(r));
      }));
    });
    return () => unsub();
  }, [user]);

  const toggleCat = (c: string) => setExpanded((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const saveName = async () => { if (user && newName.trim()) { await updateDocument("users", user.uid, { displayName: newName.trim() }); setEditingName(false); } };

  if (!sidebarOpen) return null;
  const col = sidebarCollapsed;

  const navItems = [
    { icon: BookOpen, label: "Wiki", href: "/wiki" },
    { icon: Calendar, label: "イベント", href: "/events" },
    { icon: BarChart3, label: "投票", href: "/polls" },
    { icon: Package, label: "物品管理", href: "/inventory" },
    { icon: Users, label: "メンバー", href: "/members" },
    { icon: MessageSquare, label: "DM", href: "/dm" },
  ];

  return (
    <aside className={cn("fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col z-40 transition-all", col ? "w-16" : "w-64")}>
      <div className="h-14 flex items-center justify-between px-3 border-b border-border shrink-0">
        {!col && <div className="flex items-center gap-2"><Atom className="h-6 w-6 text-primary" /><span className="font-bold text-lg">PhysicsHub</span></div>}
        <button onClick={toggleSidebarCollapse} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">{col ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {CHANNEL_CATEGORIES.map(({ value, label }) => {
          const cats = channels.filter((c) => c.category === value);
          if (cats.length === 0 && value !== "general") return null;
          const isExp = expanded.has(value);
          return (
            <div key={value} className="mb-2">
              <button onClick={() => toggleCat(value)} className={cn("flex items-center gap-1 w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground", col && "justify-center")}>
                {!col && <>{isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{label}</>}
                {col && <Hash className="h-4 w-4" />}
              </button>
              {isExp && !col && cats.map((ch) => (
                <button key={ch.id} onClick={() => router.push(`/channels/${ch.id}`)}
                  className={cn("flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm", pathname === `/channels/${ch.id}` ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                  <Hash className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{ch.name}</span>{ch.isPrivate && <span className="text-[10px]">🔒</span>}
                </button>
              ))}
            </div>
          );
        })}
        <div className="border-t border-border pt-2 mt-2">
          {navItems.map(({ icon: Icon, label, href }) => (
            <button key={href} onClick={() => router.push(href)} className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm", pathname.startsWith(href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground", col && "justify-center px-0")}>
              <Icon className="h-4 w-4 shrink-0" />{!col && <span>{label}</span>}
            </button>
          ))}
          {user?.role === "admin" && (
            <button onClick={() => router.push("/admin")} className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm", pathname.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground", col && "justify-center px-0")}>
              <Settings className="h-4 w-4 shrink-0" />{!col && <span>管理者パネル</span>}
            </button>
          )}
        </div>
      </nav>
      <div className="border-t border-border p-3 shrink-0">
        {!col ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={user?.displayName || ""} size="md" />
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-secondary text-foreground text-sm px-1 py-0.5 rounded w-full outline-none" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }} />
                  <button onClick={saveName}><Check className="h-3 w-3 text-green-400" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate">{user?.displayName}</span>
                  <button onClick={() => { setNewName(user?.displayName || ""); setEditingName(true); }}><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <NotificationBell />
            <button onClick={async () => { await signOut(); router.push("/login"); }} className="p-1 text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2"><UserAvatar name={user?.displayName || ""} size="sm" /><NotificationBell /></div>
        )}
      </div>
    </aside>
  );
}
