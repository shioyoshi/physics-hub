"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import type { Notification } from "@/types/notification";

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() } as Notification;
      });
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.isRead).length);
    });
    return () => unsub();
  }, [user?.uid]);

  const markAsRead = async (id: string) => { await updateDoc(doc(db, "notifications", id), { isRead: true }); };
  const markAllAsRead = async () => {
    await Promise.all(notifications.filter((n) => !n.isRead).map((n) => updateDoc(doc(db, "notifications", n.id), { isRead: true })));
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
