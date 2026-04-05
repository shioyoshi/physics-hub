"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { useDebounce } from "./useDebounce";

export function useDraft(channelId: string) {
  const { user } = useAuthStore();
  const [content, setContent] = useState("");
  const debouncedContent = useDebounce(content, 1000);

  useEffect(() => {
    if (!user?.uid || !channelId) return;
    getDoc(doc(db, "drafts", `${user.uid}_${channelId}`)).then((snap) => {
      if (snap.exists()) setContent(snap.data().content || "");
    });
  }, [user?.uid, channelId]);

  useEffect(() => {
    if (!user?.uid || !channelId || debouncedContent === "") return;
    setDoc(doc(db, "drafts", `${user.uid}_${channelId}`), {
      channelId, userId: user.uid, content: debouncedContent, updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [debouncedContent, user?.uid, channelId]);

  const clearDraft = useCallback(async () => {
    if (!user?.uid || !channelId) return;
    await setDoc(doc(db, "drafts", `${user.uid}_${channelId}`), {
      channelId, userId: user.uid, content: "", updatedAt: serverTimestamp(),
    });
    setContent("");
  }, [user?.uid, channelId]);

  return { content, setContent, clearDraft };
}
