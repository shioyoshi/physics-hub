"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatRelative } from "@/lib/date";
import type { DMConversation } from "@/types/message";
import { MessageSquare, Plus, X, Search } from "lucide-react";

export default function DMListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState<{uid:string;displayName:string;email:string}[]>([]);
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "dmConversations"), where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, lastMessageAt: data.lastMessageAt?.toDate?.() || null, createdAt: data.createdAt?.toDate?.() || new Date() } as DMConversation;
      }));
    });
    return () => unsub();
  }, [user?.uid]);

  const loadUsers = async () => {
    const snap = await getDocs(query(collection(db, "users"), where("is_approved", "==", true)));
    setUsers(snap.docs.map((d) => ({ uid: d.data().uid, displayName: d.data().displayName, email: d.data().email })).filter((u) => u.uid !== user?.uid));
    setShowNew(true);
  };

  const startConversation = async (targetUid: string, targetName: string) => {
    if (!user) return;
    const existing = conversations.find((c) => c.participants.includes(targetUid));
    if (existing) { router.push(`/dm/${existing.id}`); return; }
    const docRef = await addDoc(collection(db, "dmConversations"), {
      participants: [user.uid, targetUid],
      participantNames: { [user.uid]: user.displayName, [targetUid]: targetName },
      lastMessage: null, lastMessageAt: serverTimestamp(), createdAt: serverTimestamp(),
    });
    router.push(`/dm/${docRef.id}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ダイレクトメッセージ</h1>
        <button onClick={loadUsers} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm"><Plus className="h-4 w-4" /> 新規</button>
      </div>

      {showNew && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">ユーザーを選択</h2><button onClick={() => setShowNew(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="名前で検索..." className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" /></div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {users.filter((u) => u.displayName.toLowerCase().includes(searchUser.toLowerCase())).map((u) => (
              <button key={u.uid} onClick={() => startConversation(u.uid, u.displayName)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-left">
                <UserAvatar name={u.displayName} size="sm" /><span className="text-sm">{u.displayName}</span><span className="text-xs text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {conversations.map((conv) => {
          const otherName = Object.entries(conv.participantNames || {}).find(([k]) => k !== user?.uid)?.[1] || "不明";
          return (
            <button key={conv.id} onClick={() => router.push(`/dm/${conv.id}`)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary transition-colors text-left">
              <UserAvatar name={otherName} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between"><span className="font-medium text-sm">{otherName}</span>{conv.lastMessageAt && <span className="text-xs text-muted-foreground">{formatRelative(conv.lastMessageAt)}</span>}</div>
                {conv.lastMessage && <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>}
              </div>
            </button>
          );
        })}
        {conversations.length === 0 && <div className="text-center py-12 text-muted-foreground"><MessageSquare className="h-8 w-8 mx-auto mb-2" /><p>DMはありません</p></div>}
      </div>
    </div>
  );
}
