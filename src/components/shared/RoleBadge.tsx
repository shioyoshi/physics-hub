"use client";
import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { CustomRole } from "@/types/role";

let cachedRoles: CustomRole[] | null = null;

export function RoleBadge({ roleId }: { roleId: string }) {
  const [roles, setRoles] = useState<CustomRole[]>(cachedRoles || []);
  useEffect(() => {
    if (cachedRoles) return;
    const unsub = onSnapshot(query(collection(db, "customRoles")), (snap) => {
      const d = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CustomRole[];
      cachedRoles = d; setRoles(d);
    });
    return () => unsub();
  }, []);
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: role.color + "20", color: role.color, border: `1px solid ${role.color}40` }}>{role.name}</span>;
}
