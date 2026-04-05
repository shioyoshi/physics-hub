#!/bin/bash
# ============================================================
# PhysicsHub 続き - setup2.sh
# physics-hub フォルダ内で実行すること
# ============================================================

set -e
echo "🔬 PhysicsHub 残りファイル生成開始..."

# ============================================================
# Channel Detail Page (チャンネルメッセージ)
# ============================================================
cat > "src/app/(main)/channels/[channelId]/page.tsx" << 'CHANNELDETAIL_EOF'
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
CHANNELDETAIL_EOF
echo "✅ Channel detail page"

# ============================================================
# Thread Page
# ============================================================
cat > "src/app/(main)/channels/[channelId]/thread/[messageId]/page.tsx" << 'THREADPAGE_EOF'
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
THREADPAGE_EOF
echo "✅ Thread page"

# ============================================================
# Wiki Pages
# ============================================================
cat > "src/app/(main)/wiki/page.tsx" << 'WIKI_EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatRelative } from "@/lib/date";
import type { WikiPage } from "@/types/wiki";
import { BookOpen, Plus, Pin, Tag, Search, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WikiListPage() {
  const router = useRouter();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "wikiPages"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPages(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date(), updatedAt: data.updatedAt?.toDate?.() || new Date() } as WikiPage;
      }));
    });
    return () => unsub();
  }, []);

  const allTags = [...new Set(pages.flatMap((p) => p.tags || []))];
  const filtered = pages.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
    const matchTag = !tagFilter || (p.tags || []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  const pinned = filtered.filter((p) => p.isPinned);
  const others = filtered.filter((p) => !p.isPinned);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wiki</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/wiki/map")} className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Map className="h-4 w-4" /> マップ
          </button>
          <button onClick={() => router.push("/wiki/new")} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 新規作成
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ページを検索..."
            className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTagFilter(null)} className={cn("px-2 py-1 rounded text-xs", !tagFilter ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>すべて</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)} className={cn("px-2 py-1 rounded text-xs", tagFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Pin className="h-3 w-3" />ピン留め</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pinned.map((p) => (
              <button key={p.id} onClick={() => router.push(`/wiki/${p.id}`)} className="text-left bg-card border border-yellow-500/20 rounded-lg p-4 hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.content.substring(0, 120)}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{p.authorName}</span><span>·</span><span>{formatRelative(p.updatedAt)}</span>
                  {(p.tags || []).map((t) => <span key={t} className="bg-secondary px-1.5 py-0.5 rounded">{t}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {others.map((p) => (
          <button key={p.id} onClick={() => router.push(`/wiki/${p.id}`)} className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
            <h3 className="font-semibold mb-1">{p.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{p.content.substring(0, 120)}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{p.authorName}</span><span>·</span><span>{formatRelative(p.updatedAt)}</span>
              {(p.tags || []).map((t) => <span key={t} className="bg-secondary px-1.5 py-0.5 rounded">{t}</span>)}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-8 w-8 mx-auto mb-2" /><p>ページが見つかりません</p></div>
      )}
    </div>
  );
}
WIKI_EOF

cat > "src/app/(main)/wiki/new/page.tsx" << 'WIKINEW_EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { toast } from "sonner";
import { Save, Eye, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WikiNewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "wikiPages"), {
        title: title.trim(),
        content: content.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        isPinned: false,
        authorId: user.uid,
        authorName: user.displayName,
        currentEditors: [],
        backlinks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Revision保存
      await addDoc(collection(db, "wikiRevisions"), {
        pageId: docRef.id,
        content: content.trim(),
        editedBy: user.uid,
        editedByName: user.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success("ページを作成しました");
      router.push(`/wiki/${docRef.id}`);
    } catch { toast.error("作成に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">新規Wikiページ</h1>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm">
            {preview ? <><Edit className="h-4 w-4" />編集</> : <><Eye className="h-4 w-4" />プレビュー</>}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ページタイトル"
        className="w-full bg-secondary text-foreground text-xl font-semibold px-4 py-3 rounded-lg mb-4 outline-none" />
      <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="タグ（カンマ区切り: 力学, 電磁気学, 実験）"
        className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg mb-4 outline-none text-sm" />

      {preview ? (
        <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none min-h-[400px]">
          <MarkdownRenderer content={content} />
        </div>
      ) : (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Markdownで記述できます。[[ページ名]] でWiki内リンクを作成できます。"
          className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg outline-none resize-none font-mono text-sm min-h-[400px]" />
      )}
    </div>
  );
}
WIKINEW_EOF

cat > "src/app/(main)/wiki/[pageId]/page.tsx" << 'WIKIVIEW_EOF'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { formatJST } from "@/lib/date";
import type { WikiPage } from "@/types/wiki";
import { Pencil, Pin, History, ArrowLeft, Sparkles, Link2 } from "lucide-react";
import { toast } from "sonner";
import { summarizeText } from "@/lib/gemini";

export default function WikiViewPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const { user } = useAuthStore();

  const [page, setPage] = useState<WikiPage | null>(null);
  const [backlinks, setBacklinks] = useState<{id:string;title:string}[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    const unsub = onSnapshot(doc(db, "wikiPages", pageId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPage({ id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || new Date(), updatedAt: d.updatedAt?.toDate?.() || new Date() } as WikiPage);
      }
    });
    return () => unsub();
  }, [pageId]);

  // Backlinks
  useEffect(() => {
    if (!page?.title) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "wikiPages")));
      const links = snap.docs.filter((d) => {
        const c = d.data().content || "";
        return c.includes(`[[${page.title}]]`) && d.id !== pageId;
      }).map((d) => ({ id: d.id, title: d.data().title }));
      setBacklinks(links);
    })();
  }, [page?.title, pageId]);

  const handlePin = async () => {
    if (!page || !user) return;
    await updateDoc(doc(db, "wikiPages", pageId), { isPinned: !page.isPinned, updatedAt: serverTimestamp() });
    toast.success(page.isPinned ? "ピン留め解除" : "ピン留めしました");
  };

  const handleSummarize = async () => {
    if (!page) return;
    setSummarizing(true);
    try {
      const s = await summarizeText(page.content);
      setSummary(s);
    } catch { toast.error("要約失敗"); } finally { setSummarizing(false); }
  };

  if (!page) return <div className="p-6 text-muted-foreground">読み込み中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/wiki")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Wiki一覧に戻る
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">{page.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{page.authorName}</span>
            <span>更新: {formatJST(page.updatedAt)}</span>
            {(page.tags || []).map((t) => <span key={t} className="bg-secondary px-2 py-0.5 rounded text-xs">{t}</span>)}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleSummarize} disabled={summarizing} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Sparkles className="h-4 w-4" /> {summarizing ? "..." : "AI要約"}
          </button>
          <button onClick={handlePin} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Pin className="h-4 w-4" /> {page.isPinned ? "解除" : "ピン"}
          </button>
          <button onClick={() => router.push(`/wiki/${pageId}/history`)} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <History className="h-4 w-4" /> 履歴
          </button>
          <button onClick={() => router.push(`/wiki/${pageId}/edit`)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
            <Pencil className="h-4 w-4" /> 編集
          </button>
        </div>
      </div>

      {summary && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h3 className="text-sm font-medium text-primary mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />AI要約</h3>
          <p className="text-sm">{summary}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none mb-6">
        <MarkdownRenderer content={page.content} />
      </div>

      {backlinks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Link2 className="h-4 w-4" />バックリンク</h3>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((bl) => (
              <button key={bl.id} onClick={() => router.push(`/wiki/${bl.id}`)} className="text-sm text-primary hover:underline">{bl.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
WIKIVIEW_EOF

cat > "src/app/(main)/wiki/[pageId]/edit/page.tsx" << 'WIKIEDIT_EOF'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { toast } from "sonner";
import { Save, Eye, Edit, ArrowLeft } from "lucide-react";

export default function WikiEditPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      const snap = await getDoc(doc(db, "wikiPages", pageId));
      if (snap.exists()) {
        const d = snap.data();
        setTitle(d.title); setContent(d.content); setTags((d.tags || []).join(", "));
      }
    })();
  }, [pageId]);

  useEffect(() => {
    if (!pageId || !user) return;
    updateDoc(doc(db, "wikiPages", pageId), { currentEditors: arrayUnion(user.uid) });
    return () => { updateDoc(doc(db, "wikiPages", pageId), { currentEditors: arrayRemove(user.uid) }); };
  }, [pageId, user]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "wikiPages", pageId), {
        title: title.trim(), content: content.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "wikiRevisions"), {
        pageId, content: content.trim(), editedBy: user.uid, editedByName: user.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success("保存しました"); router.push(`/wiki/${pageId}`);
    } catch { toast.error("保存に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push(`/wiki/${pageId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-sm">
            {preview ? <><Edit className="h-4 w-4" />編集</> : <><Eye className="h-4 w-4" />プレビュー</>}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-secondary text-foreground text-xl font-semibold px-4 py-3 rounded-lg mb-4 outline-none" />
      <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="タグ（カンマ区切り）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg mb-4 outline-none text-sm" />
      {preview ? (
        <div className="bg-card border border-border rounded-lg p-6 prose prose-invert max-w-none min-h-[400px]"><MarkdownRenderer content={content} /></div>
      ) : (
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-secondary text-foreground px-4 py-3 rounded-lg outline-none resize-none font-mono text-sm min-h-[400px]" />
      )}
    </div>
  );
}
WIKIEDIT_EOF

cat > "src/app/(main)/wiki/[pageId]/history/page.tsx" << 'WIKIHISTORY_EOF'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatJST } from "@/lib/date";
import type { WikiRevision } from "@/types/wiki";
import { ArrowLeft, Clock } from "lucide-react";

export default function WikiHistoryPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const router = useRouter();
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "wikiRevisions"), where("pageId", "==", pageId), orderBy("createdAt", "desc")));
      setRevisions(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as WikiRevision)));
    })();
  }, [pageId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push(`/wiki/${pageId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 戻る</button>
      <h1 className="text-2xl font-bold mb-6">編集履歴</h1>
      <div className="space-y-3">
        {revisions.map((r, i) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{r.editedByName}</span>
              <span className="text-xs text-muted-foreground">{formatJST(r.createdAt)}</span>
              {i === 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">最新</span>}
            </div>
            <pre className="text-xs text-muted-foreground bg-secondary rounded p-3 max-h-32 overflow-auto whitespace-pre-wrap">{r.content.substring(0, 500)}{r.content.length > 500 ? "..." : ""}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
WIKIHISTORY_EOF

cat > "src/app/(main)/wiki/map/page.tsx" << 'WIKIMAP_EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { generateWikiMap } from "@/lib/gemini";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function WikiMapPage() {
  const router = useRouter();
  const [mapData, setMapData] = useState<{nodes:{id:string;group:string}[];links:{source:string;target:string;relation:string}[]} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "wikiPages"));
      const pages = snap.docs.map((d) => {
        const data = d.data();
        return { title: data.title, content: data.content || "", tags: data.tags || [] };
      });
      const result = await generateWikiMap(pages);
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setMapData(JSON.parse(cleaned));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push("/wiki")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Wiki一覧</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wiki マップ</h1>
        <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> {loading ? "生成中..." : "AIでマップ生成"}
        </button>
      </div>
      {mapData ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-4">ページ関連図</h3>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">ノード ({mapData.nodes.length})</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {mapData.nodes.map((n) => (
                <span key={n.id} className="bg-secondary px-3 py-1 rounded-full text-sm">{n.id} <span className="text-xs text-muted-foreground">({n.group})</span></span>
              ))}
            </div>
            <h4 className="text-sm font-medium text-muted-foreground">リンク ({mapData.links.length})</h4>
            <div className="space-y-1">
              {mapData.links.map((l, i) => (
                <div key={i} className="text-sm text-muted-foreground">{l.source} → {l.target} <span className="text-xs">({l.relation})</span></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground"><p>「AIでマップ生成」をクリックすると、Wikiページの関連図を生成します</p></div>
      )}
    </div>
  );
}
WIKIMAP_EOF
echo "✅ Wiki pages"

# ============================================================
# Events
# ============================================================
cat > "src/app/(main)/events/page.tsx" << 'EVENTS_EOF'
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
EVENTS_EOF
echo "✅ Events page"

# ============================================================
# Polls
# ============================================================
cat > "src/app/(main)/polls/page.tsx" << 'POLLS_EOF'
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
POLLS_EOF
echo "✅ Polls page"

# ============================================================
# Inventory (物品管理)
# ============================================================
cat > "src/app/(main)/inventory/page.tsx" << 'INV_EOF'
"use client";
import { useRouter } from "next/navigation";
import { useInventory } from "@/hooks/useInventory";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { formatRelative } from "@/lib/date";
import { Package, Plus, Search, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const router = useRouter();
  const { items, loading, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm } = useInventory();

  const conditionColors: Record<string, string> = { excellent: "text-green-400", good: "text-blue-400", fair: "text-yellow-400", poor: "text-orange-400", broken: "text-red-400" };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">物品管理</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/inventory/scan")} className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm">
            <QrCode className="h-4 w-4" /> スキャン
          </button>
          <button onClick={() => router.push("/inventory/new")} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> 新規登録
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="名前、場所、バーコード、タグで検索..."
            className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="bg-secondary text-foreground px-3 py-2 rounded-lg text-sm outline-none">
          <option value="all">すべてのカテゴリ</option>
          {INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-muted-foreground">読み込み中...</p> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const catLabel = INVENTORY_CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
            const condLabel = ITEM_CONDITIONS.find((c) => c.value === item.condition)?.label || item.condition;
            return (
              <button key={item.id} onClick={() => router.push(`/inventory/${item.id}`)} className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-12 w-12 rounded object-cover ml-2 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="bg-secondary px-1.5 py-0.5 rounded">{catLabel}</span>
                  <span className={conditionColors[item.condition] || ""}>{condLabel}</span>
                  <span>数量: {item.quantity}</span>
                  <span>{item.location}</span>
                </div>
                {item.barcode && <p className="text-[10px] text-muted-foreground mt-1 font-mono">BC: {item.barcode}</p>}
              </button>
            );
          })}
        </div>
      )}
      {!loading && items.length === 0 && <div className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2" /><p>物品が見つかりません</p></div>}
    </div>
  );
}
INV_EOF

cat > "src/app/(main)/inventory/new/page.tsx" << 'INVNEW_EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useInventory } from "@/hooks/useInventory";
import { uploadInventoryImage } from "@/lib/firebase/storage";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export default function InventoryNewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addItem, addLog } = useInventory();
  const [form, setForm] = useState({ name: "", description: "", category: "equipment" as const, quantity: 1, location: "", condition: "good" as const, barcode: "", tags: "", notes: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadInventoryImage(imageFile, Date.now().toString());

      await addItem({
        name: form.name.trim(), description: form.description.trim(), category: form.category,
        quantity: form.quantity, location: form.location.trim(), condition: form.condition,
        barcode: form.barcode.trim() || null, imageUrl,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes.trim(), lastCheckedBy: user.uid, lastCheckedAt: new Date(),
        registeredBy: user.uid, registeredByName: user.displayName,
      });
      toast.success("物品を登録しました");
      router.push("/inventory");
    } catch { toast.error("登録に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>
      <h1 className="text-2xl font-bold mb-6">物品登録</h1>
      <div className="space-y-4">
        <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="物品名 *" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
        <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="説明" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
            {INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={form.condition} onChange={(e) => setForm({...form, condition: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
            {ITEM_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">数量</label><input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} min={0} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" /></div>
          <input type="text" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} placeholder="保管場所" className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none mt-auto" />
        </div>
        <input type="text" value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})} placeholder="バーコード（任意）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none font-mono" />
        <input type="text" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="タグ（カンマ区切り）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
        <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="備考" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
        <ImageUpload onFileSelect={(f) => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} onClear={() => { setImageFile(null); setImagePreview(""); }} previewUrl={imagePreview} />
        <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "登録中..." : "登録"}</button>
      </div>
    </div>
  );
}
INVNEW_EOF

cat > "src/app/(main)/inventory/scan/page.tsx" << 'INVSCAN_EOF'
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ArrowLeft, Camera, Search } from "lucide-react";
import { toast } from "sonner";

export default function InventoryScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const searchByBarcode = async (code: string) => {
    const snap = await getDocs(query(collection(db, "inventory"), where("barcode", "==", code)));
    if (!snap.empty) {
      router.push(`/inventory/${snap.docs[0].id}`);
    } else {
      toast.error(`バーコード「${code}」に一致する物品が見つかりません`);
    }
  };

  const startScan = async () => {
    setScanning(true);
    try {
      const Quagga = (await import("@ericblade/quagga2")).default;
      if (!videoRef.current) return;
      Quagga.init({
        inputStream: { type: "LiveStream", target: videoRef.current, constraints: { facingMode: "environment" } },
        decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader"] },
      }, (err: any) => {
        if (err) { console.error(err); toast.error("カメラを起動できませんでした"); setScanning(false); return; }
        Quagga.start();
      });
      Quagga.onDetected((data: any) => {
        const code = data.codeResult.code;
        setResult(code);
        Quagga.stop();
        setScanning(false);
        searchByBarcode(code);
      });
    } catch (e) { console.error(e); toast.error("バーコードスキャナーの初期化に失敗しました"); setScanning(false); }
  };

  useEffect(() => {
    return () => {
      import("@ericblade/quagga2").then((m) => { try { m.default.stop(); } catch {} });
    };
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>
      <h1 className="text-2xl font-bold mb-6">バーコードスキャン</h1>

      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Camera className="h-5 w-5" />カメラスキャン</h2>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-3">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {!scanning && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-muted-foreground">カメラ待機中</div>}
          </div>
          <button onClick={startScan} disabled={scanning} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {scanning ? "スキャン中..." : "スキャン開始"}
          </button>
          {result && <p className="mt-2 text-sm">検出: <span className="font-mono text-primary">{result}</span></p>}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="h-5 w-5" />手動入力</h2>
          <div className="flex gap-2">
            <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="バーコード番号を入力"
              className="flex-1 bg-secondary text-foreground px-4 py-2 rounded-lg outline-none font-mono"
              onKeyDown={(e) => { if (e.key === "Enter" && manualCode.trim()) searchByBarcode(manualCode.trim()); }} />
            <button onClick={() => manualCode.trim() && searchByBarcode(manualCode.trim())} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm">検索</button>
          </div>
        </div>
      </div>
    </div>
  );
}
INVSCAN_EOF

cat > "src/app/(main)/inventory/[itemId]/page.tsx" << 'INVDETAIL_EOF'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { formatJST } from "@/lib/date";
import type { InventoryItem, InventoryLog } from "@/types/inventory";
import { ArrowLeft, Pencil, Save, X, History } from "lucide-react";
import { toast } from "sonner";

export default function InventoryDetailPage() {
  const params = useParams();
  const itemId = params.itemId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InventoryItem>>({});

  useEffect(() => {
    if (!itemId) return;
    const unsub = onSnapshot(doc(db, "inventory", itemId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const item = { id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || new Date(), updatedAt: d.updatedAt?.toDate?.() || new Date(), lastCheckedAt: d.lastCheckedAt?.toDate?.() || null } as InventoryItem;
        setItem(item);
        setForm(item);
      }
    });
    return () => unsub();
  }, [itemId]);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "inventoryLogs"), where("itemId", "==", itemId), orderBy("createdAt", "desc")));
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as InventoryLog)));
    })();
  }, [itemId]);

  const handleSave = async () => {
    if (!itemId || !form.name?.trim()) return;
    await updateDoc(doc(db, "inventory", itemId), { ...form, updatedAt: serverTimestamp() });
    toast.success("更新しました");
    setEditing(false);
  };

  if (!item) return <div className="p-6 text-muted-foreground">読み込み中...</div>;

  const catLabel = INVENTORY_CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
  const condLabel = ITEM_CONDITIONS.find((c) => c.value === item.condition)?.label || item.condition;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>

      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold">{editing ? <input type="text" value={form.name || ""} onChange={(e) => setForm({...form, name: e.target.value})} className="bg-secondary text-foreground px-3 py-1 rounded-lg outline-none text-2xl font-bold" /> : item.name}</h1>
          <div className="flex gap-2">
            {editing ? (
              <><button onClick={handleSave} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm"><Save className="h-4 w-4" />保存</button>
              <button onClick={() => { setEditing(false); setForm(item); }} className="text-muted-foreground"><X className="h-4 w-4" /></button></>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-lg text-sm"><Pencil className="h-4 w-4" />編集</button>
            )}
          </div>
        </div>

        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="max-h-48 rounded-lg mb-4" />}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">カテゴリ:</span> {editing ? <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value as any})} className="bg-secondary px-2 py-1 rounded ml-1">{INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : catLabel}</div>
          <div><span className="text-muted-foreground">状態:</span> {editing ? <select value={form.condition} onChange={(e) => setForm({...form, condition: e.target.value as any})} className="bg-secondary px-2 py-1 rounded ml-1">{ITEM_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : condLabel}</div>
          <div><span className="text-muted-foreground">数量:</span> {editing ? <input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} className="bg-secondary px-2 py-1 rounded ml-1 w-20" /> : item.quantity}</div>
          <div><span className="text-muted-foreground">場所:</span> {editing ? <input type="text" value={form.location || ""} onChange={(e) => setForm({...form, location: e.target.value})} className="bg-secondary px-2 py-1 rounded ml-1" /> : item.location}</div>
          {item.barcode && <div><span className="text-muted-foreground">バーコード:</span> <span className="font-mono">{item.barcode}</span></div>}
          <div><span className="text-muted-foreground">登録者:</span> {item.registeredByName}</div>
          <div><span className="text-muted-foreground">更新:</span> {formatJST(item.updatedAt)}</div>
        </div>

        {item.description && <div className="mt-4"><span className="text-muted-foreground text-sm">説明:</span><p className="text-sm mt-1">{item.description}</p></div>}
        {item.notes && <div className="mt-4"><span className="text-muted-foreground text-sm">備考:</span><p className="text-sm mt-1">{item.notes}</p></div>}
        {(item.tags || []).length > 0 && <div className="flex gap-1 mt-3">{item.tags.map((t) => <span key={t} className="bg-secondary text-xs px-2 py-0.5 rounded">{t}</span>)}</div>}
      </div>

      {logs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" />操作履歴</h2>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground text-xs whitespace-nowrap">{formatJST(l.createdAt)}</span>
                <span className="font-medium">{l.userName}</span>
                <span className="text-muted-foreground">{l.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
INVDETAIL_EOF
echo "✅ Inventory pages"

# ============================================================
# DM
# ============================================================
cat > "src/app/(main)/dm/page.tsx" << 'DM_EOF'
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
DM_EOF

cat > "src/app/(main)/dm/[conversationId]/page.tsx" << 'DMCONV_EOF'
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
DMCONV_EOF
echo "✅ DM pages"

# ============================================================
# Members
# ============================================================
cat > "src/app/(main)/members/page.tsx" << 'MEMBERS_EOF'
"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import type { User } from "@/types/user";
import { Users, Search } from "lucide-react";

export default function MembersPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), where("is_approved", "==", true), where("is_banned", "==", false));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date(), updatedAt: d.data().updatedAt?.toDate?.() || new Date() } as User)));
    });
    return () => unsub();
  }, []);

  const filtered = members.filter((m) => m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">メンバー ({members.length})</h1>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前・メールアドレスで検索"
          className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
      </div>
      <div className="space-y-1">
        {filtered.map((m) => (
          <div key={m.uid} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary transition-colors">
            <UserAvatar name={m.displayName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{m.displayName}</span>
                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">{m.role}</span>
                {(m.customRoles || []).map((r) => <RoleBadge key={r} roleId={r} />)}
              </div>
              <p className="text-xs text-muted-foreground truncate break-all">{m.email}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2" /><p>メンバーが見つかりません</p></div>}
      </div>
    </div>
  );
}
MEMBERS_EOF
echo "✅ Members page"

# ============================================================
# Notifications
# ============================================================
cat > "src/app/(main)/notifications/page.tsx" << 'NOTIFS_EOF'
"use client";
import { NotificationList } from "@/components/notification/NotificationList";

export default function NotificationsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NotificationList />
    </div>
  );
}
NOTIFS_EOF
echo "✅ Notifications page"

# ============================================================
# Admin Panel
# ============================================================
cat > "src/app/(main)/admin/page.tsx" << 'ADMIN_EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Users, Shield, Hash, KeyRound, CheckCircle } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <div className="p-6 text-destructive">アクセス権限がありません。</div>;

  const items = [
    { icon: Users, label: "ユーザー管理", desc: "ロール変更、BAN/ミュート", href: "/admin/users" },
    { icon: Shield, label: "ロール管理", desc: "カスタムロール作成・編集", href: "/admin/roles" },
    { icon: Hash, label: "チャンネル管理", desc: "アーカイブ・削除", href: "/admin/channels" },
    { icon: KeyRound, label: "招待コード", desc: "発行・使用状況確認", href: "/admin/invites" },
    { icon: CheckCircle, label: "承認リクエスト", desc: "承認待ちの処理", href: "/admin/approvals" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">管理者パネル</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, label, desc, href }) => (
          <button key={href} onClick={() => router.push(href)} className="text-left bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
            <Icon className="h-8