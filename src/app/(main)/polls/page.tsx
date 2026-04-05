"use client";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { formatJST, isExpired } from "@/lib/date";
import { POLL_TYPES } from "@/lib/constants";
import type { Poll, PollOption } from "@/types/poll";
import { BarChart3, Plus, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PollsPage() {
  const { user } = useAuthStore();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", pollType: "single" as const, isAnonymous: false, deadline: "", options: ["", ""] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPolls(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, deadline: data.deadline?.toDate?.() || null, createdAt: data.createdAt?.toDate?.() || new Date(), updatedAt: data.updatedAt?.toDate?.() || new Date() } as Poll;
      }));
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || form.options.filter(Boolean).length < 2 || !user) return;
    setSaving(true);
    try {
      const options: PollOption[] = form.options.filter(Boolean).map((o, i) => ({ id: `opt_${i}`, text: o.trim(), votes: [] }));
      await addDoc(collection(db, "polls"), {
        title: form.title.trim(), description: form.description.trim(), pollType: form.pollType,
        options, isAnonymous: form.isAnonymous,
        deadline: form.deadline ? new Date(form.deadline) : null,
        createdBy: user.uid, createdByName: user.displayName,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast.success("投票を作成しました");
      setShowForm(false);
      setForm({ title: "", description: "", pollType: "single", isAnonymous: false, deadline: "", options: ["", ""] });
    } catch { toast.error("作成に失敗"); } finally { setSaving(false); }
  };

  const handleVote = async (pollId: string, optionId: string, pollType: string) => {
    if (!user) return;
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;
    if (poll.deadline && isExpired(poll.deadline)) { toast.error("投票期限切れです"); return; }

    const newOptions = poll.options.map((opt) => {
      if (pollType === "single") {
        const votes = opt.votes.filter((v) => v !== user.uid);
        if (opt.id === optionId) votes.push(user.uid);
        return { ...opt, votes };
      } else {
        const votes = [...opt.votes];
        if (opt.id === optionId) {
          const idx = votes.indexOf(user.uid);
          if (idx >= 0) votes.splice(idx, 1); else votes.push(user.uid);
        }
        return { ...opt, votes };
      }
    });
    await updateDoc(doc(db, "polls", pollId), { options: newOptions, updatedAt: serverTimestamp() });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">投票</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm"><Plus className="h-4 w-4" /> 新規作成</button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">新規投票</h2><button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
          <div className="space-y-3">
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="投票タイトル" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
            <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="説明（任意）" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
            <select value={form.pollType} onChange={(e) => setForm({...form, pollType: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
              {POLL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {form.options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={o} onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm({...form, options: opts}); }}
                  placeholder={`選択肢 ${i + 1}`} className="flex-1 bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
                {form.options.length > 2 && <button onClick={() => setForm({...form, options: form.options.filter((_, j) => j !== i)})} className="text-destructive"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            <button onClick={() => setForm({...form, options: [...form.options, ""]})} className="text-sm text-primary">+ 選択肢を追加</button>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({...form, isAnonymous: e.target.checked})} />匿名投票</label>
              <div><label className="text-xs text-muted-foreground">締切</label><input type="datetime-local" value={form.deadline} onChange={(e) => setForm({...form, deadline: e.target.value})} className="bg-secondary text-foreground px-3 py-1 rounded-lg outline-none text-sm ml-2" /></div>
            </div>
            <button onClick={handleCreate} disabled={saving || !form.title.trim() || form.options.filter(Boolean).length < 2} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">{saving ? "作成中..." : "作成"}</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {polls.map((poll) => {
          const totalVotes = new Set(poll.options.flatMap((o) => o.votes)).size;
          const expired = poll.deadline && isExpired(poll.deadline);
          return (
            <div key={poll.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{poll.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {poll.isAnonymous && <span className="bg-secondary px-2 py-0.5 rounded">匿名</span>}
                  {expired && <span className="text-destructive flex items-center gap-1"><Clock className="h-3 w-3" />終了</span>}
                  {poll.deadline && !expired && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatJST(poll.deadline)}</span>}
                </div>
              </div>
              {poll.description && <p className="text-sm text-muted-foreground mb-3">{poll.description}</p>}
              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                  const voted = user ? opt.votes.includes(user.uid) : false;
                  return (
                    <button key={opt.id} onClick={() => !expired && handleVote(poll.id, opt.id, poll.pollType)}
                      disabled={!!expired} className={cn("w-full text-left relative overflow-hidden rounded-lg border p-3 transition-colors", voted ? "border-primary" : "border-border hover:border-primary/50")}>
                      <div className="absolute inset-0 bg-primary/10" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between">
                        <span className="text-sm">{opt.text}</span>
                        <span className="text-sm text-muted-foreground">{opt.votes.length}票 ({pct}%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{totalVotes}人が投票 · {poll.createdByName}</p>
            </div>
          );
        })}
        {polls.length === 0 && <div className="text-center py-12 text-muted-foreground"><BarChart3 className="h-8 w-8 mx-auto mb-2" /><p>投票はありません</p></div>}
      </div>
    </div>
  );
}
