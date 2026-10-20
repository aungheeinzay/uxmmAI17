"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser } from "../api/auth.api";

let restoration: { revision: number; promise: Promise<void> } | null = null;

export function restoreCurrentUser(): Promise<void> {
  if (restoration?.revision === useAuthStore.getState().revision) return restoration.promise;
  const revision = useAuthStore.getState().begin();
  const promise = getCurrentUser().then((user) => {
    if (useAuthStore.getState().revision === revision) useAuthStore.getState().setUser(user);
  }).catch((error: unknown) => {
    if (useAuthStore.getState().revision !== revision) return;
    if (error instanceof ApiError && (error.status === 401 || error.code === "EMAIL_NOT_VERIFIED")) useAuthStore.getState().clearUser();
    else useAuthStore.getState().unavailable();
  }).finally(() => {
    if (restoration?.revision === revision) restoration = null;
  });
  restoration = { revision, promise };
  return promise;
}

export function useCurrentUser() {
  const state = useAuthStore();
  useEffect(() => {
    // Restore on first load; navigation after login/logout already has a known identity.
    if (useAuthStore.getState().status === "loading") void restoreCurrentUser();
  }, []);
  return { user: state.user, status: state.status, retry: restoreCurrentUser };
}
