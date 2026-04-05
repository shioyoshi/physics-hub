"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, arrayUnion, arrayRemove, getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { uploadMessageImage } from "@/lib/firebase/storage";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useDraft } from "@/hooks/useDraft";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
import { formatJST } from "@/lib/date";
import { extractMentions, cn } from "@/lib/utils";
import type { Message } from "@/types/message";
import type { Channel } from "@/types/channel";
import { Hash, Send, Pin, MessageSquareText, Pencil, Trash2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { summarizeText } from "@/lib/gemini";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const { user } = useAuthStore();
  const { openThread } = useUIStore();
  const { content, setContent, clearDraft } = useDraft(channelId);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<{uid:string;displayName:string}[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!channelId) return;
    const unsub = onSnapshot(doc(db, "channels", channelId), (snap) => {
      if (snap.exists()) setChannel({ id: snap.id, ...snap.data() } as Channel);
    });
    return () => unsub();
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const q = query(
      collection(db, "messages"),
      where("channelId", "==", channelId),
      where("parentMessageId", "==", null),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          scheduledAt: data.scheduledAt?.toDate?.() || null,
        } as Message;
      }).filter((m) => m.isPublished !== false);
      setMessages(msgs);
    });
    return () => unsub();
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if ((!content.trim() && !imageFile) || !user || !channelId) return;
    if (user.is_muted) { toast.error("発言禁止中です。"); return; }
    setSending(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadMessageImage(imageFile, channelId);
      }
      const mentions = extractMentions(content);
      await addDoc(collection(db, "messages"), {
        channelId,
        content: content.trim(),
        authorId: user.uid,
        authorName: user.displayName,
        imageUrl,
        mentions,
        reactions: {},
        threadId: null,
        parentMessageId: null,
        replyCount: 0,
        isEdited: false,
        isPinned: false,
        scheduledAt: null,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // メンション通知
      if (mentions.length > 0) {
        const usersSnap = await import("firebase/firestore").then(m =>
          m.getDocs(query(collection(db, "users"), where("is_approved", "==", true)))
        );
        for (const u of usersSnap.docs) {
          const ud = u.data();
          if (mentions.includes(ud.displayName) && ud.uid !== user.uid) {
            await addDoc(collection(db, "notifications"), {
              userId: ud.uid,
              type: "mention_channel",
              title: `${user.displayName} があなたをメンションしました`,
              body: content.substring(0, 100),
              link: `/channels/${channelId}`,
              isRead: false,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      await updateDoc(doc(db, "channels", channelId), { lastMessageAt: serverTimestamp() });
      await clearDraft();
      setContent("");
      setImageFile(null);
      setImagePreview("");
    } catch (e) {
      console.error(e);
      toast.error("送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msgRef = doc(db, "messages", messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = msgSnap.data().reactions || {};
    const users = reactions[emoji] || [];
    if (users.includes(user.uid)) {
      const updated = users.filter((u: string) => u !== user.uid);
      if (updated.length === 0) {
        const { [emoji]: _, ...rest } = reactions;
        await updateDoc(msgRef, { reactions: rest });
      } else {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: updated });
      }
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "messages", messageId), {
      content: editContent.trim(),
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
    setEditingId(null);
    setEditContent("");
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("このメッセージを削除しますか？")) return;
    await deleteDoc(doc(db, "messages", messageId));
  };

  const handlePin = async (messageId: string, isPinned: boolean) => {
    await updateDoc(doc(db, "messages", messageId), { isPinned: !isPinned });
  };

  const handleSummarize = async () => {
    if (messages.length === 0) return;
    setSummarizing(true);
    try {
      const text = messages.map((m) => `${m.authorName}: ${m.content}`).join("\n");
      const summary = await summarizeText(text, 500);
      setAiSummary(summary);
    } catch { toast.error("要約に失敗しました。"); } finally { setSummarizing(false); }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = value.substring(lastAt + 1);
      if (afterAt && !afterAt.includes(" ")) {
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{channel?.name || "..."}</h3>
          {channel?.description && (
            <span className="text-sm text-muted-foreground hidden md:inline">— {channel.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pinnedMessages.length > 0 && (
            <button onClick={() => setShowPinned(!showPinned)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Pin className="h-4 w-4" /> {pinnedMessages.length}
            </button>
          )}
          <button onClick={handleSummarize} disabled={summarizing} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <Sparkles className="h-4 w-4" /> {summarizing ? "要約中..." : "AI要約"}
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mx-4 mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-primary flex items-center gap-1"><Sparkles className="h-3 w-3" />AI要約</span>
            <button onClick={() => setAiSummary(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
          </div>
          <p className="text-sm">{aiSummary}</p>
        </div>
      )}

      {/* Pinned */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="mx-4 mt-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-500 flex items-center gap-1"><Pin className="h-3 w-3" />ピン留めメッセージ</span>
            <button onClick={() => setShowPinned(false)}><X className="h-3 w-3 text-muted-foreground" /></button>
          </div>
          {pinnedMessages.map((m) => (
            <div key={m.id} className="text-sm mb-1"><span className="font-medium">{m.authorName}:</span> {m.content.substring(0, 100)}</div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="group flex gap-3 hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors">
            <UserAvatar name={msg.authorName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{msg.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatJST(msg.createdAt)}</span>
                {msg.isEdited && <span className="text-xs text-muted-foreground">(編集済み)</span>}
                {msg.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
              </div>

              {editingId === msg.id ? (
                <div className="mt-1">
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-secondary text-foreground p-2 rounded-lg text-sm outline-none resize-none" rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(msg.id); } if (e.key === "Escape") setEditingId(null); }} />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleEdit(msg.id)} className="text-xs text-primary">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm mt-0.5">
                  <MarkdownRenderer content={msg.content} />
                </div>
              )}

              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="attached" className="mt-2 max-h-64 rounded-lg border border-border" />
              )}

              {/* Reactions */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(msg.reactions).map(([emoji, users]) => (
                    <button key={emoji} onClick={() => handleReaction(msg.id, emoji)}
                      className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                        (users as string[]).includes(user?.uid || "") ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                      <span>{emoji}</span>
                      <span className="text-muted-foreground">{(users as string[]).length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <EmojiPicker onSelect={(emoji) => handleReaction(msg.id, emoji)} />
                <button onClick={() => openThread(msg.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="スレッド">
                  <MessageSquareText className="h-3.5 w-3.5" />
                </button>
                {msg.replyCount > 0 && (
                  <button onClick={() => openThread(msg.id)} className="text-xs text-primary hover:underline">{msg.replyCount}件の返信</button>
                )}
                {(user?.uid === msg.authorId || user?.role === "admin") && (
                  <>
                    <button onClick={() => handlePin(msg.id, msg.isPinned)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="ピン">
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    {user?.uid === msg.authorId && (
                      <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="編集">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(msg.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive" title="削除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <ImageUpload
          onFileSelect={(f) => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }}
          onClear={() => { setImageFile(null); setImagePreview(""); }}
          previewUrl={imagePreview}
          className="mb-2"
        />
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={user?.is_muted ? "発言禁止中です" : `#${channel?.name || ""} にメッセージを送信`}
            disabled={user?.is_muted}
            className="flex-1 bg-secondary text-foreground px-4 py-2.5 rounded-lg text-sm outline-none resize-none min-h-[40px] max-h-32 disabled:opacity-50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <button onClick={handleSend} disabled={sending || (!content.trim() && !imageFile) || user?.is_muted}
            className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 shrink-0">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
