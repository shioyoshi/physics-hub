"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { formatJST } from "@/lib/date";
import { extractMentions } from "@/lib/utils";
import type { Message } from "@/types/message";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export default function ThreadPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const messageId = params.messageId as string;
  const router = useRouter();
  const { user } = useAuthStore();

  const [parentMsg, setParentMsg] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messageId) return;
    const unsub = onSnapshot(doc(db, "messages", messageId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setParentMsg({ id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || new Date(), updatedAt: d.updatedAt?.toDate?.() || new Date() } as Message);
      }
    });
    return () => unsub();
  }, [messageId]);

  useEffect(() => {
    if (!messageId) return;
    const q = query(collection(db, "messages"), where("parentMessageId", "==", messageId), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setReplies(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date(), updatedAt: data.updatedAt?.toDate?.() || new Date() } as Message;
      }));
    });
    return () => unsub();
  }, [messageId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [replies]);

  const handleSend = async () => {
    if (!content.trim() || !user || !messageId) return;
    if (user.is_muted) { toast.error("発言禁止中です。"); return; }
    setSending(true);
    try {
      await addDoc(collection(db, "messages"), {
        channelId, content: content.trim(), authorId: user.uid, authorName: user.displayName,
        imageUrl: null, mentions: extractMentions(content), reactions: {},
        threadId: messageId, parentMessageId: messageId, replyCount: 0,
        isEdited: false, isPinned: false, scheduledAt: null, isPublished: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "messages", messageId), { replyCount: increment(1) });
      setContent("");
    } catch { toast.error("送信に失敗しました。"); } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <button onClick={() => router.push(`/channels/${channelId}`)} className="p-1 rounded hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <h3 className="font-semibold">スレッド</h3>
        <span className="text-sm text-muted-foreground">{replies.length}件の返信</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {parentMsg && (
          <div className="flex gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <UserAvatar name={parentMsg.authorName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{parentMsg.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatJST(parentMsg.createdAt)}</span>
              </div>
              <MarkdownRenderer content={parentMsg.content} className="text-sm mt-0.5" />
              {parentMsg.imageUrl && <img src={parentMsg.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg" />}
            </div>
          </div>
        )}

        <div className="border-l-2 border-border ml-4 pl-4 space-y-3">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-3">
              <UserAvatar name={r.authorName} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.authorName}</span>
                  <span className="text-xs text-muted-foreground">{formatJST(r.createdAt)}</span>
                </div>
                <MarkdownRenderer content={r.content} className="text-sm mt-0.5" />
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="返信を入力..." className="flex-1 bg-secondary text-foreground px-4 py-2.5 rounded-lg text-sm outline-none resize-none" rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button onClick={handleSend} disabled={sending || !content.trim()} className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
