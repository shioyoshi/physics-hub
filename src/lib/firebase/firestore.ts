import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, onSnapshot,
  Timestamp, type QueryConstraint, type DocumentData, writeBatch,
} from "firebase/firestore";
import { db } from "./config";

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocument(
  collectionName: string, docId: string, data: Partial<DocumentData>
): Promise<void> {
  await updateDoc(doc(db, collectionName, docId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId));
}

export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...convertTimestamps(snap.data()) } as T;
}

export async function queryDocuments<T>(
  collectionName: string, ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...convertTimestamps(d.data()) }) as T);
}

export function subscribeToCollection<T>(
  collectionName: string, constraints: QueryConstraint[], callback: (data: T[]) => void
): () => void {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...convertTimestamps(d.data()) }) as T));
  });
}

export function subscribeToDocument<T>(
  collectionName: string, docId: string, callback: (data: T | null) => void
): () => void {
  return onSnapshot(doc(db, collectionName, docId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ id: snap.id, ...convertTimestamps(snap.data()) } as T);
  });
}

export function convertTimestamps(data: DocumentData): DocumentData {
  const converted: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

export { collection, doc, query, where, orderBy, limit, serverTimestamp, writeBatch, db, addDoc, getDocs, onSnapshot, updateDoc };
