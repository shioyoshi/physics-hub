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
