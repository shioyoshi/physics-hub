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
