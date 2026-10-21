"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { logoutAccount } from "../api/auth.api";

export function useLogout() {
  const router = useRouter();
  const locked = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    if (locked.current) return;
    locked.current = true;
    setIsPending(true);
    setError(null);
    useAuthStore.getState().clearUser();
    try {
      await logoutAccount();
      useAuthStore.getState().clearUser();
      router.replace("/login");
    } catch {
      setError("We couldn’t finish signing you out. Please retry to revoke your session.");
    } finally {
      locked.current = false;
      setIsPending(false);
    }
  }
  return { logout, isPending, error };
}
