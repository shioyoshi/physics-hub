"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/user";

export function useAuth() {
  const { user, firebaseUser, loading, setUser, setFirebaseUser, setLoading } = useAuthStore();

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) { setUser(null); setLoading(false); return; }

      unsubUser = onSnapshot(doc(db, "users", fbUser.uid), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUser({
            uid: d.uid, email: d.email, displayName: d.displayName, photoURL: d.photoURL,
            role: d.role, customRoles: d.customRoles || [],
            is_approved: d.is_approved, is_banned: d.is_banned, is_muted: d.is_muted,
            approvalMethod: d.approvalMethod, inviteCodeUsed: d.inviteCodeUsed,
            approvalRequestNumber: d.approvalRequestNumber,
            createdAt: d.createdAt?.toDate?.() || new Date(),
            updatedAt: d.updatedAt?.toDate?.() || new Date(),
          } as User);
        } else { setUser(null); }
        setLoading(false);
      });
    });

    return () => { unsubAuth(); unsubUser?.(); };
  }, [setUser, setFirebaseUser, setLoading]);

  return { user, firebaseUser, loading };
}
