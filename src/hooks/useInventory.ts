"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { InventoryItem, InventoryLog, InventoryCategory } from "@/types/inventory";

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => {
        const raw = d.data();
        return { id: d.id, ...raw, createdAt: raw.createdAt?.toDate?.() || new Date(), updatedAt: raw.updatedAt?.toDate?.() || new Date(), lastCheckedAt: raw.lastCheckedAt?.toDate?.() || null } as InventoryItem;
      }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredItems = items.filter((item) => {
    const mc = categoryFilter === "all" || item.category === categoryFilter;
    const ms = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.description.toLowerCase().includes(searchTerm.toLowerCase()) || item.location.toLowerCase().includes(searchTerm.toLowerCase()) || item.barcode === searchTerm || item.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return mc && ms;
  });

  const addItem = useCallback(async (data: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">) => {
    await addDoc(collection(db, "inventory"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }, []);

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>) => {
    await updateDoc(doc(db, "inventory", id), { ...data, updatedAt: serverTimestamp() });
  }, []);

  const deleteItem = useCallback(async (id: string) => { await deleteDoc(doc(db, "inventory", id)); }, []);

  const addLog = useCallback(async (log: Omit<InventoryLog, "id" | "createdAt">) => {
    await addDoc(collection(db, "inventoryLogs"), { ...log, createdAt: serverTimestamp() });
  }, []);

  return { items: filteredItems, allItems: items, loading, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm, addItem, updateItem, deleteItem, addLog };
}
