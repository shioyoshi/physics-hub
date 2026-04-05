"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { formatJST } from "@/lib/date";
import type { DMMessage, DMConversation } from "@/types/message";
import { ArrowLeft, Send } from "lucide-react";

export default function DMConversationPage() {
  const params = useParams();
  const convId = params.conversationId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const [conv, setConv] = useState<DMConversation | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!convId) return;
    const unsub = onSnapshot(doc(db, "dmConversations", convId), (snap) => {
      if (snap.exists()) setConv({ id: snap.id, ...snap.data() } as DMConversation);
    });
    return () => unsub();
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    const q = query(collection(db, "dmMessages"), where("conversationId", "==", convId), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() } as DMMessage;
      }));
    });
    return () => unsub();
  }, [convId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!user || !messages.length) return;
    messages.filter((m) => m.senderId !== user.uid && !m.isRead).forEach((m) => {
      updateDoc(doc(db, "dmMessages", m.id), { isRead: true });
    });
  }, [messages, user]);

  const handleSend = async () => {
    if (!content.trim() || !user || !convId) return;
    setSending(true);
    try {
      await addDoc(collection(db, "dmMessages"), {
        conversationId: convId, senderId: user.uid, senderName: user.displayName,
        content: content.trim(), imageUrl: null, isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "dmConversations", convId), { lastMessage: content.trim().substring(0, 100), lastMessageAt: serverTimestamp() });
      setContent("");
    } catch {} finally { setSending(false); }
  };

  const otherName = conv ? Object.entries(conv.participantNames || {}).find(([k]) => k !== user?.uid)?.[1] || "不明" : "...";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <button onClick={() => router.push("/dm")} className="p-1 rounded hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <UserAvatar name={otherName} size="sm" />
        <span className="font-semibold">{otherName}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.senderId === user?.uid ? "flex-row-reverse" : ""}`}>
            <UserAvatar name={msg.senderName} size="sm" />
            <div className={`max-w-[70%] ${msg.senderId === user?.uid ? "text-right" : ""}`}>
              <div className={`inline-block px-3 py-2 rounded-lg text-sm ${msg.senderId === user?.uid ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                <MarkdownRenderer content={msg.content} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatJST(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="メッセージを入力..."
            className="flex-1 bg-secondary text-foreground px-4 py-2.5 rounded-lg text-sm outline-none resize-none" rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button onClick={handleSend} disabled={sending || !content.trim()} className="bg-primary text-primary-foreground p-2.5 rounded-lg disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
