"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser } from "../api/auth.api";

let restoration: Promise<void> | null = null;

export function restoreCurrentUser(): Promise<void> {
  if (restoration) return restoration;
  const revision = useAuthStore.getState().begin();
  restoration = getCurrentUser().then((user) => {
    if (useAuthStore.getState().revision === revision) useAuthStore.getState().setUser(user);
  }).catch((error: unknown) => {
    if (useAuthStore.getState().revision !== revision) return;
    if (error instanceof ApiError && (error.status === 401 || error.code === "EMAIL_NOT_VERIFIED")) useAuthStore.getState().clearUser();
    else useAuthStore.getState().unavailable();
  }).finally(() => { restoration = null; });
  return restoration;
}

export function useCurrentUser() {
  const state = useAuthStore();
  useEffect(() => { void restoreCurrentUser(); }, []);
  return { user: state.user, status: state.status, retry: restoreCurrentUser };
}
