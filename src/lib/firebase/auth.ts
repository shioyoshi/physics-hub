import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./config";
import type { User } from "@/types/user";

const ALLOWED_DOMAINS = ["stu.kaijo.ed.jp", "gfe.kaijo.ed.jp"];

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
}

// 🔥 redirect後に呼ばれる
export async function handleRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;

    const firebaseUser = result.user;

    console.log("Firebase User:", firebaseUser);

    const email = firebaseUser.email ?? "";
    if (!email) throw new Error("メールアドレス取得失敗");

    const domain = email.split("@")[1] ?? "";

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const isAutoApproved = ALLOWED_DOMAINS.includes(domain);

      const newUser = {
        uid: firebaseUser.uid,
        email,
        displayName:
          firebaseUser.displayName ?? email.split("@")[0],
        photoURL: firebaseUser.photoURL ?? null,
        role: "user" as const,
        customRoles: [] as string[],
        is_approved: isAutoApproved,
        is_banned: false,
        is_muted: false,
        approvalMethod: isAutoApproved ? ("domain" as const) : null,
        inviteCodeUsed: null,
        approvalRequestNumber: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userDocRef, newUser);

      return {
        ...newUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
    }

    const data = userDoc.data();

    return {
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as User;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error;
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function approveWithInviteCode(
  uid: string,
  code: string
): Promise<boolean> {
  const codesRef = collection(db, "inviteCodes");
  const q = query(
    codesRef,
    where("code", "==", code),
    where("isUsed", "==", false)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  const codeDoc = snapshot.docs[0];
  const codeData = codeDoc.data();

  if (codeData.expiresAt.toDate() < new Date()) return false;

  await updateDoc(codeDoc.ref, {
    isUsed: true,
    usedBy: uid,
    usedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), {
    is_approved: true,
    approvalMethod: "invite",
    inviteCodeUsed: code,
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function submitApprovalRequest(
  uid: string,
  email: string,
  displayName: string,
  message: string
): Promise<string> {
  const { addDoc } = await import("firebase/firestore");

  const requestNumber = Math.floor(
    1000 + Math.random() * 9000
  ).toString();

  await addDoc(collection(db, "approvalRequests"), {
    uid,
    email,
    displayName,
    requestNumber,
    message,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), {
    approvalRequestNumber: requestNumber,
    updatedAt: serverTimestamp(),
  });

  return requestNumber;
}

export function generateInviteCode(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
}