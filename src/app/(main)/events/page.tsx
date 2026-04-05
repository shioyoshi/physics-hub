"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { formatJST } from "@/lib/date";
import { EVENT_TYPES, RSVP_OPTIONS } from "@/lib/constants";
import type { PhysicsEvent, RSVPStatus } from "@/types/event";
import { Calendar, Plus, MapPin, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<PhysicsEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", eventType: "meeting" as const, startDate: "", endDate: "", location: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("startDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, startDate: data.startDate?.toDate?.() || new Date(), endDate: data.endDate?.toDate?.() || null, createdAt: data.createdAt?.toDate?.() || new Date(), updatedAt: data.updatedAt?.toDate?.() || new Date() } as PhysicsEvent;
      }));
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startDate || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "events"), {
        title: form.title.trim(), description: form.description.trim(), eventType: form.eventType,
        startDate: new Date(form.startDate), endDate: form.endDate ? new Date(form.endDate) : null,
        location: form.location.trim(), rsvps: {},
        createdBy: user.uid, createdByName: user.displayName,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast.success("イベントを作成しました");
      setShowForm(false);
      setForm({ title: "", description: "", eventType: "meeting", startDate: "", endDate: "", location: "" });
    } catch { toast.error("作成に失敗しました"); } finally { setSaving(false); }
  };

  const handleRSVP = async (eventId: string, status: RSVPStatus) => {
    if (!user) return;
    const { updateDoc, doc } = await import("firebase/firestore");
    await updateDoc(doc(db, "events", eventId), { [`rsvps.${user.uid}`]: status });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">イベント</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> 新規作成
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">新規イベント</h2>
            <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-3">
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="イベント名" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
            <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="説明" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
            <select value={form.eventType} onChange={(e) => setForm({...form, eventType: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">開始日時</label><input type="datetime-local" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" /></div>
              <div><label className="text-xs text-muted-foreground">終了日時</label><input type="datetime-local" value={form.endDate} onChange={(e) => setForm({...form, endDate: e.target.value})} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" /></div>
            </div>
            <input type="text" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} placeholder="場所" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
            <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.startDate} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? "作成中..." : "作成"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {events.map((ev) => {
          const rsvpCounts = { going: 0, maybe: 0, not_going: 0 };
          Object.values(ev.rsvps || {}).forEach((s) => { if (rsvpCounts[s as RSVPStatus] !== undefined) rsvpCounts[s as RSVPStatus]++; });
          const myRsvp = user ? (ev.rsvps || {})[user.uid] : null;
          const typeLabel = EVENT_TYPES.find((t) => t.value === ev.eventType)?.label || ev.eventType;

          return (
            <div key={ev.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">{typeLabel}</span>
                    <h3 className="font-semibold">{ev.title}</h3>
                  </div>
                  {ev.description && <p className="text-sm text-muted-foreground mb-2">{ev.description}</p>}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatJST(ev.startDate)}</span>
                    {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{ev.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{rsvpCounts.going}人参加</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {RSVP_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => handleRSVP(ev.id, opt.value as RSVPStatus)}
                    className={cn("px-3 py-1.5 rounded-lg text-sm border transition-colors",
                      myRsvp === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>
                    {opt.label} ({rsvpCounts[opt.value as RSVPStatus]})
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {events.length === 0 && <div className="text-center py-12 text-muted-foreground"><Calendar className="h-8 w-8 mx-auto mb-2" /><p>イベントはありません</p></div>}
      </div>
    </div>
  );
}
