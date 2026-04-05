"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, KeyRound, Send, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { approveWithInviteCode, submitApprovalRequest, signOut } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function PendingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"invite" | "request">("invite");

  if (loading) return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  if (!user) { router.replace("/login"); return null; }
  if (user.is_approved) { router.replace("/dashboard"); return null; }

  const handleInvite = async () => {
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    try {
      const ok = await approveWithInviteCode(user.uid, inviteCode.trim());
      if (ok) { toast.success("承認されました！"); router.push("/dashboard"); } else toast.error("招待コードが無効か期限切れです。");
    } catch { toast.error("エラーが発生しました。"); } finally { setSubmitting(false); }
  };

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const num = await submitApprovalRequest(user.uid, user.email, user.displayName, message);
      toast.success(`承認リクエスト送信完了。申請番号: ${num}`);
    } catch { toast.error("エラーが発生しました。"); } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6"><Clock className="h-12 w-12 text-yellow-500 mx-auto mb-3" /><h1 className="text-2xl font-bold">承認待ち</h1><p className="text-muted-foreground mt-1">アカウントの承認が必要です</p>{user.approvalRequestNumber && <p className="text-sm text-primary mt-2">申請番号: {user.approvalRequestNumber}</p>}</div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex border-b border-border">
            <button onClick={() => setTab("invite")} className={`flex-1 py-3 text-sm font-medium ${tab === "invite" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}><KeyRound className="h-4 w-4 inline mr-1" />招待コード</button>
            <button onClick={() => setTab("request")} className={`flex-1 py-3 text-sm font-medium ${tab === "request" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}><Send className="h-4 w-4 inline mr-1" />承認リクエスト</button>
          </div>
          <div className="p-6">
            {tab === "invite" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">部員から招待コードを受け取った場合ここに入力してください。</p>
                <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="招待コード（8文字）" maxLength={8} className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg text-center text-lg tracking-widest font-mono outline-none focus:ring-2 focus:ring-primary" />
                <button onClick={handleInvite} disabled={submitting || inviteCode.length !== 8} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">{submitting ? "確認中..." : "承認する"}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">管理者に承認リクエストを送信します。</p>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="例: 中学2年の○○です。物理部に所属しています。" rows={3} className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-primary resize-none" />
                <button onClick={handleRequest} disabled={submitting || !message.trim()} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">{submitting ? "送信中..." : "承認リクエストを送信"}</button>
              </div>
            )}
          </div>
        </div>
        <button onClick={async () => { await signOut(); router.push("/login"); }} className="mt-4 w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground py-2 text-sm"><LogOut className="h-4 w-4" />ログアウト</button>
      </div>
    </div>
  );
}
