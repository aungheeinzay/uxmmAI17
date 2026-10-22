"use client";

import { create } from "zustand";
import type { AuthUser } from "@/features/auth/types/auth.types";

type AuthState = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  revision: number;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  begin: () => number;
  unavailable: () => void;
};

// No persistence: identity is always restored through the server session boundary.
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "loading",
  revision: 0,
  setUser: (user) => set({ user, status: "authenticated" }),
  clearUser: () =>
    set({
      user: null,
      status: "unauthenticated",
      revision: get().revision + 1,
    }),
  begin: () => {
    const revision = get().revision + 1;
    set({ user: null, status: "loading", revision });
    return revision;
  },
  unavailable: () => set({ user: null, status: "error" }),
}));
