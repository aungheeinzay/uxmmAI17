"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { logoutAccount, passwordRecoveryErrorMessage, resetPassword } from "../api/auth.api";

// Each mounted hook owns its link reader. The secret never enters a shared store
// or a rendered snapshot. Reading on subscription keeps SSR hydration stable.
function createResetLink() {
  let initialized = false;
  let token: string | null = null;
  let snapshot: "loading" | "ready" | "invalid" = "loading";
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!initialized) {
        initialized = true;
        const values = new URLSearchParams(window.location.hash.slice(1)).getAll("token");
        token = values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0]) ? values[0] : null;
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
        snapshot = token ? "ready" : "invalid";
        listener();
      }
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => "loading" as const,
    getToken: () => token,
    clear() { token = null; snapshot = "invalid"; listeners.forEach((listener) => listener()); },
  };
}

export function useResetPassword() {
  const [link] = useState(createResetLink);
  const linkStatus = useSyncExternalStore(link.subscribe, link.getSnapshot, link.getServerSnapshot);
  const locked = useRef(false);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => router.replace("/login"), 2500);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  async function submit(newPassword: string) {
    if (locked.current) return false;
    const token = link.getToken();
    if (!token) return false;
    locked.current = true;
    setStatus("pending");
    setError(null);
    try {
      await resetPassword({ token, newPassword });
    } catch (cause) {
      setError(passwordRecoveryErrorMessage(cause, true));
      if (cause instanceof ApiError && cause.code === "INVALID_RESET_TOKEN") link.clear();
      setStatus("error");
      locked.current = false;
      return false;
    }
    // Express revoked all sessions. Clear stale UI identity and expire this
    // browser's cookies through the existing BFF logout flow.
    useAuthStore.getState().clearUser();
    try { await logoutAccount(); } catch { /* Login restoration clears revoked cookies when reachable. */ }
    setStatus("success");
    link.clear();
    return true;
  }

  return { submit, status, error, linkStatus, goToLogin: () => router.replace("/login") };
}
