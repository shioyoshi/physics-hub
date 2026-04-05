import { create } from "zustand";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  firebaseUser: import("firebase/auth").User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: import("firebase/auth").User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  setUser: (user) => set({ user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (loading) => set({ loading }),
}));
